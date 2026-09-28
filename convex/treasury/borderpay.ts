import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { requirePermission, requireUser } from "../authz";
import { PERMISSIONS } from "../permissions";
import { executeCommit } from "./ledger";
import {
  canonicalizeSigningPayload,
  computeKeyIdFromJwk,
  bufferToBase64url,
} from "./helpers";

const BORDERPAY_API_BASE = "https://borderpay.id/api/v1";

/**
 * Safely extracts error details from BorderPay REST API responses,
 * preventing '[object Object]' when error payloads contain nested validation maps.
 */
function parseBorderPayErrorMessage(errBody: string): string {
  try {
    const parsed = JSON.parse(errBody);
    if (typeof parsed === "string") {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.message === "string") {
        return parsed.message + (parsed.errors ? `: ${JSON.stringify(parsed.errors)}` : "");
      }
      if (typeof parsed.error === "string") {
        return parsed.error + (parsed.errors ? `: ${JSON.stringify(parsed.errors)}` : "");
      }
      if (parsed.errors) {
        return JSON.stringify(parsed.errors);
      }
      return JSON.stringify(parsed);
    }
  } catch {
    // raw body
  }
  return errBody;
}

/**
 * Calculates the payment gateway fee based on method and live config.
 * - QRIS:
 *   - Amount < 100k: 0.7% + Rp 290
 *   - Amount >= 100k: 1%
 * - VA & E-wallet: upfront calculation based on fee metadata.
 */
export function calculateGatewayFee(
  subtotal: number,
  method: "qris" | "va" | "ewallet",
  bankOrWalletCode?: string,
  rawMethods?: any
): number {
  if (method === "qris") {
    if (subtotal < 100000) {
      return Math.ceil(subtotal * 0.007) + 290;
    } else {
      return Math.ceil(subtotal * 0.01);
    }
  }

  if (method === "va") {
    let flat = 4200;
    let percent = 0;
    if (rawMethods?.va?.banks && Array.isArray(rawMethods.va.banks) && bankOrWalletCode) {
      const b = rawMethods.va.banks.find(
        (item: any) => item.code.toUpperCase() === bankOrWalletCode.toUpperCase()
      );
      if (b?.fee) {
        flat = Number(b.fee.flat ?? 4200);
        percent = Number(b.fee.percent ?? 0);
      }
    }
    return Math.ceil(subtotal * (percent / 100)) + flat;
  }

  if (method === "ewallet") {
    let flat = 0;
    let percent = 2;
    if (rawMethods?.ewallet?.wallets && Array.isArray(rawMethods.ewallet.wallets) && bankOrWalletCode) {
      const w = rawMethods.ewallet.wallets.find(
        (item: any) => item.code.toUpperCase() === bankOrWalletCode.toUpperCase()
      );
      if (w?.fee) {
        flat = Number(w.fee.flat ?? 0);
        percent = Number(w.fee.percent ?? 2);
      }
    } else if (rawMethods?.ewallet?.fee) {
      flat = Number(rawMethods.ewallet.fee.flat ?? 0);
      percent = Number(rawMethods.ewallet.fee.percent ?? 2);
    }
    return Math.ceil(subtotal * (percent / 100)) + flat;
  }

  return 0;
}

/**
 * Returns the organization's BorderPay configuration with masked API key for admins.
 */
export const getPaymentConfig = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const config = await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (!config) {
      return null;
    }

    // Mask secret API key for display (e.g. bp_test_••••••••1234)
    const key = config.apiKey;
    const maskedKey =
      key.length > 12
        ? `${key.slice(0, 8)}••••••••${key.slice(-4)}`
        : "••••••••";

    return {
      _id: config._id,
      organizationId: config.organizationId,
      provider: config.provider,
      maskedApiKey: maskedKey,
      hasApiKey: Boolean(config.apiKey),
      webhookToken: config.webhookToken || "",
      gatewayKeyId: config.gatewayKeyId || null,
      isEnabled: config.isEnabled,
      isTestMode: config.isTestMode,
      rawFetchedMethods: config.rawFetchedMethods || null,
      methodOverrides: config.methodOverrides || {
        qrisEnabled: true,
        enabledBanks: ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"],
        enabledWallets: ["DANA", "SHOPEE", "OVO"],
      },
      lastFetchedAt: config.lastFetchedAt,
      updatedAt: config.updatedAt,
    };
  },
});

/**
 * Internal query to check permissions and get existing config for saving payment gateway.
 */
export const _getAuthAndExistingConfigForSave = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const existing = await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    return {
      userId: user._id,
      existing,
    };
  },
});

/**
 * Internal mutation to save payment configuration and optionally insert a newly provisioned gateway key.
 */
export const _saveConfigMutation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    apiKey: v.string(),
    webhookToken: v.optional(v.string()),
    isEnabled: v.boolean(),
    isTestMode: v.boolean(),
    gatewayKeyId: v.string(),
    gatewayPrivateKeyJwk: v.string(),
    methodOverrides: v.object({
      qrisEnabled: v.boolean(),
      enabledBanks: v.array(v.string()),
      enabledWallets: v.array(v.string()),
    }),
    userId: v.id("users"),
    newGatewayKey: v.optional(
      v.object({
        keyId: v.string(),
        publicKeyJwk: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // If a new key was generated, register in treasurerKeys table
    if (args.newGatewayKey) {
      const existingKey = await ctx.db
        .query("treasurerKeys")
        .withIndex("by_organizationId_and_keyId", (q) =>
          q.eq("organizationId", args.organizationId).eq("keyId", args.newGatewayKey!.keyId)
        )
        .first();

      if (!existingKey) {
        await ctx.db.insert("treasurerKeys", {
          organizationId: args.organizationId,
          userId: args.userId,
          publicKeyJwk: args.newGatewayKey.publicKeyJwk,
          keyId: args.newGatewayKey.keyId,
          label: "BorderPay Gateway System Key",
          registeredAt: Date.now(),
          registeredBy: args.userId,
        });
      }
    }

    const existing = await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch("organizationPaymentConfig", existing._id, {
        apiKey: args.apiKey,
        webhookToken: args.webhookToken,
        isEnabled: args.isEnabled,
        isTestMode: args.isTestMode,
        gatewayKeyId: args.gatewayKeyId,
        gatewayPrivateKeyJwk: args.gatewayPrivateKeyJwk,
        methodOverrides: args.methodOverrides,
        updatedBy: args.userId,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("organizationPaymentConfig", {
        organizationId: args.organizationId,
        provider: "borderpay",
        apiKey: args.apiKey,
        webhookToken: args.webhookToken,
        gatewayKeyId: args.gatewayKeyId,
        gatewayPrivateKeyJwk: args.gatewayPrivateKeyJwk,
        isEnabled: args.isEnabled,
        isTestMode: args.isTestMode,
        methodOverrides: args.methodOverrides,
        updatedBy: args.userId,
        updatedAt: now,
      });
    }
  },
});

/**
 * Creates or updates the BorderPay payment configuration for an organization.
 * Defined as an action to allow cryptographic key generation (ECDSA P-256) via Web Crypto.
 */
export const savePaymentConfig = action({
  args: {
    organizationId: v.id("organizations"),
    apiKey: v.optional(v.string()), // Optional if not changing existing key
    webhookToken: v.optional(v.string()),
    isEnabled: v.boolean(),
    methodOverrides: v.optional(
      v.object({
        qrisEnabled: v.boolean(),
        enabledBanks: v.array(v.string()),
        enabledWallets: v.array(v.string()),
      })
    ),
  },
  returns: v.id("organizationPaymentConfig"),
  handler: async (ctx, args): Promise<Id<"organizationPaymentConfig">> => {
    const authData: {
      userId: Id<"users">;
      existing: Doc<"organizationPaymentConfig"> | null;
    } = await ctx.runQuery(
      internal.treasury.borderpay._getAuthAndExistingConfigForSave,
      { organizationId: args.organizationId }
    );
    const { userId, existing } = authData;

    const apiKeyToUse =
      args.apiKey && args.apiKey.trim().length > 0
        ? args.apiKey.trim()
        : (existing?.apiKey ?? "");

    if (!apiKeyToUse && args.isEnabled) {
      throw new Error("Cannot enable payment gateway without a valid BorderPay API key.");
    }

    const isTestMode = apiKeyToUse.startsWith("bp_test_");

    let gatewayKeyId = existing?.gatewayKeyId;
    let gatewayPrivateKeyJwk = existing?.gatewayPrivateKeyJwk;
    let newGatewayKey: { keyId: string; publicKeyJwk: string } | undefined = undefined;

    // Auto-provision CLE gateway signing key if not present (Web Crypto generation permitted in actions)
    if (!gatewayKeyId || !gatewayPrivateKeyJwk) {
      const keyPair = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
      const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

      const publicJwkString = JSON.stringify(publicJwk);
      const privateJwkString = JSON.stringify(privateJwk);

      const keyId = await computeKeyIdFromJwk(publicJwkString);
      gatewayKeyId = keyId;
      gatewayPrivateKeyJwk = privateJwkString;
      newGatewayKey = { keyId, publicKeyJwk: publicJwkString };
    }

    const overrides = args.methodOverrides ?? existing?.methodOverrides ?? {
      qrisEnabled: true,
      enabledBanks: ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"],
      enabledWallets: ["DANA", "SHOPEE", "OVO"],
    };

    const webhookTokenToSave =
      args.webhookToken !== undefined ? args.webhookToken.trim() : existing?.webhookToken;

    return await ctx.runMutation(internal.treasury.borderpay._saveConfigMutation, {
      organizationId: args.organizationId,
      apiKey: apiKeyToUse,
      webhookToken: webhookTokenToSave,
      isEnabled: args.isEnabled,
      isTestMode,
      gatewayKeyId,
      gatewayPrivateKeyJwk,
      methodOverrides: overrides,
      userId,
      newGatewayKey,
    });
  },
});

/**
 * Internal query to fetch decrypted config for server actions and webhook processing.
 */
export const _getInternalConfig = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();
  },
});

/**
 * Internal query to lookup config by webhook verification token.
 */
export const _getConfigByWebhookToken = internalQuery({
  args: {
    webhookToken: v.string(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("organizationPaymentConfig").collect();
    return all.find((c) => c.webhookToken === args.webhookToken) || null;
  },
});

/**
 * Action to fetch active payment methods directly from BorderPay's REST API.
 * Caches the response in organizationPaymentConfig.rawFetchedMethods.
 */
export const fetchAvailablePaymentMethods = action({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<any> => {
    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.borderpay._getInternalConfig,
      { organizationId: args.organizationId }
    );

    if (!config || !config.apiKey) {
      throw new Error("BorderPay API key is not configured for this organization.");
    }

    const response = await fetch(`${BORDERPAY_API_BASE}/payment-methods`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      const msg = parseBorderPayErrorMessage(errText);
      throw new Error(`Failed to fetch payment methods from BorderPay (${response.status}): ${msg}`);
    }

    const data = await response.json();

    // Cache results in database
    await ctx.runMutation(internal.treasury.borderpay._saveFetchedMethods, {
      configId: config._id,
      methods: data,
    });

    return data;
  },
});

export const _saveFetchedMethods = internalMutation({
  args: {
    configId: v.id("organizationPaymentConfig"),
    methods: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("organizationPaymentConfig", args.configId, {
      rawFetchedMethods: args.methods,
      lastFetchedAt: Date.now(),
    });
  },
});

/**
 * Returns the publicly available payment methods for an organization,
 * filtered by the admin's methodOverrides and enriched with fee calculation info.
 */
export const getPublicPaymentMethods = query({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (!config || !config.isEnabled) {
      return {
        isEnabled: false,
        isTestMode: false,
        qris: { enabled: false },
        va: { enabled: false, banks: [] },
        ewallet: { enabled: false, wallets: [] },
      };
    }

    const raw = config.rawFetchedMethods || {};
    const overrides = config.methodOverrides || {
      qrisEnabled: true,
      enabledBanks: ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"],
      enabledWallets: ["DANA", "SHOPEE", "OVO"],
    };

    // 1. QRIS
    const qrisRawEnabled = raw.qris?.enabled ?? true;
    const qrisEnabled = overrides.qrisEnabled && qrisRawEnabled;

    // 2. VA Banks
    const defaultBanks = [
      { code: "BNI", name: "BNI" },
      { code: "BCA", name: "BCA" },
      { code: "MANDIRI", name: "Bank Mandiri" },
      { code: "BRI", name: "BRI" },
      { code: "PERMATA", name: "Permata Bank" },
      { code: "CIMB", name: "CIMB Niaga" },
    ];
    const sourceBanks = raw.va?.banks || defaultBanks;
    const filteredBanks = sourceBanks
      .filter((b: any) => overrides.enabledBanks.includes(b.code.toUpperCase()))
      .map((b: any) => ({
        code: b.code,
        name: b.name || b.code,
        enabled: b.enabled ?? true,
        fee: b.fee || { percent: 0, flat: 4200 },
      }));

    // 3. E-Wallets
    const defaultWallets = [
      { code: "DANA", name: "DANA" },
      { code: "SHOPEE", name: "ShopeePay" },
      { code: "OVO", name: "OVO" },
    ];
    const sourceWallets = raw.ewallet?.wallets || defaultWallets;
    const filteredWallets = sourceWallets
      .filter((w: any) => overrides.enabledWallets.includes(w.code.toUpperCase()))
      .map((w: any) => ({
        code: w.code,
        name: w.name || w.code,
        enabled: w.enabled ?? true,
        fee: w.fee || { percent: 2, flat: 0 },
      }));

    return {
      isEnabled: true,
      isTestMode: config.isTestMode,
      qris: {
        enabled: qrisEnabled,
        feeDescription: "< 100k: 0.7% + Rp 290 | ≥ 100k: 1%",
      },
      va: {
        enabled: filteredBanks.length > 0,
        banks: filteredBanks,
      },
      ewallet: {
        enabled: filteredWallets.length > 0,
        wallets: filteredWallets,
      },
    };
  },
});

/**
 * Creates an invoice for a member to pay their sequential N oldest unpaid dues periods.
 */
export const createDuesInvoice = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    periodCount: v.number(),
    targetUserId: v.optional(v.id("users")), // Optional, defaults to caller
  },
  returns: v.string(), // Returns invoiceNumber
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const userId = args.targetUserId ?? caller._id;

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Selected fund does not belong to this organization.");
    }

    if (fund.isArchived) {
      throw new Error("Cannot issue dues invoice for an archived fund.");
    }

    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      .first();

    if (!member) {
      throw new Error("Target user is not a member of this organization.");
    }

    if (args.periodCount <= 0 || !Number.isInteger(args.periodCount)) {
      throw new Error("Period count must be a positive integer.");
    }

    // 1. Fetch unpaid memberships
    const memberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_fundId_and_userId", (q) =>
        q.eq("fundId", args.fundId).eq("userId", userId)
      )
      .collect();

    const unpaid = memberships.filter((m) => !m.hasPaid && !m.isWaived);
    const resolvedUnpaid: Array<{
      membership: Doc<"duesMemberships">;
      event: Doc<"duesEvents">;
    }> = [];

    for (const m of unpaid) {
      const event = await ctx.db.get("duesEvents", m.duesEventId);
      if (event) {
        resolvedUnpaid.push({ membership: m, event });
      }
    }

    resolvedUnpaid.sort((a, b) => a.event.dueDate - b.event.dueDate);

    if (resolvedUnpaid.length === 0) {
      throw new Error("No outstanding unpaid dues periods for this member.");
    }

    if (args.periodCount > resolvedUnpaid.length) {
      throw new Error(
        `Cannot invoice ${args.periodCount} periods: Member only has ${resolvedUnpaid.length} unpaid period(s).`
      );
    }

    const selectedToPay = resolvedUnpaid.slice(0, args.periodCount);
    const subtotal = selectedToPay.reduce((sum, item) => sum + item.event.amount, 0);

    const targetUser = await ctx.db.get("users", userId);
    const payerName = targetUser?.name || "Member";
    const payerEmail = targetUser?.email || undefined;
    const periodLabels = selectedToPay.map((item) => item.event.periodLabel);

    // Cancel any existing pending dues invoices for this member to release reserved cycles
    const existingPending = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", userId)
      )
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const inv of existingPending) {
      if (inv.type === "dues") {
        await ctx.db.patch("invoices", inv._id, { status: "cancelled" });
      }
    }

    // Generate unique invoice number: INV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${randSuffix}`;

    const invoiceId = await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      fundId: args.fundId,
      invoiceNumber,
      type: "dues",
      title: `Dues Payment (${selectedToPay.length} cycle${selectedToPay.length > 1 ? "s" : ""}: ${periodLabels.join(", ")})`,
      description: `Membership dues payment for ${payerName} in ${fund.name}`,
      userId,
      memberId: member._id,
      payerName,
      payerEmail,
      duesMembershipIds: selectedToPay.map((item) => item.membership._id),
      periodLabels,
      subtotal,
      gatewayFee: 0,
      totalAmount: subtotal,
      currency: fund.currency || "IDR",
      status: "draft",
      createdBy: caller._id,
      createdAt: Date.now(),
    });

    // Tag memberships with pending invoice
    for (const item of selectedToPay) {
      await ctx.db.patch("duesMemberships", item.membership._id, {
        invoiceId,
        paymentMethod: "gateway_borderpay",
      });
    }

    return invoiceNumber;
  },
});

/**
 * Creates a custom / blank invoice issued by an organization administrator.
 */
export const createCustomInvoice = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    title: v.string(),
    description: v.optional(v.string()),
    amount: v.number(),
    payerName: v.string(),
    payerEmail: v.optional(v.string()),
    targetUserId: v.optional(v.id("users")),
  },
  returns: v.string(), // Returns invoiceNumber
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Selected fund not found in this organization.");
    }

    if (args.amount <= 0 || !Number.isInteger(args.amount)) {
      throw new Error("Amount must be a positive integer in smallest currency units.");
    }

    const trimmedTitle = args.title.trim();
    if (!trimmedTitle) {
      throw new Error("Invoice title cannot be empty.");
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const invoiceNumber = `INV-${dateStr}-${randSuffix}`;

    await ctx.db.insert("invoices", {
      organizationId: args.organizationId,
      fundId: args.fundId,
      invoiceNumber,
      type: "custom",
      title: trimmedTitle,
      description: args.description?.trim() || undefined,
      userId: args.targetUserId,
      payerName: args.payerName.trim() || "Customer",
      payerEmail: args.payerEmail?.trim() || undefined,
      subtotal: args.amount,
      gatewayFee: 0,
      totalAmount: args.amount,
      currency: fund.currency || "IDR",
      status: "draft",
      createdBy: user._id,
      createdAt: Date.now(),
    });

    return invoiceNumber;
  },
});

/**
 * Action to initiate a payment via BorderPay for an invoice.
 * Computes the exact customer fee upfront, contacts BorderPay POST /payments,
 * and records the payment instructions (QR string / VA number / checkout URL).
 */
export const initiatePayment = action({
  args: {
    invoiceNumber: v.string(),
    method: v.union(v.literal("qris"), v.literal("va"), v.literal("ewallet")),
    bankCode: v.optional(v.string()),
    returnUrl: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    // 1. Fetch invoice
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.treasury.borderpay._getInvoiceByNumber,
      { invoiceNumber: args.invoiceNumber }
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (invoice.status === "paid") {
      throw new Error("This invoice is already paid.");
    }

    if (invoice.status === "cancelled") {
      throw new Error("This invoice has been cancelled.");
    }

    // Single-method lock check
    if (invoice.status === "pending" && invoice.selectedMethod && invoice.selectedMethod !== args.method) {
      throw new Error("Invoice is locked to its selected payment method until it expires or is cancelled.");
    }

    // 2. Fetch config
    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.borderpay._getInternalConfig,
      { organizationId: invoice.organizationId }
    );

    if (!config || !config.isEnabled || !config.apiKey) {
      throw new Error("Payment gateway is not enabled for this organization.");
    }

    // VA requires bank_code; E-wallet requires bank_code
    if (args.method === "va" && !args.bankCode) {
      throw new Error("Please select a bank for Virtual Account payment.");
    }
    if (args.method === "ewallet" && !args.bankCode) {
      throw new Error("Please select an e-wallet option.");
    }

    // 3. Compute upfront customer fee
    const fee = calculateGatewayFee(
      invoice.subtotal,
      args.method,
      args.bankCode,
      config.rawFetchedMethods
    );

    const totalAmount = invoice.subtotal + fee;

    // Minimum check for VA
    if (args.method === "va" && totalAmount < 10000) {
      throw new Error("Virtual Account minimum transaction amount is Rp 10.000.");
    }

    // 4. Call BorderPay POST /payments
    const payload: Record<string, unknown> = {
      amount: totalAmount,
      method: args.method,
      reference_id: invoice.invoiceNumber,
    };

    if (args.bankCode) {
      payload.bank_code = args.bankCode.toUpperCase();
    }
    if (args.returnUrl && args.returnUrl.startsWith("https://")) {
      payload.return_url = args.returnUrl;
    }

    const res = await fetch(`${BORDERPAY_API_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      const msg = parseBorderPayErrorMessage(errBody);
      throw new Error(`BorderPay Error (${res.status}): ${msg}`);
    }

    const bpRes = await res.json();

    // 5. Save payment details to invoice
    const expiresAt = bpRes.expires_at ? new Date(bpRes.expires_at).getTime() : Date.now() + 3600000;

    await ctx.runMutation(internal.treasury.borderpay._updateInvoicePendingPayment, {
      invoiceId: invoice._id,
      selectedMethod: args.method,
      selectedBankCode: args.bankCode?.toUpperCase() || undefined,
      gatewayFee: fee,
      totalAmount,
      borderpayReferenceId: (bpRes.reference_id || invoice.invoiceNumber) ?? undefined,
      payUrl: bpRes.pay_url || undefined,
      qrString: bpRes.qr_string || undefined,
      vaNumber: bpRes.va_number || undefined,
      vaBank: (bpRes.va_bank || args.bankCode?.toUpperCase()) || undefined,
      checkoutUrl: bpRes.checkout_url || undefined,
      expiresAt: expiresAt ?? undefined,
    });

    return {
      referenceId: bpRes.reference_id || invoice.invoiceNumber,
      payUrl: bpRes.pay_url || undefined,
      qrString: bpRes.qr_string || undefined,
      vaNumber: bpRes.va_number || undefined,
      vaBank: (bpRes.va_bank || args.bankCode?.toUpperCase()) || undefined,
      checkoutUrl: bpRes.checkout_url || undefined,
      expiresAt,
      fee,
      totalAmount,
    };
  },
});

export const _updateInvoicePendingPayment = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    selectedMethod: v.union(v.literal("qris"), v.literal("va"), v.literal("ewallet")),
    selectedBankCode: v.optional(v.union(v.string(), v.null())),
    gatewayFee: v.number(),
    totalAmount: v.number(),
    borderpayReferenceId: v.optional(v.union(v.string(), v.null())),
    payUrl: v.optional(v.union(v.string(), v.null())),
    qrString: v.optional(v.union(v.string(), v.null())),
    vaNumber: v.optional(v.union(v.string(), v.null())),
    vaBank: v.optional(v.union(v.string(), v.null())),
    checkoutUrl: v.optional(v.union(v.string(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("invoices", args.invoiceId, {
      status: "pending",
      selectedMethod: args.selectedMethod,
      selectedBankCode: args.selectedBankCode || undefined,
      gatewayFee: args.gatewayFee,
      totalAmount: args.totalAmount,
      borderpayReferenceId: args.borderpayReferenceId || undefined,
      payUrl: args.payUrl || undefined,
      qrString: args.qrString || undefined,
      vaNumber: args.vaNumber || undefined,
      vaBank: args.vaBank || undefined,
      checkoutUrl: args.checkoutUrl || undefined,
      expiresAt: args.expiresAt || undefined,
    });
  },
});

/**
 * Simulates a successful payment for an invoice in sandbox/test mode.
 */
export const simulatePayment = action({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.treasury.borderpay._getInvoiceByNumber,
      { invoiceNumber: args.invoiceNumber }
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.borderpay._getInternalConfig,
      { organizationId: invoice.organizationId }
    );

    if (!config || !config.apiKey) {
      throw new Error("Payment gateway is not configured.");
    }

    if (!config.isTestMode) {
      throw new Error("Payment simulation is only allowed in test/sandbox mode.");
    }

    const refId = invoice.borderpayReferenceId || invoice.invoiceNumber;
    const res = await fetch(`${BORDERPAY_API_BASE}/payments/${refId}/simulate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      const msg = parseBorderPayErrorMessage(errText);
      throw new Error(`Simulation failed (${res.status}): ${msg}`);
    }

    return await res.json();
  },
});

/**
 * Cancels a pending invoice and releases reserved dues memberships.
 */
export const cancelInvoice = mutation({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);

    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q) =>
        q.eq("invoiceNumber", args.invoiceNumber)
      )
      .first();

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (invoice.status === "paid") {
      throw new Error("Cannot cancel an invoice that is already paid.");
    }

    // Must be creator, payer, or admin
    const canManage = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", invoice.organizationId).eq("userId", caller._id)
      )
      .first();

    const isAuthorized =
      invoice.createdBy === caller._id ||
      invoice.userId === caller._id ||
      Boolean(canManage);

    if (!isAuthorized) {
      throw new Error("Unauthorized to cancel this invoice.");
    }

    await ctx.db.patch("invoices", invoice._id, {
      status: "cancelled",
    });

    // Release dues memberships
    if (invoice.duesMembershipIds) {
      for (const mid of invoice.duesMembershipIds) {
        const mem = await ctx.db.get("duesMemberships", mid);
        if (mem && !mem.hasPaid) {
          await ctx.db.patch("duesMemberships", mid, {
            invoiceId: undefined,
          });
        }
      }
    }

    return { success: true };
  },
});

/**
 * Internal query to lookup invoice by invoiceNumber.
 */
export const _getInvoiceByNumber = internalQuery({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q) =>
        q.eq("invoiceNumber", args.invoiceNumber)
      )
      .first();
  },
});

/**
 * Public query for viewing an invoice (used on /invoice/:invoiceNumber).
 */
export const getInvoice = query({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q) =>
        q.eq("invoiceNumber", args.invoiceNumber)
      )
      .first();

    if (!invoice) {
      return null;
    }

    const org = await ctx.db.get("organizations", invoice.organizationId);
    const fund = await ctx.db.get("funds", invoice.fundId);
    const config = await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", invoice.organizationId)
      )
      .first();

    return {
      ...invoice,
      organizationName: org?.name || "Organization",
      fundName: fund?.name || "General Fund",
      isTestMode: config?.isTestMode ?? false,
    };
  },
});

/**
 * Lists invoices for an organization, with optional status filtering.
 */
export const listInvoices = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.optional(v.id("funds")),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);

    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", caller._id)
      )
      .first();

    if (!member) {
      throw new Error("You are not a member of this organization.");
    }

    const invoicesQuery = ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      );

    const invoices = await invoicesQuery.order("desc").take(100);

    return invoices.filter((inv) => {
      if (args.fundId && inv.fundId !== args.fundId) return false;
      if (args.status && args.status !== "all" && inv.status !== args.status) return false;
      return true;
    });
  },
});

/**
 * Internal query to fetch invoice, fund, and payment configuration context for webhook processing.
 */
export const _getInvoiceAndPaymentContext = internalQuery({
  args: {
    referenceId: v.string(),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q) =>
        q.eq("invoiceNumber", args.referenceId)
      )
      .first();

    if (!invoice) return null;

    const config = await ctx.db
      .query("organizationPaymentConfig")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", invoice.organizationId)
      )
      .first();

    if (invoice.type !== "dues") {
      return {
        invoice,
        config: null,
        fund: null,
        latest: null,
        firstDueEventId: undefined,
        ownerUser: null,
      };
    }

    const fund = await ctx.db.get("funds", invoice.fundId);
    if (!fund || fund.isArchived || !config?.gatewayKeyId || !config?.gatewayPrivateKeyJwk) {
      return {
        invoice,
        config,
        fund: null,
        latest: null,
        firstDueEventId: undefined,
        ownerUser: null,
      };
    }

    const gatewayKey = await ctx.db
      .query("treasurerKeys")
      .withIndex("by_organizationId_and_keyId", (q) =>
        q.eq("organizationId", invoice.organizationId).eq("keyId", config.gatewayKeyId!)
      )
      .first();

    const ownerUser = gatewayKey ? await ctx.db.get("users", gatewayKey.userId) : null;

    const latest = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", fund._id))
      .order("desc")
      .first();

    const firstDueEventId =
      invoice.duesMembershipIds && invoice.duesMembershipIds.length > 0
        ? (await ctx.db.get("duesMemberships", invoice.duesMembershipIds[0]))?.duesEventId
        : undefined;

    return {
      invoice,
      config,
      fund,
      latest,
      firstDueEventId,
      ownerUser,
    };
  },
});

/**
 * Internal mutation executed upon receiving a verified BorderPay webhook.
 * Finalizes invoice payment, updates dues memberships, and commits verified ledger entry.
 */
export const _completeInvoicePaidMutation = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    paidAt: v.number(),
    signedCommit: v.optional(
      v.object({
        signature: v.string(),
        previousHash: v.string(),
        keyId: v.string(),
        duesEventId: v.optional(v.id("duesEvents")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get("invoices", args.invoiceId);
    if (!invoice || invoice.status === "paid") {
      return { success: true, alreadyPaid: true };
    }

    let ledgerEntryId: Id<"ledgerEntries"> | undefined = undefined;

    if (args.signedCommit) {
      const fund = await ctx.db.get("funds", invoice.fundId);
      const gatewayKey = await ctx.db
        .query("treasurerKeys")
        .withIndex("by_organizationId_and_keyId", (q) =>
          q.eq("organizationId", invoice.organizationId).eq("keyId", args.signedCommit!.keyId)
        )
        .first();

      const ownerUser = gatewayKey ? await ctx.db.get("users", gatewayKey.userId) : null;

      if (fund && ownerUser) {
        try {
          const result = await executeCommit(ctx, ownerUser, fund, {
            direction: "credit",
            amount: invoice.subtotal,
            memo: `BorderPay Dues Payment - ${invoice.invoiceNumber}`,
            keyId: args.signedCommit.keyId,
            previousHash: args.signedCommit.previousHash,
            signature: args.signedCommit.signature,
            entryType: "gateway_payment",
            duesEventId: args.signedCommit.duesEventId,
          });
          ledgerEntryId = result.entryId;
        } catch (err) {
          console.error("Error committing gateway ledger entry:", err);
        }
      }
    }

    // Update linked dues memberships
    if (invoice.duesMembershipIds) {
      for (const mid of invoice.duesMembershipIds) {
        const membership = await ctx.db.get("duesMemberships", mid);
        if (membership && !membership.hasPaid) {
          await ctx.db.patch("duesMemberships", mid, {
            hasPaid: true,
            paidAt: args.paidAt,
            ledgerEntryId,
            paymentMethod: "gateway_borderpay",
          });

          const event = await ctx.db.get("duesEvents", membership.duesEventId);
          if (event) {
            await ctx.db.patch("duesEvents", event._id, {
              paidCount: event.paidCount + 1,
            });
          }
        }
      }
    }

    // Mark invoice as paid
    await ctx.db.patch("invoices", invoice._id, {
      status: "paid",
      paidAt: args.paidAt,
      ledgerEntryId,
    });

    return { success: true, invoiceId: invoice._id, ledgerEntryId };
  },
});

/**
 * Internal action executed upon receiving a verified BorderPay webhook.
 * Signs the CLE ledger commit using the gateway private key in action runtime (where crypto.subtle.sign is allowed),
 * then runs an internal mutation to atomically commit the ledger entry and mark the invoice paid.
 */
export const internalMarkInvoicePaid = internalAction({
  args: {
    referenceId: v.string(),
    paidAt: v.number(),
    borderpayData: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    const ctxData: any = await ctx.runQuery(
      internal.treasury.borderpay._getInvoiceAndPaymentContext,
      { referenceId: args.referenceId }
    );

    if (!ctxData || !ctxData.invoice) {
      console.warn(`Webhook received for unknown reference_id: ${args.referenceId}`);
      return { success: false, reason: "Invoice not found" };
    }

    const { invoice, config, fund, latest, firstDueEventId, ownerUser } = ctxData;

    if (invoice.status === "paid") {
      return { success: true, alreadyPaid: true };
    }

    let signedCommit:
      | {
          signature: string;
          previousHash: string;
          keyId: string;
          duesEventId?: Id<"duesEvents">;
        }
      | undefined = undefined;

    if (
      invoice.type === "dues" &&
      fund &&
      config?.gatewayKeyId &&
      config?.gatewayPrivateKeyJwk &&
      ownerUser
    ) {
      const sequenceNumber = latest ? latest.sequenceNumber + 1 : 1;
      const previousHash = latest ? latest.entryHash : "GENESIS";
      const memo = `BorderPay Dues Payment - ${invoice.invoiceNumber}`;

      const signingPayloadText = canonicalizeSigningPayload({
        fundId: fund._id,
        sequenceNumber,
        previousHash,
        direction: "credit",
        amount: invoice.subtotal,
        memo,
        keyId: config.gatewayKeyId,
      });

      try {
        const privateKeyJwkParsed: JsonWebKey = JSON.parse(config.gatewayPrivateKeyJwk);
        const privateKey = await crypto.subtle.importKey(
          "jwk",
          privateKeyJwkParsed,
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign"]
        );

        const rawSignature = await crypto.subtle.sign(
          { name: "ECDSA", hash: "SHA-256" },
          privateKey,
          new TextEncoder().encode(signingPayloadText)
        );

        signedCommit = {
          signature: bufferToBase64url(rawSignature),
          previousHash,
          keyId: config.gatewayKeyId,
          duesEventId: firstDueEventId || undefined,
        };
      } catch (err) {
        console.error("Failed to sign gateway ledger entry in action:", err);
      }
    }

    return await ctx.runMutation(
      internal.treasury.borderpay._completeInvoicePaidMutation,
      {
        invoiceId: invoice._id,
        paidAt: args.paidAt,
        signedCommit,
      }
    );
  },
});
