import { QueryCtx } from "../_generated/server";
import { Doc } from "../_generated/dataModel";
import {
  canonicalizeSigningPayload,
  canonicalizeEntryPayload,
  computeSha256,
  importEcdsaPublicKey,
  verifyEcdsaSignature,
} from "./helpers";

export interface ChainVerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedAt: number;
  error?: string;
  failedAtSequence?: number;
}

/**
 * Iterates through a complete series of ledger entries in ascending order and verifies:
 * 1. Sequential integer indexing from 1 to N without gaps.
 * 2. Hash chain integrity: previousHash of entry N matches entryHash of entry N-1 (or GENESIS for 1).
 * 3. Canonical hash payload integrity: entryHash matches computeSha256(canonicalizeEntryPayload).
 * 4. Digital signature validity: ECDSA P-256 signature matches canonical payload signed with registered key.
 */
export async function verifyLedgerChain(
  ctx: QueryCtx,
  fund: Doc<"funds">,
  entries: Doc<"ledgerEntries">[]
): Promise<ChainVerificationResult> {
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
      entryType: entry.entryType,
      duesEventId: entry.duesEventId,
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
}
