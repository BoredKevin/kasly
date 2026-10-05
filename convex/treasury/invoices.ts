import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requirePermission, requireUser } from "../authz";
import { PERMISSIONS } from "../permissions";

/**
 * Creates an invoice for an organization member to pay their sequential N oldest unpaid dues periods.
 * The invoice is created in 'draft' status without requiring any external payment gateway call.
 */
export const createDuesInvoice = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    periodCount: v.number(),
    targetUserId: v.optional(v.id("users")), // Optional, defaults to caller
  },
  returns: v.string(), // Returns unique invoiceNumber
  handler: async (ctx, args) => {
    const caller = await requireUser(ctx);
    const userId = args.targetUserId ?? caller._id;

    if (userId !== caller._id) {
      await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.MANAGE_TREASURY
      );
    }

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
    const payerName = member.nickname || targetUser?.name || "Member";
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

    // Generate unique invoice number: INV-YYYYMMDD-XXXXX
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
        paymentMethod: "gateway",
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
  returns: v.string(), // Returns unique invoiceNumber
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

    let memberId = undefined;
    if (args.targetUserId) {
      const member = await ctx.db
        .query("members")
        .withIndex("by_organizationId_and_userId", (q) =>
          q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId!)
        )
        .first();
      if (member) {
        memberId = member._id;
      }
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
      memberId,
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
 * Updates a draft or pending invoice's metadata or amount.
 */
export const updateInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    payerName: v.optional(v.string()),
    payerEmail: v.optional(v.string()),
    amount: v.optional(v.number()), // Only editable for custom invoices in draft
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const invoice = await ctx.db.get("invoices", args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    if (invoice.status === "paid") {
      throw new Error("Cannot edit an invoice that has already been paid.");
    }

    if (invoice.status === "cancelled" || invoice.status === "expired") {
      throw new Error("Cannot edit a cancelled or expired invoice.");
    }

    // Must be organization admin with MANAGE_TREASURY
    await requirePermission(
      ctx,
      invoice.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const patch: Record<string, any> = {};

    if (args.title !== undefined) {
      const trimmedTitle = args.title.trim();
      if (!trimmedTitle) {
        throw new Error("Invoice title cannot be empty.");
      }
      patch.title = trimmedTitle;
    }

    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }

    if (args.payerName !== undefined) {
      const trimmedName = args.payerName.trim();
      if (!trimmedName) {
        throw new Error("Payer name cannot be empty.");
      }
      patch.payerName = trimmedName;
    }

    if (args.payerEmail !== undefined) {
      patch.payerEmail = args.payerEmail.trim() || undefined;
    }

    if (args.amount !== undefined) {
      if (invoice.type !== "custom") {
        throw new Error("Cannot modify amount for dues invoices. Dues amounts are defined by cycle schedules.");
      }
      if (invoice.status !== "draft") {
        throw new Error("Cannot change amount once payment session has been initiated.");
      }
      if (args.amount <= 0 || !Number.isInteger(args.amount)) {
        throw new Error("Amount must be a positive integer.");
      }
      patch.subtotal = args.amount;
      patch.totalAmount = args.amount + (invoice.gatewayFee || 0);
    }

    await ctx.db.patch("invoices", invoice._id, patch);
    return { success: true };
  },
});

/**
 * Permanently deletes an unpaid (draft, cancelled, or expired) invoice and releases any reserved dues cycles.
 */
export const deleteInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get("invoices", args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found.");
    }

    await requirePermission(
      ctx,
      invoice.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (invoice.status === "paid") {
      throw new Error("Cannot delete a paid invoice. Paid invoices are permanent financial records.");
    }

    // Release linked dues memberships if any
    if (invoice.duesMembershipIds) {
      for (const mid of invoice.duesMembershipIds) {
        const mem = await ctx.db.get("duesMemberships", mid);
        if (mem && !mem.hasPaid && mem.invoiceId === invoice._id) {
          await ctx.db.patch("duesMemberships", mid, {
            invoiceId: undefined,
            paymentMethod: undefined,
          });
        }
      }
    }

    await ctx.db.delete("invoices", invoice._id);
    return { success: true };
  },
});

/**
 * Cancels a draft or pending invoice and releases any linked dues memberships.
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

    // Must be creator, payer, or organization admin/treasurer
    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", invoice.organizationId).eq("userId", caller._id)
      )
      .first();

    const isAuthorized =
      invoice.createdBy === caller._id ||
      invoice.userId === caller._id ||
      Boolean(member);

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
 * Internal query to lookup full invoice document by unique invoiceNumber.
 */
export const _getInvoiceByNumber = internalQuery({
  args: {
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args): Promise<Doc<"invoices"> | null> => {
    return await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q) =>
        q.eq("invoiceNumber", args.invoiceNumber)
      )
      .first();
  },
});

/**
 * Query to lookup an invoice document by ID.
 */
export const getInvoiceById = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get("invoices", args.invoiceId);
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
      qrisName: config?.qrisName || org?.name || "Kasly Payment",
    };
  },
});

/**
 * Lists invoices for an organization, with optional status and fund filtering.
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

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .order("desc")
      .take(100);

    return invoices.filter((inv) => {
      if (args.fundId && inv.fundId !== args.fundId) return false;
      if (args.status && args.status !== "all" && inv.status !== args.status) return false;
      return true;
    });
  },
});

/**
 * Internal mutation to update an invoice to 'pending' state when payment rail is selected.
 */
export const _updateInvoicePendingPayment = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    selectedMethod: v.union(v.literal("qris"), v.literal("va"), v.literal("ewallet")),
    selectedBankCode: v.optional(v.union(v.string(), v.null())),
    gatewayFee: v.number(),
    totalAmount: v.number(),
    gatewayProvider: v.optional(v.union(v.string(), v.null())),
    gatewayReferenceId: v.optional(v.union(v.string(), v.null())),
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
      gatewayProvider: args.gatewayProvider || undefined,
      gatewayReferenceId: args.gatewayReferenceId || undefined,
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
