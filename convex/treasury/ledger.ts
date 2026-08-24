import { v } from "convex/values";
import { query, mutation, MutationCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import { requirePermission } from "../authz";
import { PERMISSIONS } from "../permissions";
import {
  canonicalizeSigningPayload,
  canonicalizeEntryPayload,
  computeSha256,
  importEcdsaPublicKey,
  verifyEcdsaSignature,
  deriveFundBalance,
  generateTransferId,
} from "./helpers";

/**
 * Returns the current HEAD state (sequence number & entry hash) of a fund's ledger.
 * Treasurers query this before signing to obtain the required `previousHash` and `sequenceNumber`.
 */
export const getLatestEntry = query({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.object({
    fundId: v.id("funds"),
    organizationId: v.id("organizations"),
    isArchived: v.boolean(),
    latestSequenceNumber: v.number(),
    latestEntryHash: v.string(),
    nextSequenceNumber: v.number(),
    nextPreviousHash: v.string(),
  }),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    const latest = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("desc")
      .first();

    if (!latest) {
      return {
        fundId: fund._id,
        organizationId: fund.organizationId,
        isArchived: fund.isArchived,
        latestSequenceNumber: 0,
        latestEntryHash: "GENESIS",
        nextSequenceNumber: 1,
        nextPreviousHash: "GENESIS",
      };
    }

    // Active cryptographic verification of current HEAD
    const recomputedHeadHash = await computeSha256(
      canonicalizeEntryPayload({
        organizationId: latest.organizationId,
        fundId: latest.fundId,
        sequenceNumber: latest.sequenceNumber,
        previousHash: latest.previousHash,
        timestamp: latest.timestamp,
        direction: latest.direction as "credit" | "debit",
        amount: latest.amount,
        memo: latest.memo,
        keyId: latest.keyId,
        signerId: latest.signerId,
        signature: latest.signature,
        transferId: latest.transferId,
      })
    );

    if (recomputedHeadHash !== latest.entryHash) {
      throw new Error(
        `Ledger integrity failure: HEAD entry #${latest.sequenceNumber} hash mismatch detected. The ledger has been tampered with and is frozen.`
      );
    }

    return {
      fundId: fund._id,
      organizationId: fund.organizationId,
      isArchived: fund.isArchived,
      latestSequenceNumber: latest.sequenceNumber,
      latestEntryHash: latest.entryHash,
      nextSequenceNumber: latest.sequenceNumber + 1,
      nextPreviousHash: latest.entryHash,
    };
  },
});

/**
 * Internal helper to commit a single signed ledger entry with full verification.
 */
async function executeCommit(
  ctx: MutationCtx,
  user: Doc<"users">,
  fund: Doc<"funds">,
  args: {
    direction: "credit" | "debit";
    amount: number;
    memo: string;
    keyId: string;
    previousHash: string;
    signature: string;
    transferId?: string;
  }
) {
  if (fund.isArchived) {
    throw new Error(`Cannot commit entry: Fund '${fund.name}' is archived.`);
  }

  if (args.amount <= 0 || !Number.isInteger(args.amount)) {
    throw new Error("Invalid amount: Amount must be a positive integer in smallest currency units.");
  }

  const trimmedMemo = args.memo.trim();
  if (!trimmedMemo) {
    throw new Error("Memo cannot be empty.");
  }

  // 1. Verify key ownership & active status
  const key = await ctx.db
    .query("treasurerKeys")
    .withIndex("by_organizationId_and_keyId", (q) =>
      q.eq("organizationId", fund.organizationId).eq("keyId", args.keyId)
    )
    .first();

  if (!key) {
    throw new Error(`Signing key '${args.keyId}' is not registered for this organization.`);
  }

  if (key.revokedAt) {
    throw new Error(`Signing key '${args.keyId}' has been revoked and cannot be used for new transactions.`);
  }

  if (key.userId !== user._id) {
    throw new Error("Non-repudiation violation: Signing key does not belong to the authenticated user.");
  }

  // 2. Fetch current HEAD entry and verify its cryptographic integrity
  const latest = await ctx.db
    .query("ledgerEntries")
    .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", fund._id))
    .order("desc")
    .first();

  if (latest) {
    const recomputedHeadHash = await computeSha256(
      canonicalizeEntryPayload({
        organizationId: latest.organizationId,
        fundId: latest.fundId,
        sequenceNumber: latest.sequenceNumber,
        previousHash: latest.previousHash,
        timestamp: latest.timestamp,
        direction: latest.direction as "credit" | "debit",
        amount: latest.amount,
        memo: latest.memo,
        keyId: latest.keyId,
        signerId: latest.signerId,
        signature: latest.signature,
        transferId: latest.transferId,
      })
    );

    if (recomputedHeadHash !== latest.entryHash) {
      throw new Error(
        `Ledger integrity failure: Prior entry #${latest.sequenceNumber} has been tampered with. Expected hash '${latest.entryHash}', but calculated '${recomputedHeadHash}'. Ledger is frozen.`
      );
    }
  }

  const expectedPreviousHash = latest ? latest.entryHash : "GENESIS";
  const expectedSequenceNumber = latest ? latest.sequenceNumber + 1 : 1;

  // 3. Concurrency / fork check
  if (args.previousHash !== expectedPreviousHash) {
    throw new Error(
      `Ledger fork detected: Expected previousHash '${expectedPreviousHash}', but received '${args.previousHash}'. Please refresh ledger state.`
    );
  }

  // 4. Canonicalize signing payload and verify signature
  const signingPayloadText = canonicalizeSigningPayload({
    fundId: fund._id,
    sequenceNumber: expectedSequenceNumber,
    previousHash: expectedPreviousHash,
    direction: args.direction,
    amount: args.amount,
    memo: trimmedMemo,
    keyId: args.keyId,
  });

  const publicKey = await importEcdsaPublicKey(key.publicKeyJwk);
  const isSignatureValid = await verifyEcdsaSignature(
    publicKey,
    args.signature,
    signingPayloadText
  );

  if (!isSignatureValid) {
    throw new Error("Cryptographic verification failed: Invalid ECDSA signature over canonical payload.");
  }

  // 5. Compute server-authoritative entry hash
  const timestamp = Date.now();
  const entryPayloadText = canonicalizeEntryPayload({
    organizationId: fund.organizationId,
    fundId: fund._id,
    sequenceNumber: expectedSequenceNumber,
    previousHash: expectedPreviousHash,
    timestamp,
    direction: args.direction,
    amount: args.amount,
    memo: trimmedMemo,
    keyId: args.keyId,
    signerId: user._id,
    signature: args.signature,
    transferId: args.transferId,
  });

  const entryHash = await computeSha256(entryPayloadText);

  // 6. Append entry to ledger (Insert only — never modified or deleted)
  const entryId = await ctx.db.insert("ledgerEntries", {
    organizationId: fund.organizationId,
    fundId: fund._id,
    sequenceNumber: expectedSequenceNumber,
    previousHash: expectedPreviousHash,
    entryHash,
    timestamp,
    direction: args.direction,
    amount: args.amount,
    memo: trimmedMemo,
    keyId: args.keyId,
    signerId: user._id,
    signature: args.signature,
    transferId: args.transferId,
  });

  // 7. Auto-checkpointing every 50 entries
  if (expectedSequenceNumber % 50 === 0) {
    const currentBalance = await deriveFundBalance(ctx, fund._id);
    await ctx.db.insert("ledgerCheckpoints", {
      organizationId: fund.organizationId,
      fundId: fund._id,
      sequenceNumber: expectedSequenceNumber,
      entryHash,
      balanceAtCheckpoint: currentBalance,
      createdAt: timestamp,
      createdBy: user._id,
    });
  }

  return {
    entryId,
    sequenceNumber: expectedSequenceNumber,
    entryHash,
    timestamp,
  };
}

/**
 * Commits a cryptographically signed debit or credit entry to a fund's ledger.
 */
export const commitEntry = mutation({
  args: {
    fundId: v.id("funds"),
    direction: v.union(v.literal("credit"), v.literal("debit")),
    amount: v.number(),
    memo: v.string(),
    keyId: v.string(),
    previousHash: v.string(),
    signature: v.string(),
  },
  returns: v.object({
    entryId: v.id("ledgerEntries"),
    sequenceNumber: v.number(),
    entryHash: v.string(),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    const { user } = await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    return await executeCommit(ctx, user, fund, args);
  },
});

/**
 * Reverts a previous ledger entry by creating and appending a cryptographically signed compensating entry.
 * In an append-only ledger, entries are never modified or deleted; a compensating entry inverts the direction.
 */
export const revertEntry = mutation({
  args: {
    targetEntryId: v.id("ledgerEntries"),
    reason: v.string(),
    keyId: v.string(),
    previousHash: v.string(),
    signature: v.string(),
  },
  returns: v.object({
    entryId: v.id("ledgerEntries"),
    sequenceNumber: v.number(),
    entryHash: v.string(),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    const targetEntry = await ctx.db.get("ledgerEntries", args.targetEntryId);
    if (!targetEntry) {
      throw new Error("Target ledger entry not found.");
    }

    const fund = await ctx.db.get("funds", targetEntry.fundId);
    if (!fund) {
      throw new Error("Fund associated with the target entry not found.");
    }

    const { user } = await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    const trimmedReason = args.reason.trim();
    if (!trimmedReason) {
      throw new Error("Revert reason cannot be empty.");
    }

    // Invert the direction: credit -> debit, debit -> credit
    const compensatingDirection = targetEntry.direction === "credit" ? "debit" : "credit";
    const memo = `Revert #${targetEntry.sequenceNumber}: ${trimmedReason}`;

    return await executeCommit(ctx, user, fund, {
      direction: compensatingDirection,
      amount: targetEntry.amount,
      memo,
      keyId: args.keyId,
      previousHash: args.previousHash,
      signature: args.signature,
    });
  },
});

/**
 * Atomically transfers funds between two accounts within the same organization.
 * Commits paired debit and credit entries linked by a shared transferId.
 */
export const transfer = mutation({
  args: {
    sourceFundId: v.id("funds"),
    destinationFundId: v.id("funds"),
    amount: v.number(),
    memo: v.string(),
    keyId: v.string(),
    sourcePreviousHash: v.string(),
    sourceSignature: v.string(),
    destinationPreviousHash: v.string(),
    destinationSignature: v.string(),
  },
  returns: v.object({
    transferId: v.string(),
    sourceEntry: v.object({
      entryId: v.id("ledgerEntries"),
      sequenceNumber: v.number(),
      entryHash: v.string(),
      timestamp: v.number(),
    }),
    destinationEntry: v.object({
      entryId: v.id("ledgerEntries"),
      sequenceNumber: v.number(),
      entryHash: v.string(),
      timestamp: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    if (args.sourceFundId === args.destinationFundId) {
      throw new Error("Source and destination funds must be distinct.");
    }

    const sourceFund = await ctx.db.get("funds", args.sourceFundId);
    const destFund = await ctx.db.get("funds", args.destinationFundId);

    if (!sourceFund || !destFund) {
      throw new Error("One or both funds do not exist.");
    }

    if (sourceFund.organizationId !== destFund.organizationId) {
      throw new Error("Inter-fund transfers can only occur within the same organization.");
    }

    if (sourceFund.currency !== destFund.currency) {
      throw new Error(
        `Currency mismatch: Source fund is ${sourceFund.currency}, destination fund is ${destFund.currency}. Cross-currency transfers are not supported.`
      );
    }

    const { user } = await requirePermission(
      ctx,
      sourceFund.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    const transferId = generateTransferId();

    const sourceResult = await executeCommit(ctx, user, sourceFund, {
      direction: "debit",
      amount: args.amount,
      memo: `Transfer to ${destFund.name}: ${args.memo}`,
      keyId: args.keyId,
      previousHash: args.sourcePreviousHash,
      signature: args.sourceSignature,
      transferId,
    });

    const destResult = await executeCommit(ctx, user, destFund, {
      direction: "credit",
      amount: args.amount,
      memo: `Transfer from ${sourceFund.name}: ${args.memo}`,
      keyId: args.keyId,
      previousHash: args.destinationPreviousHash,
      signature: args.destinationSignature,
      transferId,
    });

    return {
      transferId,
      sourceEntry: sourceResult,
      destinationEntry: destResult,
    };
  },
});

/**
 * Lists ledger entries for a fund in descending order (most recent first).
 */
export const listEntries = query({
  args: {
    fundId: v.id("funds"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("ledgerEntries"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      fundId: v.id("funds"),
      sequenceNumber: v.number(),
      previousHash: v.string(),
      entryHash: v.string(),
      timestamp: v.number(),
      direction: v.string(),
      amount: v.number(),
      memo: v.string(),
      keyId: v.string(),
      signerId: v.id("users"),
      signerName: v.optional(v.string()),
      signature: v.string(),
      transferId: v.optional(v.string()),
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
      PERMISSIONS.VIEW_TREASURY
    );

    const entries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("desc")
      .take(args.limit ?? 50);

    const results = [];
    for (const entry of entries) {
      const signer = await ctx.db.get("users", entry.signerId);
      results.push({
        _id: entry._id,
        _creationTime: entry._creationTime,
        organizationId: entry.organizationId,
        fundId: entry.fundId,
        sequenceNumber: entry.sequenceNumber,
        previousHash: entry.previousHash,
        entryHash: entry.entryHash,
        timestamp: entry.timestamp,
        direction: entry.direction,
        amount: entry.amount,
        memo: entry.memo,
        keyId: entry.keyId,
        signerId: entry.signerId,
        signerName: signer?.name,
        signature: entry.signature,
        transferId: entry.transferId,
      });
    }

    return results;
  },
});

/**
 * Returns the current derived balance for a specific fund.
 */
export const getBalance = query({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.object({
    fundId: v.id("funds"),
    balance: v.number(),
    isFrozen: v.boolean(),
    integrityError: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    let balance = 0;
    let isFrozen = false;
    let integrityError: string | undefined = undefined;

    try {
      balance = await deriveFundBalance(ctx, args.fundId);
    } catch (err: unknown) {
      isFrozen = true;
      integrityError =
        err instanceof Error ? err.message : "Ledger integrity failure: Ledger is frozen.";
    }

    return {
      fundId: fund._id,
      balance,
      isFrozen,
      integrityError,
    };
  },
});

/**
 * Returns the derived balances for all active funds in an organization.
 */
export const getBalances = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      fundId: v.id("funds"),
      name: v.string(),
      currency: v.string(),
      balance: v.number(),
      isArchived: v.boolean(),
      isFrozen: v.boolean(),
      integrityError: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const funds = await ctx.db
      .query("funds")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .take(100);

    const results = [];
    for (const fund of funds) {
      let balance = 0;
      let isFrozen = false;
      let integrityError: string | undefined = undefined;

      try {
        balance = await deriveFundBalance(ctx, fund._id);
      } catch (err: unknown) {
        isFrozen = true;
        integrityError =
          err instanceof Error ? err.message : "Ledger integrity failure: Ledger is frozen.";
      }

      results.push({
        fundId: fund._id,
        name: fund.name,
        currency: fund.currency,
        balance,
        isArchived: fund.isArchived,
        isFrozen,
        integrityError,
      });
    }

    return results;
  },
});

/**
 * Full cryptographic verification of a fund's entire ledger from genesis to HEAD.
 * Validates sequence numbers, previousHash chains, entry hashes, and ECDSA signatures.
 */
export const verifyChain = query({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.object({
    isValid: v.boolean(),
    totalEntries: v.number(),
    verifiedAt: v.number(),
    error: v.optional(v.string()),
    failedAtSequence: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const entries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("asc")
      .collect();

    if (entries.length === 0) {
      return {
        isValid: true,
        totalEntries: 0,
        verifiedAt: Date.now(),
      };
    }

    // Cache imported public keys for efficient batch verification
    const publicKeyCache = new Map<string, CryptoKey>();

    let expectedPrevHash = "GENESIS";

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedSeq = i + 1;

      // 1. Verify sequence number continuity
      if (entry.sequenceNumber !== expectedSeq) {
        return {
          isValid: false,
          totalEntries: entries.length,
          verifiedAt: Date.now(),
          error: `Sequence discontinuity at entry ${entry._id}: Expected sequence ${expectedSeq}, got ${entry.sequenceNumber}`,
          failedAtSequence: entry.sequenceNumber,
        };
      }

      // 2. Verify hash chain link
      if (entry.previousHash !== expectedPrevHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          verifiedAt: Date.now(),
          error: `Broken chain link at sequence ${entry.sequenceNumber}: Expected previousHash '${expectedPrevHash}', got '${entry.previousHash}'`,
          failedAtSequence: entry.sequenceNumber,
        };
      }

      // 3. Verify entry hash integrity
      const expectedEntryPayload = canonicalizeEntryPayload({
        organizationId: entry.organizationId,
        fundId: entry.fundId,
        sequenceNumber: entry.sequenceNumber,
        previousHash: entry.previousHash,
        timestamp: entry.timestamp,
        direction: entry.direction as "credit" | "debit",
        amount: entry.amount,
        memo: entry.memo,
        keyId: entry.keyId,
        signerId: entry.signerId,
        signature: entry.signature,
        transferId: entry.transferId,
      });

      const recomputedEntryHash = await computeSha256(expectedEntryPayload);
      if (entry.entryHash !== recomputedEntryHash) {
        return {
          isValid: false,
          totalEntries: entries.length,
          verifiedAt: Date.now(),
          error: `Entry hash tampering detected at sequence ${entry.sequenceNumber}: Stored hash does not match canonical recomputed hash.`,
          failedAtSequence: entry.sequenceNumber,
        };
      }

      // 4. Verify ECDSA signature against registered key
      let cryptoKey = publicKeyCache.get(entry.keyId);
      if (!cryptoKey) {
        const keyDoc = await ctx.db
          .query("treasurerKeys")
          .withIndex("by_organizationId_and_keyId", (q) =>
            q.eq("organizationId", fund.organizationId).eq("keyId", entry.keyId)
          )
          .first();

        if (!keyDoc) {
          return {
            isValid: false,
            totalEntries: entries.length,
            verifiedAt: Date.now(),
            error: `Signing key '${entry.keyId}' referenced at sequence ${entry.sequenceNumber} not found in trusted keys registry.`,
            failedAtSequence: entry.sequenceNumber,
          };
        }

        cryptoKey = await importEcdsaPublicKey(keyDoc.publicKeyJwk);
        publicKeyCache.set(entry.keyId, cryptoKey);
      }

      const signingPayloadText = canonicalizeSigningPayload({
        fundId: entry.fundId,
        sequenceNumber: entry.sequenceNumber,
        previousHash: entry.previousHash,
        direction: entry.direction as "credit" | "debit",
        amount: entry.amount,
        memo: entry.memo,
        keyId: entry.keyId,
      });

      const isSigValid = await verifyEcdsaSignature(
        cryptoKey,
        entry.signature,
        signingPayloadText
      );

      if (!isSigValid) {
        return {
          isValid: false,
          totalEntries: entries.length,
          verifiedAt: Date.now(),
          error: `Digital signature verification failed at sequence ${entry.sequenceNumber}. Signature is invalid.`,
          failedAtSequence: entry.sequenceNumber,
        };
      }

      expectedPrevHash = entry.entryHash;
    }

    return {
      isValid: true,
      totalEntries: entries.length,
      verifiedAt: Date.now(),
    };
  },
});

/**
 * Full export of a fund's complete ledger history and audit metadata for external offline verification.
 */
export const exportLedger = query({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.object({
    exportedAt: v.number(),
    fund: v.object({
      _id: v.id("funds"),
      name: v.string(),
      description: v.optional(v.string()),
      currency: v.string(),
      organizationId: v.id("organizations"),
      isArchived: v.boolean(),
    }),
    derivedBalance: v.number(),
    checkpoints: v.array(
      v.object({
        _id: v.id("ledgerCheckpoints"),
        sequenceNumber: v.number(),
        entryHash: v.string(),
        balanceAtCheckpoint: v.number(),
        createdAt: v.number(),
      })
    ),
    keys: v.array(
      v.object({
        keyId: v.string(),
        userId: v.id("users"),
        publicKeyJwk: v.string(),
        label: v.optional(v.string()),
        registeredAt: v.number(),
        revokedAt: v.optional(v.number()),
      })
    ),
    entries: v.array(
      v.object({
        sequenceNumber: v.number(),
        previousHash: v.string(),
        entryHash: v.string(),
        timestamp: v.number(),
        direction: v.string(),
        amount: v.number(),
        memo: v.string(),
        keyId: v.string(),
        signerId: v.id("users"),
        signature: v.string(),
        transferId: v.optional(v.string()),
      })
    ),
  }),
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

    const derivedBalance = await deriveFundBalance(ctx, args.fundId);

    const entries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("asc")
      .collect();

    const checkpoints = await ctx.db
      .query("ledgerCheckpoints")
      .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", args.fundId))
      .order("asc")
      .collect();

    const keys = await ctx.db
      .query("treasurerKeys")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", fund.organizationId)
      )
      .collect();

    return {
      exportedAt: Date.now(),
      fund: {
        _id: fund._id,
        name: fund.name,
        description: fund.description,
        currency: fund.currency,
        organizationId: fund.organizationId,
        isArchived: fund.isArchived,
      },
      derivedBalance,
      checkpoints: checkpoints.map((c) => ({
        _id: c._id,
        sequenceNumber: c.sequenceNumber,
        entryHash: c.entryHash,
        balanceAtCheckpoint: c.balanceAtCheckpoint,
        createdAt: c.createdAt,
      })),
      keys: keys.map((k) => ({
        keyId: k.keyId,
        userId: k.userId,
        publicKeyJwk: k.publicKeyJwk,
        label: k.label,
        registeredAt: k.registeredAt,
        revokedAt: k.revokedAt,
      })),
      entries: entries.map((e) => ({
        sequenceNumber: e.sequenceNumber,
        previousHash: e.previousHash,
        entryHash: e.entryHash,
        timestamp: e.timestamp,
        direction: e.direction,
        amount: e.amount,
        memo: e.memo,
        keyId: e.keyId,
        signerId: e.signerId,
        signature: e.signature,
        transferId: e.transferId,
      })),
    };
  },
});
