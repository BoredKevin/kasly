import { TestConvex } from "convex-test";
import { Id } from "../_generated/dataModel";
import {
  canonicalizeSigningPayload,
  computeKeyIdFromJwk,
  bufferToBase64url,
  SigningPayload,
} from "../treasury/helpers";

export interface TestUserContext {
  userId: Id<"users">;
  asUser: TestConvex<any>;
}

export async function createTestUser(
  t: TestConvex<any>,
  name: string,
  email: string
): Promise<TestUserContext> {
  let userId!: Id<"users">;
  await t.run(async (ctx) => {
    userId = await ctx.db.insert("users", {
      name,
      email,
      isClaimed: true,
    });
  });

  const asUser = t.withIdentity({
    name,
    email,
    subject: userId,
    tokenIdentifier: `https://auth.kasly.dev|${userId}`,
  });

  return { userId, asUser };
}

export async function generateTestKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicKeyJwk = JSON.stringify(
    await crypto.subtle.exportKey("jwk", keyPair.publicKey)
  );
  const privateKeyJwk = JSON.stringify(
    await crypto.subtle.exportKey("jwk", keyPair.privateKey)
  );
  const keyId = await computeKeyIdFromJwk(publicKeyJwk);

  return {
    keyPair,
    publicKeyJwk,
    privateKeyJwk,
    keyId,
  };
}

export async function signPayload(
  privateKey: CryptoKey,
  payload: SigningPayload
): Promise<string> {
  const canonical = canonicalizeSigningPayload(payload);
  const bytes = new TextEncoder().encode(canonical);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    bytes
  );
  return bufferToBase64url(signatureBuffer);
}
