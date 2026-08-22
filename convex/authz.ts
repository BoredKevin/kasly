import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ALL_PERMISSIONS, Permission, PERMISSIONS } from "./permissions";

/**
 * Returns the currently authenticated user document, or null if unauthenticated.
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get("users", userId);
}

/**
 * Ensures the caller is authenticated and returns the user document.
 * Throws 401 Unauthorized if not authenticated.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) {
    throw new Error("Unauthenticated: Please log in to perform this action.");
  }
  return user;
}

/**
 * Retrieves a member record for a user in an organization.
 */
export async function getMember(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
): Promise<Doc<"members"> | null> {
  return await ctx.db
    .query("members")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();
}

/**
 * Ensures the user is a member of the organization.
 * Throws 403 Forbidden if the user is not a member.
 */
export async function requireMember(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  userId: Id<"users">,
): Promise<Doc<"members">> {
  const member = await getMember(ctx, organizationId, userId);
  if (member === null) {
    throw new Error("Forbidden: You are not a member of this organization.");
  }
  return member;
}

/**
 * Resolves the full set of permissions for a member inside an organization.
 * - The organization owner always possesses ALL permissions.
 * - Administrator role grants ALL permissions.
 * - Otherwise, permissions are the union of the default (@everyone) role and all assigned member roles.
 */
export async function resolveMemberPermissions(
  ctx: QueryCtx | MutationCtx,
  organization: Doc<"organizations">,
  member: Doc<"members">,
): Promise<Set<Permission>> {
  // Owner is superuser
  if (member.userId === organization.ownerId) {
    return new Set(ALL_PERMISSIONS);
  }

  const permissions = new Set<Permission>();

  // Fetch the default (@everyone) role
  const defaultRole = await ctx.db
    .query("roles")
    .withIndex("by_organizationId_and_isDefault", (q) =>
      q.eq("organizationId", organization._id).eq("isDefault", true),
    )
    .unique();

  if (defaultRole) {
    for (const perm of defaultRole.permissions) {
      permissions.add(perm as Permission);
    }
  }

  // Fetch assigned member roles
  const roles = await Promise.all(
    member.roleIds.map((roleId) => ctx.db.get("roles", roleId)),
  );

  for (const role of roles) {
    if (role && role.organizationId === organization._id) {
      for (const perm of role.permissions) {
        permissions.add(perm as Permission);
      }
    }
  }

  // Administrator role grants everything
  if (permissions.has(PERMISSIONS.ADMINISTRATOR)) {
    return new Set(ALL_PERMISSIONS);
  }

  return permissions;
}

/**
 * Enforces that the current authenticated user has a specific permission in the organization.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
  requiredPermission: Permission,
): Promise<{
  user: Doc<"users">;
  organization: Doc<"organizations">;
  member: Doc<"members">;
  permissions: Set<Permission>;
}> {
  const user = await requireUser(ctx);

  const organization = await ctx.db.get("organizations", organizationId);
  if (!organization) {
    throw new Error("Organization not found.");
  }

  // Check if user is banned
  const ban = await ctx.db
    .query("bans")
    .withIndex("by_organizationId_and_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", user._id),
    )
    .unique();

  if (ban) {
    throw new Error("Forbidden: You have been banned from this organization.");
  }

  const member = await requireMember(ctx, organizationId, user._id);
  const permissions = await resolveMemberPermissions(ctx, organization, member);

  if (!permissions.has(requiredPermission)) {
    throw new Error(
      `Forbidden: Missing required permission '${requiredPermission}'.`,
    );
  }

  return { user, organization, member, permissions };
}

/**
 * Computes the highest role position for a member.
 * Returns Infinity for the organization owner.
 */
export async function getHighestRolePosition(
  ctx: QueryCtx | MutationCtx,
  organization: Doc<"organizations">,
  member: Doc<"members">,
): Promise<number> {
  if (member.userId === organization.ownerId) {
    return Infinity;
  }

  let highest = 0; // Default @everyone position

  const roles = await Promise.all(
    member.roleIds.map((roleId) => ctx.db.get("roles", roleId)),
  );

  for (const role of roles) {
    if (role && role.organizationId === organization._id) {
      if (role.position > highest) {
        highest = role.position;
      }
    }
  }

  return highest;
}

/**
 * Discord-style hierarchy check for member management (kick, ban, nickname, role assignment).
 * - Target cannot be the organization owner.
 * - Actor cannot target themselves for kick/ban.
 * - Actor's highest role position must be strictly greater than the target's highest role position.
 */
export async function assertCanManageTargetMember(
  ctx: QueryCtx | MutationCtx,
  organization: Doc<"organizations">,
  actorMember: Doc<"members">,
  targetMember: Doc<"members">,
): Promise<void> {
  if (targetMember.userId === organization.ownerId) {
    throw new Error(
      "Forbidden: Cannot perform moderation or administrative actions on the organization owner.",
    );
  }

  if (actorMember.userId === targetMember.userId) {
    throw new Error("Forbidden: You cannot perform this action on yourself.");
  }

  // Owner can manage everyone except cannot moderate themselves
  if (actorMember.userId === organization.ownerId) {
    return;
  }

  const actorHighest = await getHighestRolePosition(
    ctx,
    organization,
    actorMember,
  );
  const targetHighest = await getHighestRolePosition(
    ctx,
    organization,
    targetMember,
  );

  if (actorHighest <= targetHighest) {
    throw new Error(
      "Forbidden: You cannot manage a member whose highest role is equal to or higher than your own.",
    );
  }
}

/**
 * Discord-style hierarchy check for role creation, modification, deletion, and assignment.
 * - Actor's highest role position must be strictly greater than the target role position.
 */
export async function assertCanManageRole(
  ctx: QueryCtx | MutationCtx,
  organization: Doc<"organizations">,
  actorMember: Doc<"members">,
  targetRolePosition: number,
): Promise<void> {
  if (actorMember.userId === organization.ownerId) {
    return;
  }

  const actorHighest = await getHighestRolePosition(
    ctx,
    organization,
    actorMember,
  );

  if (actorHighest <= targetRolePosition) {
    throw new Error(
      "Forbidden: You cannot create, modify, assign, or delete a role with a position equal to or higher than your own.",
    );
  }
}
