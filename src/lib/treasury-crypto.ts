/**
 * Kasly Treasury Client Cryptography Library
 * 
 * Browser-side Web Crypto API helpers for generating ECDSA P-256 keypairs,
 * storing private keys non-extractably in IndexedDB, computing canonical payloads,
 * and producing verifiable digital signatures for treasury ledger entries.
 */

const DB_NAME = "kasly-treasury-db";
const DB_VERSION = 1;
const STORE_NAME = "treasury-keys";

/**
 * Deterministically serializes JSON with sorted keys.
 * Must match the server-side canonicalization algorithm in convex/treasury/helpers.ts.
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
 * Computes a SHA-256 digest of string data, returning lowercase hex string.
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
  const parsed = JSON.parse(jwkString);
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
 * Converts ArrayBuffer or Uint8Array to Base64URL string.
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
 * Generates an ECDSA P-256 keypair in the browser.
 * The private key is non-extractable for maximum security against XSS/exfiltration.
 */
export async function generateTreasurerKeypair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    false, // Private key is non-extractable from memory
    ["sign"]
  );
}

/**
 * Exports the public key of a keypair as a formatted JWK JSON string.
 */
export async function exportPublicKeyJwk(publicKey: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  return canonicalizeJson({
    crv: jwk.crv,
    ext: true,
    key_ops: ["verify"],
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y,
  });
}

/**
 * Signs a canonical signing payload using a non-extractable private key.
 * Produces raw 64-byte IEEE P1363 (r || s) signature in Base64URL encoding.
 */
export async function signLedgerPayload(
  privateKey: CryptoKey,
  payload: SigningPayload
): Promise<{ signature: string; canonicalPayload: string }> {
  const canonicalPayload = canonicalizeSigningPayload(payload);
  const dataBytes = new TextEncoder().encode(canonicalPayload);

  const signatureBuffer = await crypto.subtle.sign(
    {
      name: "ECDSA",
      hash: { name: "SHA-256" },
    },
    privateKey,
    dataBytes
  );

  const signature = bufferToBase64url(signatureBuffer);
  return { signature, canonicalPayload };
}

// ---------------------------------------------------------------------------
// IndexedDB Key Management for Browser-Bound Key Storage
// ---------------------------------------------------------------------------

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "keyId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          request.error?.message || "Failed to open IndexedDB database."
        )
      );
  });
}

export interface StoredKeyRecord {
  keyId: string;
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyJwk: string;
  label?: string;
  createdAt: number;
}

/**
 * Stores an active keypair securely in the browser's IndexedDB.
 */
export async function storeKeypair(
  keyId: string,
  keypair: CryptoKeyPair,
  publicKeyJwk: string,
  label?: string
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: StoredKeyRecord = {
      keyId,
      publicKey: keypair.publicKey,
      privateKey: keypair.privateKey,
      publicKeyJwk,
      label,
      createdAt: Date.now(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(
        new Error(req.error?.message || "Failed to store keypair in IndexedDB.")
      );
  });
}

/**
 * Retrieves a keypair from IndexedDB by its keyId fingerprint.
 */
export async function loadKeypair(keyId: string): Promise<StoredKeyRecord | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const req = store.get(keyId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () =>
      reject(
        new Error(req.error?.message || "Failed to load keypair from IndexedDB.")
      );
  });
}

/**
 * Lists metadata for all local keypairs stored in this browser.
 */
export async function listStoredKeys(): Promise<
  Array<{ keyId: string; label?: string; publicKeyJwk: string; createdAt: number }>
> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const req = store.getAll();
    req.onsuccess = () => {
      const records: StoredKeyRecord[] = req.result || [];
      resolve(
        records.map((r) => ({
          keyId: r.keyId,
          label: r.label,
          publicKeyJwk: r.publicKeyJwk,
          createdAt: r.createdAt,
        }))
      );
    };
    req.onerror = () =>
      reject(
        new Error(
          req.error?.message || "Failed to list stored keys from IndexedDB."
        )
      );
  });
}

/**
 * Removes a keypair from local IndexedDB storage.
 */
export async function deleteStoredKey(keyId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const req = store.delete(keyId);
    req.onsuccess = () => resolve();
    req.onerror = () =>
      reject(
        new Error(
          req.error?.message || "Failed to delete keypair from IndexedDB."
        )
      );
  });
}
