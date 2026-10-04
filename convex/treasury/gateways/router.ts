import { v } from "convex/values";
import {
  query,
  action,
  internalMutation,
  internalQuery,
} from "../../_generated/server";
import { internal } from "../../_generated/api";
import { Doc, Id } from "../../_generated/dataModel";
import { requirePermission } from "../../authz";
import { PERMISSIONS } from "../../permissions";
import { computeKeyIdFromJwk } from "../helpers";
import { getGatewayAdapter, listSupportedGateways } from "./registry";
import "./adapters/index"; // Ensures default adapters are registered
import { TemanQrisAdapter } from "./adapters/temanqris";

/**
 * Returns available payment gateway providers registered in the system.
 */
export const listAvailableGateways = query({
  args: {},
  handler: async () => {
    const supported = listSupportedGateways();
    return supported.map((g) => ({
      id: g.provider,
      name: g.displayName,
      supportedChannels:
        g.provider === "temanqris"
          ? (["qris"] as const)
          : (["qris", "va", "ewallet"] as const),
    }));
  },
});

/**
 * Returns the organization's payment configuration with masked API key for admins.
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

    const maskedProviderConfigs = config.providerConfigs
      ? Object.fromEntries(
          Object.entries(config.providerConfigs).map(([prov, pConfig]) => [
            prov,
            {
              maskedApiKey: pConfig.apiKey
                ? (pConfig.apiKey.length > 12
                    ? `${pConfig.apiKey.slice(0, 8)}••••••••${pConfig.apiKey.slice(-4)}`
                    : "••••••••")
                : "",
              hasApiKey: Boolean(pConfig.apiKey),
              webhookToken: pConfig.webhookToken || "",
              isTestMode: Boolean(pConfig.isTestMode),
            },
          ])
        )
      : undefined;

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
      channelRouting: config.channelRouting || {
        qrisGateway: "borderpay",
        vaGateway: "borderpay",
        ewalletGateway: "borderpay",
      },
      providerConfigs: maskedProviderConfigs,
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
    provider: v.optional(v.string()),
    apiKey: v.string(),
    webhookToken: v.optional(v.string()),
    isEnabled: v.boolean(),
    isTestMode: v.boolean(),
    gatewayKeyId: v.string(),
    gatewayPrivateKeyJwk: v.string(),
    methodOverrides: v.object({
      qrisEnabled: v.boolean(),
      vaEnabled: v.optional(v.boolean()),
      ewalletEnabled: v.optional(v.boolean()),
      enabledBanks: v.array(v.string()),
      enabledWallets: v.array(v.string()),
      customQrisFee: v.optional(
        v.object({
          type: v.union(v.literal("flat"), v.literal("percent")),
          value: v.number(),
        })
      ),
    }),
    channelRouting: v.optional(
      v.object({
        qrisGateway: v.optional(v.string()),
        vaGateway: v.optional(v.string()),
        ewalletGateway: v.optional(v.string()),
      })
    ),
    providerConfigs: v.optional(
      v.record(
        v.string(),
        v.object({
          apiKey: v.string(),
          webhookToken: v.optional(v.string()),
          isTestMode: v.optional(v.boolean()),
        })
      )
    ),
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
          label: "Payment Gateway Automated Signing Key",
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
    const providerToSave = args.provider || existing?.provider || "borderpay";

    if (existing) {
      await ctx.db.patch("organizationPaymentConfig", existing._id, {
        provider: providerToSave,
        apiKey: args.apiKey,
        webhookToken: args.webhookToken,
        isEnabled: args.isEnabled,
        isTestMode: args.isTestMode,
        gatewayKeyId: args.gatewayKeyId,
        gatewayPrivateKeyJwk: args.gatewayPrivateKeyJwk,
        methodOverrides: args.methodOverrides,
        channelRouting: args.channelRouting ?? existing.channelRouting,
        providerConfigs: args.providerConfigs ?? existing.providerConfigs,
        updatedBy: args.userId,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("organizationPaymentConfig", {
        organizationId: args.organizationId,
        provider: providerToSave,
        apiKey: args.apiKey,
        webhookToken: args.webhookToken,
        gatewayKeyId: args.gatewayKeyId,
        gatewayPrivateKeyJwk: args.gatewayPrivateKeyJwk,
        isEnabled: args.isEnabled,
        isTestMode: args.isTestMode,
        methodOverrides: args.methodOverrides,
        channelRouting: args.channelRouting,
        providerConfigs: args.providerConfigs,
        updatedBy: args.userId,
        updatedAt: now,
      });
    }
  },
});

/**
 * Creates or updates the payment gateway configuration for an organization.
 */
export const savePaymentConfig = action({
  args: {
    organizationId: v.id("organizations"),
    provider: v.optional(v.string()),
    apiKey: v.optional(v.string()), // Optional if not changing existing key
    webhookToken: v.optional(v.string()),
    isEnabled: v.boolean(),
    isTestMode: v.optional(v.boolean()),
    methodOverrides: v.optional(
      v.object({
        qrisEnabled: v.boolean(),
        vaEnabled: v.optional(v.boolean()),
        ewalletEnabled: v.optional(v.boolean()),
        enabledBanks: v.array(v.string()),
        enabledWallets: v.array(v.string()),
        customQrisFee: v.optional(
          v.object({
            type: v.union(v.literal("flat"), v.literal("percent")),
            value: v.number(),
          })
        ),
      })
    ),
    channelRouting: v.optional(
      v.object({
        qrisGateway: v.optional(v.string()),
        vaGateway: v.optional(v.string()),
        ewalletGateway: v.optional(v.string()),
      })
    ),
    providerConfigs: v.optional(
      v.record(
        v.string(),
        v.object({
          apiKey: v.optional(v.string()),
          webhookToken: v.optional(v.string()),
          isTestMode: v.optional(v.boolean()),
        })
      )
    ),
  },
  returns: v.id("organizationPaymentConfig"),
  handler: async (ctx, args): Promise<Id<"organizationPaymentConfig">> => {
    const authData: {
      userId: Id<"users">;
      existing: Doc<"organizationPaymentConfig"> | null;
    } = await ctx.runQuery(
      internal.treasury.gateways.router._getAuthAndExistingConfigForSave,
      { organizationId: args.organizationId }
    );
    const { userId, existing } = authData;

    const apiKeyToUse =
      args.apiKey && args.apiKey.trim().length > 0
        ? args.apiKey.trim()
        : (existing?.apiKey ?? "");

    // Prepare and merge providerConfigs if provided
    let mergedProviderConfigs:
      | Record<string, { apiKey: string; webhookToken?: string; isTestMode?: boolean }>
      | undefined = existing?.providerConfigs ? { ...existing.providerConfigs } : undefined;

    if (args.providerConfigs) {
      if (!mergedProviderConfigs) mergedProviderConfigs = {};
      for (const [pKey, pVal] of Object.entries(args.providerConfigs)) {
        const prev = mergedProviderConfigs[pKey];
        const keyToUse =
          pVal.apiKey && pVal.apiKey.trim().length > 0
            ? pVal.apiKey.trim()
            : (prev?.apiKey ?? "");
        mergedProviderConfigs[pKey] = {
          apiKey: keyToUse,
          webhookToken:
            pVal.webhookToken !== undefined ? pVal.webhookToken.trim() : prev?.webhookToken,
          isTestMode:
            pVal.isTestMode !== undefined ? pVal.isTestMode : prev?.isTestMode,
        };
      }
    }

    // Also verify if a secondary provider is configured
    const hasSecondaryKey = Boolean(
      mergedProviderConfigs?.temanqris?.apiKey?.trim() ||
      mergedProviderConfigs?.borderpay?.apiKey?.trim()
    );

    if (!apiKeyToUse && !hasSecondaryKey && args.isEnabled) {
      throw new Error("Cannot enable payment gateway without a valid API key.");
    }

    const isTestMode =
      args.isTestMode !== undefined
        ? args.isTestMode
        : (apiKeyToUse.startsWith("bp_test_") || apiKeyToUse.startsWith("test_"));

    let gatewayKeyId = existing?.gatewayKeyId;
    let gatewayPrivateKeyJwk = existing?.gatewayPrivateKeyJwk;
    let newGatewayKey: { keyId: string; publicKeyJwk: string } | undefined = undefined;

    // Auto-provision CLE gateway signing key if not present
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
      vaEnabled: true,
      ewalletEnabled: true,
      enabledBanks: ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"],
      enabledWallets: ["DANA", "SHOPEE", "OVO"],
    };

    const routing = args.channelRouting ?? existing?.channelRouting ?? {
      qrisGateway: "borderpay",
      vaGateway: "borderpay",
      ewalletGateway: "borderpay",
    };

    const webhookTokenToSave =
      args.webhookToken !== undefined ? args.webhookToken.trim() : existing?.webhookToken;

    return await ctx.runMutation(internal.treasury.gateways.router._saveConfigMutation, {
      organizationId: args.organizationId,
      provider: args.provider || existing?.provider || "borderpay",
      apiKey: apiKeyToUse,
      webhookToken: webhookTokenToSave,
      isEnabled: args.isEnabled,
      isTestMode,
      gatewayKeyId,
      gatewayPrivateKeyJwk,
      methodOverrides: overrides,
      channelRouting: routing,
      providerConfigs: mergedProviderConfigs,
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
 * Action to fetch active payment methods from the configured gateway adapter.
 */
export const fetchAvailablePaymentMethods = action({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<any> => {
    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.gateways.router._getInternalConfig,
      { organizationId: args.organizationId }
    );

    if (!config || !config.apiKey) {
      throw new Error("Payment gateway API key is not configured for this organization.");
    }

    const adapter = getGatewayAdapter(config.provider || "borderpay");
    const methods = await adapter.fetchPaymentMethods(ctx, config);
    return methods;
  },
});

/**
 * Public action invoked when a customer arrives at checkout (/invoice/:invoiceNumber).
 * Checks cache freshness (< 5 minutes) and refreshes live payment methods and fee schedule from the active gateway.
 */
export const syncCheckoutPaymentMethods = action({
  args: {
    invoiceNumber: v.string(),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.treasury.invoices._getInvoiceByNumber,
      { invoiceNumber: args.invoiceNumber }
    );

    if (!invoice) {
      return { success: false, reason: "Invoice not found" };
    }

    if (invoice.status === "paid" || invoice.status === "cancelled") {
      return { success: true, status: invoice.status };
    }

    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.gateways.router._getInternalConfig,
      { organizationId: invoice.organizationId }
    );

    if (!config || !config.isEnabled || !config.apiKey) {
      return { success: false, reason: "Payment gateway is not configured or disabled" };
    }

    // Cache freshness: 5 minutes
    const fiveMinutesMs = 5 * 60 * 1000;
    const isFresh =
      config.lastFetchedAt &&
      Date.now() - config.lastFetchedAt < fiveMinutesMs &&
      Boolean(config.rawFetchedMethods);

    if (isFresh && !args.forceRefresh) {
      return { success: true, cached: true };
    }

    try {
      const adapter = getGatewayAdapter(config.provider || "borderpay");
      const methods = await adapter.fetchPaymentMethods(ctx, config);
      return { success: true, count: methods.length };
    } catch (err) {
      console.warn("syncCheckoutPaymentMethods failed to refresh gateway methods:", err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
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

    const raw = (config.rawFetchedMethods as any) || {};
    const overrides = config.methodOverrides || {
      qrisEnabled: true,
      vaEnabled: true,
      ewalletEnabled: true,
      enabledBanks: ["BCA", "BNI", "MANDIRI", "BRI", "PERMATA", "CIMB"],
      enabledWallets: ["DANA", "SHOPEE", "OVO"],
    };

    const vaEnabled =
      overrides.vaEnabled !== undefined
        ? overrides.vaEnabled
        : overrides.enabledBanks && overrides.enabledBanks.length > 0;
    const ewalletEnabled =
      overrides.ewalletEnabled !== undefined
        ? overrides.ewalletEnabled
        : overrides.enabledWallets && overrides.enabledWallets.length > 0;

    // 1. QRIS
    const qrisRawEnabled =
      raw.qris?.enabled !== undefined
        ? Boolean(raw.qris.enabled)
        : raw.qris?.status !== undefined
          ? raw.qris.status === "active"
          : true;
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
    const sourceBanks =
      raw.va?.banks ||
      raw.raw?.va?.banks ||
      (Array.isArray(raw.normalized)
        ? raw.normalized
            .filter((m: any) => m.channelType === "va")
            .map((m: any) => ({
              code: m.code,
              name: m.name,
              fee: m.fee,
              min_amount: m.minAmount,
              max_amount: m.maxAmount,
              enabled: m.isEnabled,
            }))
        : null) ||
      defaultBanks;

    const filteredBanks = sourceBanks
      .filter((b: any) =>
        overrides.enabledBanks.some(
          (code) => code.toUpperCase() === b.code.toUpperCase()
        )
      )
      .map((b: any) => ({
        code: b.code.toUpperCase(),
        name: b.name || b.code,
        fee: {
          flat: Number(b.fee?.flat ?? b.fee_flat ?? b.flat_fee ?? 4200),
          percent: Number(b.fee?.percent ?? b.fee_percentage ?? b.percent_fee ?? 0),
        },
        minAmount: b.min_amount || b.minAmount || 10000,
        maxAmount: b.max_amount || b.maxAmount || 50000000,
      }));

    // 3. E-Wallets
    const defaultWallets = [
      { code: "DANA", name: "DANA" },
      { code: "SHOPEE", name: "ShopeePay" },
      { code: "OVO", name: "OVO" },
    ];
    const sourceWallets =
      raw.ewallet?.wallets ||
      raw.raw?.ewallet?.wallets ||
      (Array.isArray(raw.normalized)
        ? raw.normalized
            .filter((m: any) => m.channelType === "ewallet")
            .map((m: any) => ({
              code: m.code,
              name: m.name,
              fee: m.fee,
              min_amount: m.minAmount,
              max_amount: m.maxAmount,
              enabled: m.isEnabled,
            }))
        : null) ||
      defaultWallets;

    const filteredWallets = sourceWallets
      .filter((w: any) =>
        overrides.enabledWallets.some(
          (code) => code.toUpperCase() === w.code.toUpperCase()
        )
      )
      .map((w: any) => ({
        code: w.code.toUpperCase(),
        name: w.name || w.code,
        fee: {
          flat: Number(w.fee?.flat ?? w.fee_flat ?? w.flat_fee ?? 0),
          percent: Number(w.fee?.percent ?? w.fee_percentage ?? w.percent_fee ?? 2),
        },
        minAmount: w.min_amount || w.minAmount || 1000,
        maxAmount: w.max_amount || w.maxAmount || 10000000,
      }));

    const qrisGateway = config.channelRouting?.qrisGateway || "borderpay";
    const customQrisFee = overrides.customQrisFee;

    let qrisFee: {
      flat: number;
      percent: number;
      lowAmountFixed?: number;
      lowAmountPercent?: number;
      highAmountPercent?: number;
      threshold?: number;
      isCustom?: boolean;
    };

    if (qrisGateway === "temanqris") {
      if (customQrisFee && customQrisFee.value > 0) {
        if (customQrisFee.type === "flat") {
          qrisFee = {
            flat: customQrisFee.value,
            percent: 0,
            lowAmountFixed: customQrisFee.value,
            lowAmountPercent: 0,
            highAmountPercent: 0,
            threshold: 0,
            isCustom: true,
          };
        } else {
          qrisFee = {
            flat: 0,
            percent: customQrisFee.value,
            lowAmountFixed: 0,
            lowAmountPercent: customQrisFee.value,
            highAmountPercent: customQrisFee.value,
            threshold: 0,
            isCustom: true,
          };
        }
      } else {
        qrisFee = {
          flat: 0,
          percent: 0,
          lowAmountFixed: 0,
          lowAmountPercent: 0,
          highAmountPercent: 0,
          threshold: 0,
          isCustom: true,
        };
      }
    } else {
      qrisFee = {
        flat: 290,
        percent: 0.7,
        lowAmountFixed: 290,
        lowAmountPercent: 0.7,
        highAmountPercent: 1.0,
        threshold: 100000,
        isCustom: false,
      };
    }

    return {
      isEnabled: true,
      isTestMode: config.isTestMode,
      qris: {
        enabled: qrisEnabled,
        gateway: qrisGateway,
        fee: qrisFee,
      },
      va: {
        enabled: vaEnabled && filteredBanks.length > 0,
        banks: vaEnabled ? filteredBanks : [],
      },
      ewallet: {
        enabled: ewalletEnabled && filteredWallets.length > 0,
        wallets: ewalletEnabled ? filteredWallets : [],
      },
    };
  },
});

/**
 * Universal payment initiation action that dispatches to the organization's active gateway adapter.
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
      internal.treasury.invoices._getInvoiceByNumber,
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

    if (invoice.status === "pending" && invoice.selectedMethod && invoice.selectedMethod !== args.method) {
      throw new Error("Invoice is locked to its selected payment method until it expires or is cancelled.");
    }

    // 2. Fetch config
    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.gateways.router._getInternalConfig,
      { organizationId: invoice.organizationId }
    );

    if (!config || !config.isEnabled || !config.apiKey) {
      throw new Error("Payment gateway is not enabled for this organization.");
    }

    // 3. Resolve assigned gateway based on channel routing
    let targetGateway = config.provider || "borderpay";
    if (config.channelRouting) {
      if (args.method === "qris" && config.channelRouting.qrisGateway) {
        targetGateway = config.channelRouting.qrisGateway;
      } else if (args.method === "va" && config.channelRouting.vaGateway) {
        targetGateway = config.channelRouting.vaGateway;
      } else if (args.method === "ewallet" && config.channelRouting.ewalletGateway) {
        targetGateway = config.channelRouting.ewalletGateway;
      }
    }

    const adapter = getGatewayAdapter(targetGateway);

    // 4. Initiate payment with adapter
    const result = await adapter.initiatePayment(ctx, config, {
      invoice,
      channelType: args.method,
      channelCode: args.bankCode,
      returnUrl: args.returnUrl,
    });

    // 5. Update invoice to pending state
    await ctx.runMutation(internal.treasury.invoices._updateInvoicePendingPayment, {
      invoiceId: invoice._id,
      selectedMethod: args.method,
      selectedBankCode: args.bankCode?.toUpperCase() || undefined,
      gatewayFee: result.fee,
      totalAmount: result.totalAmount,
      gatewayProvider: targetGateway,
      gatewayReferenceId: result.providerReferenceId || invoice.invoiceNumber,
      borderpayReferenceId: result.providerReferenceId || invoice.invoiceNumber,
      payUrl: result.payUrl,
      qrString: result.qrString,
      vaNumber: result.vaNumber,
      vaBank: result.vaBank,
      checkoutUrl: result.checkoutUrl,
      expiresAt: result.expiresAt,
    });

    return {
      referenceId: result.providerReferenceId || invoice.invoiceNumber,
      payUrl: result.payUrl,
      qrString: result.qrString,
      vaNumber: result.vaNumber,
      vaBank: result.vaBank,
      checkoutUrl: result.checkoutUrl,
      expiresAt: result.expiresAt,
      fee: result.fee,
      totalAmount: result.totalAmount,
    };
  },
});

/**
 * Universal payment simulation action for sandbox / testing environments.
 */
export const simulatePayment = action({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.treasury.invoices._getInvoiceByNumber,
      { invoiceNumber: args.invoiceNumber }
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    const config: Doc<"organizationPaymentConfig"> | null = await ctx.runQuery(
      internal.treasury.gateways.router._getInternalConfig,
      { organizationId: invoice.organizationId }
    );

    if (!config || !config.apiKey) {
      throw new Error("Payment gateway is not configured.");
    }

    if (!config.isTestMode) {
      throw new Error("Payment simulation is only allowed in test/sandbox mode.");
    }

    const adapter = getGatewayAdapter(config.provider || "borderpay");
    if (!adapter.simulatePayment) {
      throw new Error(`Simulation is not supported for provider '${adapter.provider}'.`);
    }

    return await adapter.simulatePayment(ctx, config, {
      invoiceNumber: invoice.invoiceNumber,
      providerReferenceId: invoice.borderpayReferenceId || invoice.invoiceNumber,
    });
  },
});

/**
 * Internal mutation to flag an invoice as awaiting confirmation (e.g. when customer clicks 'Sudah Bayar').
 */
export const _flagInvoiceAwaitingConfirmation = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("invoices", args.invoiceId, {
      isAwaitingConfirmation: true,
      awaitingConfirmationAt: Date.now(),
    });
  },
});

/**
 * Public action for customer to claim payment completion ("Saya Sudah Bayar") on checkout.
 */
export const confirmCustomerPayment = action({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.treasury.invoices._getInvoiceByNumber,
      { invoiceNumber: args.invoiceNumber }
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (invoice.status === "paid") {
      return { success: true, message: "Invoice is already paid." };
    }

    const linkCode = invoice.gatewayReferenceId || invoice.borderpayReferenceId;
    if (!linkCode) {
      throw new Error("Payment reference is missing.");
    }

    const adapter = getGatewayAdapter(invoice.gatewayProvider || "temanqris");
    if (adapter instanceof TemanQrisAdapter) {
      await adapter.confirmCustomerClaim(linkCode);
    }

    await ctx.runMutation(
      internal.treasury.gateways.router._flagInvoiceAwaitingConfirmation,
      { invoiceId: invoice._id }
    );

    return {
      success: true,
      message: "Konfirmasi pembayaran telah dikirim. Menunggu verifikasi admin/merchant.",
    };
  },
});

/**
 * Admin action to verify a TemanQRIS payment upstream and execute automated CLE ledger settlement.
 */
export const verifyAndSettleTemanQrisOrder = action({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const invoice: Doc<"invoices"> | null = await ctx.runQuery(
      internal.treasury.invoices._getInvoiceByNumber,
      { invoiceNumber: args.invoiceNumber }
    );

    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (invoice.status === "paid") {
      return { success: true, message: "Invoice is already paid." };
    }

    // Require treasury management permission
    const authData: {
      userId: Id<"users">;
      existing: Doc<"organizationPaymentConfig"> | null;
    } = await ctx.runQuery(
      internal.treasury.gateways.router._getAuthAndExistingConfigForSave,
      { organizationId: invoice.organizationId }
    );

    const config = authData.existing;
    if (!config) {
      throw new Error("Payment gateway is not configured for this organization.");
    }

    const adapter = getGatewayAdapter("temanqris");
    if (adapter.simulatePayment) {
      await adapter.simulatePayment(ctx, config, {
        invoiceNumber: invoice.invoiceNumber,
        providerReferenceId: invoice.gatewayReferenceId || invoice.borderpayReferenceId,
      });
    }

    // Trigger universal CLE ledger settlement
    await ctx.runAction(internal.treasury.settlement.settleInvoicePayment, {
      referenceId: invoice.invoiceNumber,
      paidAt: Date.now(),
      provider: "temanqris",
      metadata: { confirmedBy: "admin", verifiedByUserId: authData.userId },
    });

    return {
      success: true,
      message: "Pembayaran berhasil diverifikasi dan dicatat ke dalam Ledger.",
    };
  },
});
