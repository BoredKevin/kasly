import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requirePermission } from "../authz";
import { PERMISSIONS } from "../permissions";
import { computeKeyIdFromJwk, importEcdsaPublicKey } from "./helpers";

/**
 * Initiates a zero-trust key registration request for a treasurer's browser-generated public key.
 * Places the key into a pending state awaiting administrator approval.
 */
export const requestKeyRegistration = mutation({
  args: {
    organizationId: v.id("organizations"),
    publicKeyJwk: v.string(),
    label: v.optional(v.string()),
  },
  returns: v.string(), // Returns derived keyId
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    // Validate that JWK is structurally valid and can be imported as ECDSA P-256
    try {
      await importEcdsaPublicKey(args.publicKeyJwk);
    } catch (e: any) {
      throw new Error(`Invalid public key: ${e.message || "Failed to parse ECDSA P-256 key"}`);
    }

    const keyId = await computeKeyIdFromJwk(args.publicKeyJwk);

    // Check if key is already active in this organization
    const existingActiveKey = await ctx.db
      .query("treasurerKeys")
      .withIndex("by_organizationId_and_keyId", (q) =>
        q.eq("organizationId", args.organizationId).eq("keyId", keyId)
      )
      .first();

    if (existingActiveKey) {
      if (!existingActiveKey.revokedAt) {
        throw new Error("This public key is already registered and active for this organization.");
      } else {
        throw new Error("This public key was previously revoked and cannot be re-registered. Please generate a new keypair.");
      }
    }

    // Check if there is already a pending request for this key
    const existingPending = await ctx.db
      .query("pendingKeys")
      .withIndex("by_organizationId_and_keyId", (q) =>
        q.eq("organizationId", args.organizationId).eq("keyId", keyId)
      )
      .first();

    if (existingPending && existingPending.status === "pending") {
      throw new Error("A pending registration request already exists for this public key.");
    }

    await ctx.db.insert("pendingKeys", {
      organizationId: args.organizationId,
      userId: user._id,
      publicKeyJwk: args.publicKeyJwk,
      keyId,
      label: args.label?.trim() || undefined,
      requestedAt: Date.now(),
      status: "pending",
    });

    return keyId;
  },
});

/**
 * Lists all pending key registration requests awaiting admin review.
 */
export const listPendingKeys = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("pendingKeys"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      userName: v.optional(v.string()),
      userEmail: v.optional(v.string()),
      keyId: v.string(),
      publicKeyJwk: v.string(),
      label: v.optional(v.string()),
      requestedAt: v.number(),
      status: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const pending = await ctx.db
      .query("pendingKeys")
      .withIndex("by_organizationId_and_status", (q) =>
        q.eq("organizationId", args.organizationId).eq("status", "pending")
      )
      .take(100);

    const results = [];
    for (const item of pending) {
      const user = await ctx.db.get("users", item.userId);
      results.push({
        _id: item._id,
        _creationTime: item._creationTime,
        organizationId: item.organizationId,
        userId: item.userId,
        userName: user?.name,
        userEmail: user?.email,
        keyId: item.keyId,
        publicKeyJwk: item.publicKeyJwk,
        label: item.label,
        requestedAt: item.requestedAt,
        status: item.status,
      });
    }

    return results;
  },
});

/**
 * Approves a pending public key registration request, enabling the key to sign transactions.
 */
export const approveKey = mutation({
  args: {
    pendingKeyId: v.id("pendingKeys"),
  },
  returns: v.string(), // Returns keyId
  handler: async (ctx, args) => {
    const pendingKey = await ctx.db.get("pendingKeys", args.pendingKeyId);
    if (!pendingKey) {
      throw new Error("Pending key request not found.");
    }

    const { user } = await requirePermission(
      ctx,
      pendingKey.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (pendingKey.status !== "pending") {
      throw new Error(`Cannot approve request: Current status is '${pendingKey.status}'.`);
    }

    // Mark pending request as approved
    await ctx.db.patch("pendingKeys", args.pendingKeyId, {
      status: "approved",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
    });

    // Add to trusted treasurer keys table
    await ctx.db.insert("treasurerKeys", {
      organizationId: pendingKey.organizationId,
      userId: pendingKey.userId,
      publicKeyJwk: pendingKey.publicKeyJwk,
      keyId: pendingKey.keyId,
      label: pendingKey.label,
      registeredAt: Date.now(),
      registeredBy: user._id,
    });

    return pendingKey.keyId;
  },
});

/**
 * Rejects a pending public key registration request.
 */
export const rejectKey = mutation({
  args: {
    pendingKeyId: v.id("pendingKeys"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const pendingKey = await ctx.db.get("pendingKeys", args.pendingKeyId);
    if (!pendingKey) {
      throw new Error("Pending key request not found.");
    }

    const { user } = await requirePermission(
      ctx,
      pendingKey.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (pendingKey.status !== "pending") {
      throw new Error(`Cannot reject request: Current status is '${pendingKey.status}'.`);
    }

    await ctx.db.patch("pendingKeys", args.pendingKeyId, {
      status: "rejected",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Revokes an active public key. Historical transactions signed by this key remain valid,
 * but no new ledger entries signed by this key will be accepted.
 */
export const revokeKey = mutation({
  args: {
    treasurerKeyId: v.id("treasurerKeys"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = await ctx.db.get("treasurerKeys", args.treasurerKeyId);
    if (!key) {
      throw new Error("Treasurer key not found.");
    }

    await requirePermission(
      ctx,
      key.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (key.revokedAt) {
      return null; // Already revoked
    }

    await ctx.db.patch("treasurerKeys", args.treasurerKeyId, {
      revokedAt: Date.now(),
    });

    return null;
  },
});

/**
 * Lists all registered keys (both active and revoked) in the organization.
 */
export const listActiveKeys = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("treasurerKeys"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      userName: v.optional(v.string()),
      userEmail: v.optional(v.string()),
      keyId: v.string(),
      publicKeyJwk: v.string(),
      label: v.optional(v.string()),
      registeredAt: v.number(),
      registeredBy: v.id("users"),
      registeredByName: v.optional(v.string()),
      revokedAt: v.optional(v.number()),
      isRevoked: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const keys = await ctx.db
      .query("treasurerKeys")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .take(200);

    const results = [];
    for (const k of keys) {
      const user = await ctx.db.get("users", k.userId);
      const regUser = await ctx.db.get("users", k.registeredBy);
      results.push({
        _id: k._id,
        _creationTime: k._creationTime,
        organizationId: k.organizationId,
        userId: k.userId,
        userName: user?.name,
        userEmail: user?.email,
        keyId: k.keyId,
        publicKeyJwk: k.publicKeyJwk,
        label: k.label,
        registeredAt: k.registeredAt,
        registeredBy: k.registeredBy,
        registeredByName: regUser?.name,
        revokedAt: k.revokedAt,
        isRevoked: k.revokedAt !== undefined,
      });
    }

    return results;
  },
});

/**
 * Retrieves the registered public keys associated with the currently authenticated user.
 */
export const getMyKeys = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("treasurerKeys"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      keyId: v.string(),
      publicKeyJwk: v.string(),
      label: v.optional(v.string()),
      registeredAt: v.number(),
      revokedAt: v.optional(v.number()),
      isRevoked: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    const keys = await ctx.db
      .query("treasurerKeys")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id)
      )
      .take(100);

    return keys.map((k) => ({
      _id: k._id,
      _creationTime: k._creationTime,
      organizationId: k.organizationId,
      userId: k.userId,
      keyId: k.keyId,
      publicKeyJwk: k.publicKeyJwk,
      label: k.label,
      registeredAt: k.registeredAt,
      revokedAt: k.revokedAt,
      isRevoked: k.revokedAt !== undefined,
    }));
  },
});
