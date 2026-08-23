import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getCurrentUser, requireUser } from "./authz";

/**
 * Converts an ArrayBuffer or Uint8Array to a lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a salted SHA-256 hash for a 10-digit NISN string.
 * Output format: v1$<salt_hex>$<hash_hex>
 */
async function hashNisn(rawNisn: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const saltHex = bufferToHex(saltBytes);

  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltHex}:${rawNisn}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = bufferToHex(hashBuffer);

  return `v1$${saltHex}$${hashHex}`;
}

/**
 * Verifies a raw 10-digit NISN candidate against a stored salted hash.
 */
async function verifyNisnHash(
  rawNisn: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return false;
  }

  const saltHex = parts[1];
  const expectedHashHex = parts[2];

  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltHex}:${rawNisn}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const calculatedHashHex = bufferToHex(hashBuffer);

  return calculatedHashHex === expectedHashHex;
}

/**
 * Validates that a candidate NISN is strictly a 10-character numeric string.
 */
function validateNisnFormat(nisn: string): boolean {
  return /^\d{10}$/.test(nisn);
}

/**
 * Returns the current authenticated user's NISN configuration & encryption status.
 * Note: Never returns the raw or hashed NISN value to the client.
 */
export const getStatus = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      enabled: v.boolean(),
      isSet: v.boolean(),
      encryptionStatus: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const nisnSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enableNISN"))
      .unique();

    const isFeatureEnabled = nisnSetting !== null ? nisnSetting.value : true;

    if (!isFeatureEnabled) {
      return {
        enabled: false,
        isSet: Boolean(user.nisn),
        encryptionStatus: "Feature Disabled in App Settings",
      };
    }

    const isSet = Boolean(user.nisn && user.nisn.trim().length > 0);

    return {
      enabled: true,
      isSet,
      encryptionStatus: isSet
        ? "SHA-256 Salted Cryptographic Hash (Immutable)"
        : "Not Configured",
    };
  },
});

/**
 * Verifies a candidate 10-digit NISN provided by the authenticated user against their stored hash.
 */
export const verify = mutation({
  args: {
    nisn: v.string(),
  },
  returns: v.object({
    verified: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const nisnSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enableNISN"))
      .unique();

    const isFeatureEnabled = nisnSetting !== null ? nisnSetting.value : true;
    if (!isFeatureEnabled) {
      throw new Error(
        "NISN verification is currently disabled in application settings.",
      );
    }

    const trimmedNisn = args.nisn.trim();
    if (!validateNisnFormat(trimmedNisn)) {
      throw new Error(
        "Invalid NISN format. NISN must be exactly 10 numeric digits.",
      );
    }

    if (!user.nisn) {
      throw new Error(
        "No NISN has been configured for your account. Please contact an administrator.",
      );
    }

    const isMatch = await verifyNisnHash(trimmedNisn, user.nisn);

    if (!isMatch) {
      return {
        verified: false,
        message: "Verification failed: The provided NISN is incorrect.",
      };
    }

    return {
      verified: true,
      message: "Verification successful: NISN identity confirmed.",
    };
  },
});

/**
 * Internal mutation to provision or update a user's NISN for testing and administrative purposes.
 * Encrypts and hashes the raw 10-digit NISN with CSPRNG salt before storing.
 */
export const setInternal = internalMutation({
  args: {
    userId: v.id("users"),
    nisn: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new Error(`User with ID ${args.userId} was not found.`);
    }

    const trimmedNisn = args.nisn.trim();
    if (!validateNisnFormat(trimmedNisn)) {
      throw new Error(
        "Invalid NISN format: NISN must be exactly 10 numeric digits.",
      );
    }

    const hashedNisn = await hashNisn(trimmedNisn);

    await ctx.db.patch("users", user._id, {
      nisn: hashedNisn,
    });

    return {
      success: true,
      userId: user._id,
    };
  },
});

/**
 * Internal mutation to clear a user's NISN for testing purposes.
 */
export const clearInternal = internalMutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new Error(`User with ID ${args.userId} was not found.`);
    }

    await ctx.db.patch("users", user._id, {
      nisn: undefined,
    });

    return {
      success: true,
    };
  },
});
