import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { executeCommit } from "./ledger";
import {
  canonicalizeSigningPayload,
  bufferToBase64url,
} from "./helpers";

/**
 * Internal query to fetch invoice, fund, and payment configuration context for settlement processing.
 */
export const _getInvoiceAndPaymentContext = internalQuery({
  args: {
    referenceId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Try finding by invoiceNumber
    let invoice = await ctx.db
      .query("invoices")
      .withIndex("by_invoiceNumber", (q) =>
        q.eq("invoiceNumber", args.referenceId)
      )
      .first();

    // 2. Fallback to searching by borderpayReferenceId if not matched by invoiceNumber
    if (!invoice) {
      invoice = await ctx.db
        .query("invoices")
        .withIndex("by_organizationId", (q) => q)
        // eslint-disable-next-line @convex-dev/no-filter-in-query
        .filter((q) => q.eq(q.field("borderpayReferenceId"), args.referenceId))
        .first();
    }

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
 * Internal mutation executed upon receiving a verified payment proof.
 * Finalizes invoice payment, updates dues memberships, and commits verified ledger entry.
 */
export const _completeInvoicePaidMutation = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    paidAt: v.number(),
    provider: v.optional(v.string()),
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
    const providerName = args.provider || "Gateway";

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
            memo: `${providerName} Dues Payment - ${invoice.invoiceNumber}`,
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
            paymentMethod: `gateway_${args.provider || "automated"}`,
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
 * Universal settlement action executed upon receiving a verified payment proof.
 * Signs the CLE ledger commit using the organization's automated gateway private key (WebCrypto ECDSA P-256),
 * then runs _completeInvoicePaidMutation to atomically record the ledger credit and mark the invoice paid.
 */
export const settleInvoicePayment = internalAction({
  args: {
    referenceId: v.string(),
    paidAt: v.number(),
    provider: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<any> => {
    const ctxData: any = await ctx.runQuery(
      internal.treasury.settlement._getInvoiceAndPaymentContext,
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

    const providerLabel = args.provider || "Gateway";

    if (
      invoice.type === "dues" &&
      fund &&
      config?.gatewayKeyId &&
      config?.gatewayPrivateKeyJwk &&
      ownerUser
    ) {
      const sequenceNumber = latest ? latest.sequenceNumber + 1 : 1;
      const previousHash = latest ? latest.entryHash : "GENESIS";
      const memo = `${providerLabel} Dues Payment - ${invoice.invoiceNumber}`;

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
      internal.treasury.settlement._completeInvoicePaidMutation,
      {
        invoiceId: invoice._id,
        paidAt: args.paidAt,
        provider: args.provider,
        signedCommit,
      }
    );
  },
});
