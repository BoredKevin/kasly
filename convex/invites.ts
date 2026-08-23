import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireUser,
  requirePermission,
  assertCanManageRole,
} from "./authz";
import { PERMISSIONS } from "./permissions";

/**
 * Generates a cryptographically secure random alphanumeric invite code (CSPRNG).
 */
function generateInviteCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(randomBytes[i] % chars.length);
  }
  return code;
}

/**
 * Creates an invite link for an organization.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    maxUses: v.optional(v.number()),
    expiresInMs: v.optional(v.number()),
    roleIds: v.optional(v.array(v.id("roles"))),
  },
  returns: v.object({
    code: v.string(),
    inviteId: v.id("invites"),
  }),
  handler: async (ctx, args) => {
    const { user, organization, member } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.CREATE_INVITES,
    );

    // If roles are attached to invite, check MANAGE_ROLES and hierarchy
    if (args.roleIds && args.roleIds.length > 0) {
      await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.MANAGE_ROLES,
      );

      for (const roleId of args.roleIds) {
        const role = await ctx.db.get("roles", roleId);
        if (!role || role.organizationId !== args.organizationId) {
          throw new Error(`Role ${roleId} not found in this organization.`);
        }
        await assertCanManageRole(ctx, organization, member, role.position);
      }
    }

    const code = generateInviteCode();
    const expiresAt = args.expiresInMs
      ? Date.now() + args.expiresInMs
      : undefined;

    const inviteId = await ctx.db.insert("invites", {
      organizationId: args.organizationId,
      code,
      inviterId: user._id,
      maxUses: args.maxUses,
      uses: 0,
      expiresAt,
      roleIds: args.roleIds,
    });

    return { code, inviteId };
  },
});

/**
 * Retrieves public information for an invite link so users can preview the organization.
 */
export const get = query({
  args: {
    code: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      code: v.string(),
      organizationId: v.id("organizations"),
      organizationName: v.string(),
      organizationDescription: v.optional(v.string()),
      iconUrl: v.optional(v.string()),
      inviterName: v.optional(v.string()),
      maxUses: v.optional(v.number()),
      uses: v.number(),
      expiresAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invite) {
      return null;
    }

    const org = await ctx.db.get("organizations", invite.organizationId);
    if (!org) {
      return null;
    }

    const inviter = await ctx.db.get("users", invite.inviterId);

    return {
      code: invite.code,
      organizationId: invite.organizationId,
      organizationName: org.name,
      organizationDescription: org.description,
      iconUrl: org.iconUrl,
      inviterName: inviter?.name,
      maxUses: invite.maxUses,
      uses: invite.uses,
      expiresAt: invite.expiresAt,
    };
  },
});

/**
 * Lists active invites for an organization.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("invites"),
      _creationTime: v.number(),
      code: v.string(),
      organizationId: v.id("organizations"),
      inviterId: v.id("users"),
      inviterName: v.optional(v.string()),
      uses: v.number(),
      maxUses: v.optional(v.number()),
      expiresAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_INVITES,
    );

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100);

    const results = [];
    for (const inv of invites) {
      const inviter = await ctx.db.get("users", inv.inviterId);
      results.push({
        _id: inv._id,
        _creationTime: inv._creationTime,
        code: inv.code,
        organizationId: inv.organizationId,
        inviterId: inv.inviterId,
        inviterName: inviter?.name,
        uses: inv.uses,
        maxUses: inv.maxUses,
        expiresAt: inv.expiresAt,
      });
    }

    return results;
  },
});

/**
 * Revokes an invite code.
 */
export const revoke = mutation({
  args: {
    inviteId: v.id("invites"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const invite = await ctx.db.get("invites", args.inviteId);
    if (!invite) {
      throw new Error("Invite not found.");
    }

    // Inviter can always revoke their own invite, otherwise MANAGE_INVITES permission required
    if (invite.inviterId !== user._id) {
      await requirePermission(
        ctx,
        invite.organizationId,
        PERMISSIONS.MANAGE_INVITES,
      );
    }

    await ctx.db.delete("invites", args.inviteId);
    return null;
  },
});

/**
 * Accepts an invite code to join an organization.
 */
export const accept = mutation({
  args: {
    code: v.string(),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    alreadyMember: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (!invite) {
      throw new Error("Invite not found or invalid.");
    }

    // Check expiration
    if (invite.expiresAt && Date.now() > invite.expiresAt) {
      throw new Error("This invite has expired.");
    }

    // Check max uses
    if (invite.maxUses !== undefined && invite.uses >= invite.maxUses) {
      throw new Error("This invite has reached its maximum number of uses.");
    }

    // Check if user is banned from this organization
    const ban = await ctx.db
      .query("bans")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", invite.organizationId).eq("userId", user._id),
      )
      .unique();

    if (ban) {
      throw new Error("Forbidden: You are banned from this organization.");
    }

    // Check if already a member
    const existingMember = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", invite.organizationId).eq("userId", user._id),
      )
      .unique();

    if (existingMember) {
      return {
        organizationId: invite.organizationId,
        alreadyMember: true,
      };
    }

    // Insert new member with any granted roles
    const assignedRoleIds = invite.roleIds ?? [];
    await ctx.db.insert("members", {
      organizationId: invite.organizationId,
      userId: user._id,
      roleIds: assignedRoleIds,
      joinedAt: Date.now(),
    });

    // Increment invite usage
    await ctx.db.patch("invites", invite._id, {
      uses: invite.uses + 1,
    });

    return {
      organizationId: invite.organizationId,
      alreadyMember: false,
    };
  },
});
