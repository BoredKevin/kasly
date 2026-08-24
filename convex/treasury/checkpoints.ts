import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requirePermission } from "../authz";
import { PERMISSIONS } from "../permissions";
import { deriveFundBalance } from "./helpers";

/**
 * Creates an administrative snapshot/checkpoint of a fund's current ledger state.
 * Captures sequenceNumber, entryHash, and derived balance for fast replay and tamper-evidence.
 */
export const createCheckpoint = mutation({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.id("ledgerCheckpoints"),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    const { user } = await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const latest = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("desc")
      .first();

    if (!latest) {
      throw new Error("Cannot create checkpoint: The fund has no ledger entries.");
    }

    // Check if checkpoint already exists at this exact sequence number
    const existing = await ctx.db
      .query("ledgerCheckpoints")
      .withIndex("by_fundId_and_sequenceNumber", (q) =>
        q.eq("fundId", args.fundId).eq("sequenceNumber", latest.sequenceNumber)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const currentBalance = await deriveFundBalance(ctx, args.fundId);

    const checkpointId = await ctx.db.insert("ledgerCheckpoints", {
      organizationId: fund.organizationId,
      fundId: fund._id,
      sequenceNumber: latest.sequenceNumber,
      entryHash: latest.entryHash,
      balanceAtCheckpoint: currentBalance,
      createdAt: Date.now(),
      createdBy: user._id,
    });

    return checkpointId;
  },
});

/**
 * Lists all checkpoints created for a fund in descending order.
 */
export const listCheckpoints = query({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.array(
    v.object({
      _id: v.id("ledgerCheckpoints"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      fundId: v.id("funds"),
      sequenceNumber: v.number(),
      entryHash: v.string(),
      balanceAtCheckpoint: v.number(),
      createdAt: v.number(),
      createdBy: v.id("users"),
      createdByName: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const checkpoints = await ctx.db
      .query("ledgerCheckpoints")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("desc")
      .take(100);

    const results = [];
    for (const cp of checkpoints) {
      const creator = await ctx.db.get("users", cp.createdBy);
      results.push({
        _id: cp._id,
        _creationTime: cp._creationTime,
        organizationId: cp.organizationId,
        fundId: cp.fundId,
        sequenceNumber: cp.sequenceNumber,
        entryHash: cp.entryHash,
        balanceAtCheckpoint: cp.balanceAtCheckpoint,
        createdAt: cp.createdAt,
        createdBy: cp.createdBy,
        createdByName: creator?.name,
      });
    }

    return results;
  },
});

/**
 * Validates a checkpoint's balance and entryHash by independently replaying the ledger from genesis.
 */
export const verifyCheckpoint = query({
  args: {
    checkpointId: v.id("ledgerCheckpoints"),
  },
  returns: v.object({
    isValid: v.boolean(),
    checkpointSequenceNumber: v.number(),
    recordedBalance: v.number(),
    recomputedBalance: v.number(),
    hashMatches: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const checkpoint = await ctx.db.get("ledgerCheckpoints", args.checkpointId);
    if (!checkpoint) {
      throw new Error("Checkpoint not found.");
    }

    await requirePermission(
      ctx,
      checkpoint.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    // Fetch all entries from genesis up to checkpoint sequenceNumber
    const entries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) =>
        q.eq("fundId", checkpoint.fundId).lte("sequenceNumber", checkpoint.sequenceNumber)
      )
      .order("asc")
      .collect();

    let recomputedBalance = 0;
    let targetEntryHash: string | null = null;

    for (const entry of entries) {
      if (entry.direction === "credit") {
        recomputedBalance += entry.amount;
      } else if (entry.direction === "debit") {
        recomputedBalance -= entry.amount;
      }
      if (entry.sequenceNumber === checkpoint.sequenceNumber) {
        targetEntryHash = entry.entryHash;
      }
    }

    const hashMatches = targetEntryHash === checkpoint.entryHash;
    const balanceMatches = recomputedBalance === checkpoint.balanceAtCheckpoint;
    const isValid = hashMatches && balanceMatches;

    let error: string | undefined;
    if (!hashMatches) {
      error = `Hash mismatch at sequence ${checkpoint.sequenceNumber}: Checkpoint has '${checkpoint.entryHash}', but ledger has '${targetEntryHash}'.`;
    } else if (!balanceMatches) {
      error = `Balance mismatch at sequence ${checkpoint.sequenceNumber}: Checkpoint recorded ${checkpoint.balanceAtCheckpoint}, but recomputed balance is ${recomputedBalance}.`;
    }

    return {
      isValid,
      checkpointSequenceNumber: checkpoint.sequenceNumber,
      recordedBalance: checkpoint.balanceAtCheckpoint,
      recomputedBalance,
      hashMatches,
      error,
    };
  },
});
