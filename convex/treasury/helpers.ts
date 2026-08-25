import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Deterministically serialize any JSON-compatible value with sorted keys.
 * Ensures consistent cryptographic hashing across different client platforms.
 */
export function canonicalizeJson(val: unknown): string {
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    return "[" + val.map((item) => canonicalizeJson(item)).join(",") + "]";
  }

  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => JSON.stringify(k) + ":" + canonicalizeJson(obj[k]));

  return "{" + entries.join(",") + "}";
}

/**
 * Canonical payload representation for treasurer signature verification.
 * The treasurer signs this exact string before submitting an entry.
 */
export interface SigningPayload {
  fundId: string;
  sequenceNumber: number;
  previousHash: string;
  direction: "credit" | "debit";
  amount: number;
  memo: string;
  keyId: string;
}

export function canonicalizeSigningPayload(payload: SigningPayload): string {
  return canonicalizeJson({
    amount: payload.amount,
    direction: payload.direction,
    fundId: payload.fundId,
    keyId: payload.keyId,
    memo: payload.memo,
    previousHash: payload.previousHash,
    sequenceNumber: payload.sequenceNumber,
  });
}

/**
 * Canonical payload for the full ledger entry hash (chain linkage).
 * Includes the server-authoritative timestamp, signer identity, and signature.
 */
export interface EntryHashPayload {
  organizationId: string;
  fundId: string;
  sequenceNumber: number;
  previousHash: string;
  timestamp: number;
  direction: "credit" | "debit";
  amount: number;
  memo: string;
  keyId: string;
  signerId: string;
  signature: string;
  transferId?: string;
  entryType?: string;
  duesEventId?: string;
}

export function canonicalizeEntryPayload(payload: EntryHashPayload): string {
  return canonicalizeJson({
    amount: payload.amount,
    direction: payload.direction,
    duesEventId: payload.duesEventId ?? undefined,
    entryType: payload.entryType ?? undefined,
    fundId: payload.fundId,
    keyId: payload.keyId,
    memo: payload.memo,
    organizationId: payload.organizationId,
    previousHash: payload.previousHash,
    sequenceNumber: payload.sequenceNumber,
    signature: payload.signature,
    signerId: payload.signerId,
    timestamp: payload.timestamp,
    transferId: payload.transferId ?? undefined,
  });
}


/**
 * Computes a SHA-256 digest of string data or bytes, returned as a lowercase hex string.
 */
export async function computeSha256(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Derives a 16-character hex fingerprint (keyId) from an ECDSA public key JWK.
 */
export async function computeKeyIdFromJwk(jwkString: string): Promise<string> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jwkString);
  } catch {
    throw new Error("Invalid JWK string: Failed to parse JSON.");
  }

  // Extract standard EC public key parameters
  const canonicalJwk = canonicalizeJson({
    crv: parsed.crv,
    kty: parsed.kty,
    x: parsed.x,
    y: parsed.y,
  });

  const fullHash = await computeSha256(canonicalJwk);
  return fullHash.slice(0, 16);
}

/**
 * Converts a Base64URL string to an ArrayBuffer.
 */
export function base64urlToBuffer(b64url: string): ArrayBuffer {
  // Convert base64url to base64
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) {
    b64 += "=";
  }

  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts an ArrayBuffer or Uint8Array to a Base64URL string.
 */
export function bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Imports an ECDSA P-256 public key from a JWK JSON string into a Web Crypto CryptoKey.
 */
export async function importEcdsaPublicKey(jwkString: string): Promise<CryptoKey> {
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(jwkString);
  } catch {
    throw new Error("Invalid JWK: Unable to parse JSON.");
  }

  if (jwk.kty !== "EC" || jwk.crv !== "P-256") {
    throw new Error("Unsupported key type: Only ECDSA with curve P-256 is supported.");
  }

  return await crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["verify"]
  );
}

/**
 * Verifies an ECDSA P-256 SHA-256 signature against a raw text payload.
 * Expects the signature to be raw 64-byte IEEE P1363 (r || s) in Base64URL encoding.
 */
export async function verifyEcdsaSignature(
  publicKey: CryptoKey,
  signatureBase64Url: string,
  payloadText: string
): Promise<boolean> {
  try {
    const signatureBuffer = base64urlToBuffer(signatureBase64Url);
    const dataBuffer = new TextEncoder().encode(payloadText);

    return await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
      },
      publicKey,
      signatureBuffer,
      dataBuffer
    );
  } catch (err) {
    console.error("Signature verification exception:", err);
    return false;
  }
}

/**
 * Generates a unique UUID string for linking paired debit/credit transfer transactions.
 */
export function generateTransferId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Derives the exact balance of a fund by starting at the closest checkpoint
 * and replaying subsequent ledger entries up to HEAD.
 * Returns balance in the smallest currency unit (e.g. integer cents or IDR).
 */
export async function deriveFundBalance(
  ctx: QueryCtx | MutationCtx,
  fundId: Id<"funds">
): Promise<number> {
  // 1. Look for the latest checkpoint for this fund
  const latestCheckpoint = await ctx.db
    .query("ledgerCheckpoints")
    .withIndex("by_fundId_and_sequenceNumber", (q) => q.eq("fundId", fundId))
    .order("desc")
    .first();

  let balance = latestCheckpoint ? latestCheckpoint.balanceAtCheckpoint : 0;
  const startSeq = latestCheckpoint ? latestCheckpoint.sequenceNumber + 1 : 1;
  let expectedPrevHash = latestCheckpoint ? latestCheckpoint.entryHash : "GENESIS";

  // 2. Fetch and replay all entries strictly after the checkpoint with active cryptographic verification
  const subsequentEntries = await ctx.db
    .query("ledgerEntries")
    .withIndex("by_fundId_and_sequenceNumber", (q) =>
      q.eq("fundId", fundId).gte("sequenceNumber", startSeq)
    )
    .order("asc")
    .collect();

  for (const entry of subsequentEntries) {
    // Recompute entry SHA-256 hash to detect unauthorized database tampering
    const recomputedHash = await computeSha256(
      canonicalizeEntryPayload({
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
      })
    );

    if (recomputedHash !== entry.entryHash) {
      throw new Error(
        `Ledger integrity failure: Tampered entry detected at sequence #${entry.sequenceNumber}. Hash mismatch detected (stored '${entry.entryHash.slice(0, 10)}...' vs calculated '${recomputedHash.slice(0, 10)}...'). Ledger is frozen.`
      );
    }

    if (entry.previousHash !== expectedPrevHash) {
      throw new Error(
        `Ledger integrity failure: Broken chain link at sequence #${entry.sequenceNumber}. Expected previousHash '${expectedPrevHash.slice(0, 10)}...', but found '${entry.previousHash.slice(0, 10)}...'. Ledger is frozen.`
      );
    }

    expectedPrevHash = entry.entryHash;

    if (entry.direction === "credit") {
      balance += entry.amount;
    } else if (entry.direction === "debit") {
      balance -= entry.amount;
    }
  }

  return balance;
}

/**
 * Calculates the next trigger timestamp based on schedule type and value.
 * intervalType: "weekly" | "monthly" | "custom_days"
 * intervalValue:
 *   - weekly: 0 (Sunday) to 6 (Saturday)
 *   - monthly: 1 to 28 (day of month)
 *   - custom_days: integer >= 1 (every N days)
 */
export function computeNextFireTime(
  intervalType: "weekly" | "monthly" | "custom_days",
  intervalValue: number,
  fromDate: Date = new Date()
): number {
  const next = new Date(fromDate.getTime());

  if (intervalType === "weekly") {
    const targetDay = Math.min(Math.max(0, Math.floor(intervalValue)), 6);
    const currentDay = next.getDay();
    let daysAhead = (targetDay - currentDay + 7) % 7;
    if (daysAhead === 0) {
      daysAhead = 7; // schedule for next week if today
    }
    next.setDate(next.getDate() + daysAhead);
    next.setHours(0, 0, 0, 0);
  } else if (intervalType === "monthly") {
    const targetDate = Math.min(Math.max(1, Math.floor(intervalValue)), 28);
    if (next.getDate() < targetDate) {
      next.setDate(targetDate);
    } else {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDate);
    }
    next.setHours(0, 0, 0, 0);
  } else if (intervalType === "custom_days") {
    const days = Math.max(1, Math.floor(intervalValue));
    next.setDate(next.getDate() + days);
    next.setHours(0, 0, 0, 0);
  }

  return next.getTime();
}

/**
 * Generates a human-friendly period label for a dues cycle given date & interval type.
 */
export function generatePeriodLabel(
  intervalType: "weekly" | "monthly" | "custom_days",
  date: Date = new Date()
): string {
  if (intervalType === "monthly") {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else if (intervalType === "weekly") {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `Week ${weekNumber}, ${date.getFullYear()}`;
  } else {
    return `Cycle of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }
}

/**
 * Computes the date (Thursday / midpoint) corresponding to an ISO week number in a given year.
 */
export function getDateFromIsoWeek(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const firstMonday = new Date(jan4.getTime() - jan4Day * 86400000);
  const targetThursday = new Date(firstMonday.getTime() + ((weekNumber - 1) * 7 + 3) * 86400000);
  targetThursday.setHours(12, 0, 0, 0);
  return targetThursday;
}

