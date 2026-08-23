import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireUser,
  requireMember,
  requirePermission,
  resolveMemberPermissions,
  getHighestRolePosition,
  assertCanManageTargetMember,
  assertCanManageRole,
} from "./authz";
import { PERMISSIONS } from "./permissions";

/**
 * Lists members of an organization with attached role information.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("members"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      nickname: v.optional(v.string()),
      joinedAt: v.number(),
      roles: v.array(
        v.object({
          _id: v.id("roles"),
          name: v.string(),
          color: v.optional(v.string()),
          position: v.number(),
        }),
      ),
      isOwner: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const { user: callerUser, organization, permissions: callerPerms } =
      await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.VIEW_ORGANIZATION,
      );

    const canViewEmails =
      callerPerms.has(PERMISSIONS.ADMINISTRATOR) ||
      callerPerms.has(PERMISSIONS.VIEW_EMAILS) ||
      organization.ownerId === callerUser._id;

    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(args.limit ?? 100);

    const results = [];
    for (const member of members) {
      const user = await ctx.db.get("users", member.userId);
      const roles = (
        await Promise.all(
          member.roleIds.map((roleId) => ctx.db.get("roles", roleId)),
        )
      )
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => b.position - a.position);

      const shouldExposeEmail = canViewEmails || member.userId === callerUser._id;

      results.push({
        _id: member._id,
        _creationTime: member._creationTime,
        organizationId: member.organizationId,
        userId: member.userId,
        email: shouldExposeEmail ? user?.email : undefined,
        name: user?.name,
        nickname: member.nickname,
        joinedAt: member.joinedAt,
        roles: roles.map((r) => ({
          _id: r._id,
          name: r.name,
          color: r.color,
          position: r.position,
        })),
        isOwner: member.userId === organization.ownerId,
      });
    }

    return results;
  },
});

/**
 * Retrieves a specific member's profile and permissions in an organization.
 */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("members"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      nickname: v.optional(v.string()),
      joinedAt: v.number(),
      roles: v.array(
        v.object({
          _id: v.id("roles"),
          name: v.string(),
          color: v.optional(v.string()),
          position: v.number(),
        }),
      ),
      permissions: v.array(v.string()),
      isOwner: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const { user: callerUser, organization, permissions: callerPerms } =
      await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.VIEW_ORGANIZATION,
      );

    const canViewEmails =
      callerPerms.has(PERMISSIONS.ADMINISTRATOR) ||
      callerPerms.has(PERMISSIONS.VIEW_EMAILS) ||
      organization.ownerId === callerUser._id;

    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();

    if (!member) {
      return null;
    }

    const user = await ctx.db.get("users", member.userId);
    const roles = (
      await Promise.all(
        member.roleIds.map((roleId) => ctx.db.get("roles", roleId)),
      )
    )
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.position - a.position);

    const perms = await resolveMemberPermissions(ctx, organization, member);
    const shouldExposeEmail = canViewEmails || member.userId === callerUser._id;

    return {
      _id: member._id,
      _creationTime: member._creationTime,
      organizationId: member.organizationId,
      userId: member.userId,
      email: shouldExposeEmail ? user?.email : undefined,
      name: user?.name,
      nickname: member.nickname,
      joinedAt: member.joinedAt,
      roles: roles.map((r) => ({
        _id: r._id,
        name: r.name,
        color: r.color,
        position: r.position,
      })),
      permissions: Array.from(perms),
      isOwner: member.userId === organization.ownerId,
    };
  },
});

/**
 * Returns the current authenticated user's membership and permission set.
 */
export const getMyMembership = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("members"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      nickname: v.optional(v.string()),
      joinedAt: v.number(),
      roles: v.array(
        v.object({
          _id: v.id("roles"),
          name: v.string(),
          color: v.optional(v.string()),
          position: v.number(),
        }),
      ),
      permissions: v.array(v.string()),
      isOwner: v.boolean(),
      highestRolePosition: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      return null;
    }

    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", user._id),
      )
      .unique();

    if (!member) {
      return null;
    }

    const roles = (
      await Promise.all(
        member.roleIds.map((roleId) => ctx.db.get("roles", roleId)),
      )
    )
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.position - a.position);

    const perms = await resolveMemberPermissions(ctx, organization, member);
    const highestPos = await getHighestRolePosition(
      ctx,
      organization,
      member,
    );

    return {
      _id: member._id,
      _creationTime: member._creationTime,
      organizationId: member.organizationId,
      userId: member.userId,
      nickname: member.nickname,
      joinedAt: member.joinedAt,
      roles: roles.map((r) => ({
        _id: r._id,
        name: r.name,
        color: r.color,
        position: r.position,
      })),
      permissions: Array.from(perms),
      isOwner: member.userId === organization.ownerId,
      highestRolePosition: highestPos === Infinity ? 999999 : highestPos,
    };
  },
});

/**
 * Updates a member's nickname (self or via MANAGE_MEMBERS with hierarchy check).
 */
export const updateNickname = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetUserId: v.id("users"),
    nickname: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      throw new Error("Organization not found.");
    }

    const targetMember = await requireMember(
      ctx,
      args.organizationId,
      args.targetUserId,
    );

    if (user._id === args.targetUserId) {
      // Modifying self nickname
      await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.VIEW_ORGANIZATION,
      );
    } else {
      // Modifying someone else's nickname requires MANAGE_MEMBERS and hierarchy authority
      const { member: actorMember } = await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.MANAGE_MEMBERS,
      );
      await assertCanManageTargetMember(
        ctx,
        organization,
        actorMember,
        targetMember,
      );
    }

    await ctx.db.patch("members", targetMember._id, {
      nickname: args.nickname,
    });

    return null;
  },
});

/**
 * Assigns or replaces roles for a member, enforcing Discord-style role hierarchy.
 */
export const assignRoles = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetUserId: v.id("users"),
    roleIds: v.array(v.id("roles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization, member: actorMember } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_ROLES,
    );

    const targetMember = await requireMember(
      ctx,
      args.organizationId,
      args.targetUserId,
    );

    // Actor must be higher in hierarchy than target member
    await assertCanManageTargetMember(
      ctx,
      organization,
      actorMember,
      targetMember,
    );

    // Validate all assigned roles
    const currentRoleSet = new Set(targetMember.roleIds);
    const newRoleSet = new Set(args.roleIds);

    // Roles being added or removed
    const changedRoleIds = [
      ...args.roleIds.filter((id) => !currentRoleSet.has(id)),
      ...targetMember.roleIds.filter((id) => !newRoleSet.has(id)),
    ];

    for (const roleId of changedRoleIds) {
      const role = await ctx.db.get("roles", roleId);
      if (!role || role.organizationId !== args.organizationId) {
        throw new Error(`Role ${roleId} does not exist in this organization.`);
      }
      if (role.isDefault) {
        throw new Error(
          "Forbidden: Default @everyone role is automatically assigned and cannot be modified directly.",
        );
      }
      // Hierarchy check: Actor cannot grant/revoke roles with position >= their own highest role
      await assertCanManageRole(ctx, organization, actorMember, role.position);
    }

    await ctx.db.patch("members", targetMember._id, {
      roleIds: args.roleIds,
    });

    return null;
  },
});

/**
 * Kicks a member from the organization with Discord-style hierarchy check.
 */
export const kick = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization, member: actorMember } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.KICK_MEMBERS,
    );

    const targetMember = await requireMember(
      ctx,
      args.organizationId,
      args.targetUserId,
    );

    await assertCanManageTargetMember(
      ctx,
      organization,
      actorMember,
      targetMember,
    );

    await ctx.db.delete("members", targetMember._id);
    return null;
  },
});

/**
 * Bans a member from the organization with Discord-style hierarchy check.
 */
export const ban = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetUserId: v.id("users"),
    reason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user: actorUser, organization, member: actorMember } =
      await requirePermission(
        ctx,
        args.organizationId,
        PERMISSIONS.BAN_MEMBERS,
      );

    if (args.targetUserId === organization.ownerId) {
      throw new Error(
        "Forbidden: Cannot ban the organization owner.",
      );
    }

    // Check if target is currently a member
    const targetMember = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId),
      )
      .unique();

    if (targetMember) {
      await assertCanManageTargetMember(
        ctx,
        organization,
        actorMember,
        targetMember,
      );
      // Remove member from organization
      await ctx.db.delete("members", targetMember._id);
    }

    // Check if already banned
    const existingBan = await ctx.db
      .query("bans")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId),
      )
      .unique();

    if (existingBan) {
      await ctx.db.patch("bans", existingBan._id, {
        reason: args.reason,
        bannedBy: actorUser._id,
        bannedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("bans", {
        organizationId: args.organizationId,
        userId: args.targetUserId,
        reason: args.reason,
        bannedBy: actorUser._id,
        bannedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Unbans a user from the organization.
 */
export const unban = mutation({
  args: {
    organizationId: v.id("organizations"),
    targetUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.BAN_MEMBERS,
    );

    const banRecord = await ctx.db
      .query("bans")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.targetUserId),
      )
      .unique();

    if (banRecord) {
      await ctx.db.delete("bans", banRecord._id);
    }

    return null;
  },
});

/**
 * Lists all banned users for an organization.
 */
export const listBans = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("bans"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      userId: v.id("users"),
      userEmail: v.optional(v.string()),
      userName: v.optional(v.string()),
      reason: v.optional(v.string()),
      bannedBy: v.id("users"),
      bannedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.BAN_MEMBERS,
    );

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(100);

    const results = [];
    for (const b of bans) {
      const user = await ctx.db.get("users", b.userId);
      results.push({
        _id: b._id,
        _creationTime: b._creationTime,
        organizationId: b.organizationId,
        userId: b.userId,
        userEmail: user?.email,
        userName: user?.name,
        reason: b.reason,
        bannedBy: b.bannedBy,
        bannedAt: b.bannedAt,
      });
    }

    return results;
  },
});
