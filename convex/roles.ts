import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requirePermission,
  assertCanManageRole,
} from "./authz";
import { PERMISSIONS, permissionValidator } from "./permissions";

/**
 * Lists all roles for an organization, sorted by hierarchy position (highest first).
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("roles"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      color: v.optional(v.string()),
      position: v.number(),
      permissions: v.array(v.string()),
      isDefault: v.boolean(),
      isSystem: v.optional(v.boolean()),
    }),
  ),
  handler: async (ctx, args) => {
    // Requires VIEW_ORGANIZATION permission
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_ORGANIZATION,
    );

    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organizationId_and_position", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(200);

    return roles.map((role) => ({
      _id: role._id,
      _creationTime: role._creationTime,
      organizationId: role.organizationId,
      name: role.name,
      description: role.description,
      color: role.color,
      position: role.position,
      permissions: role.permissions,
      isDefault: role.isDefault,
      isSystem: role.isSystem,
    }));
  },
});

/**
 * Creates a new role in an organization with Discord-style hierarchy checks.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    position: v.optional(v.number()),
    permissions: v.array(permissionValidator),
  },
  returns: v.id("roles"),
  handler: async (ctx, args) => {
    const { organization, member } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_ROLES,
    );

    const targetPosition = args.position ?? 1;

    if (targetPosition <= 0) {
      throw new Error(
        "Invalid role position: Position 0 is reserved for @everyone.",
      );
    }

    // Role hierarchy check: actor cannot create a role with position >= their own highest role
    await assertCanManageRole(ctx, organization, member, targetPosition);

    const roleId = await ctx.db.insert("roles", {
      organizationId: args.organizationId,
      name: args.name,
      description: args.description,
      color: args.color,
      position: targetPosition,
      permissions: args.permissions,
      isDefault: false,
      isSystem: false,
    });

    return roleId;
  },
});

/**
 * Updates an existing role with Discord-style hierarchy checks.
 */
export const update = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    position: v.optional(v.number()),
    permissions: v.optional(v.array(permissionValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role = await ctx.db.get("roles", args.roleId);
    if (!role) {
      throw new Error("Role not found.");
    }

    const { organization, member } = await requirePermission(
      ctx,
      role.organizationId,
      PERMISSIONS.MANAGE_ROLES,
    );

    // Cannot modify a role equal to or higher than actor's own highest role
    await assertCanManageRole(ctx, organization, member, role.position);

    if (role.isDefault) {
      if (args.position !== undefined && args.position !== 0) {
        throw new Error(
          "Forbidden: Default @everyone role position cannot be changed from 0.",
        );
      }
      if (args.name !== undefined && args.name !== role.name) {
        throw new Error(
          "Forbidden: Default @everyone role name cannot be modified.",
        );
      }
    }

    if (args.position !== undefined) {
      if (args.position <= 0 && !role.isDefault) {
        throw new Error(
          "Forbidden: Non-default role position must be greater than 0.",
        );
      }
      await assertCanManageRole(ctx, organization, member, args.position);
    }

    const updates: Partial<{
      name: string;
      description?: string;
      color?: string;
      position: number;
      permissions: string[];
    }> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.color !== undefined) updates.color = args.color;
    if (args.position !== undefined) updates.position = args.position;
    if (args.permissions !== undefined) updates.permissions = args.permissions;

    await ctx.db.patch("roles", args.roleId, updates);
    return null;
  },
});

/**
 * Deletes a custom role and strips it from all members.
 */
export const deleteRole = mutation({
  args: {
    roleId: v.id("roles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const role = await ctx.db.get("roles", args.roleId);
    if (!role) {
      throw new Error("Role not found.");
    }

    if (role.isDefault || role.isSystem) {
      throw new Error("Forbidden: Cannot delete default or system roles.");
    }

    const { organization, member } = await requirePermission(
      ctx,
      role.organizationId,
      PERMISSIONS.MANAGE_ROLES,
    );

    await assertCanManageRole(ctx, organization, member, role.position);

    // Strip role from all members who have it
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", role.organizationId),
      )
      .take(1000);

    for (const m of members) {
      if (m.roleIds.includes(args.roleId)) {
        await ctx.db.patch("members", m._id, {
          roleIds: m.roleIds.filter((id) => id !== args.roleId),
        });
      }
    }

    await ctx.db.delete("roles", args.roleId);
    return null;
  },
});

/**
 * Batch reorders role positions.
 */
export const reorder = mutation({
  args: {
    organizationId: v.id("organizations"),
    rolePositions: v.array(
      v.object({
        roleId: v.id("roles"),
        position: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { organization, member } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_ROLES,
    );

    for (const item of args.rolePositions) {
      const role = await ctx.db.get("roles", item.roleId);
      if (!role || role.organizationId !== args.organizationId) {
        throw new Error(`Role ${item.roleId} not found in this organization.`);
      }

      if (role.isDefault && item.position !== 0) {
        throw new Error(
          "Forbidden: Default @everyone role must remain at position 0.",
        );
      }

      if (!role.isDefault && item.position <= 0) {
        throw new Error(
          "Forbidden: Non-default role position must be greater than 0.",
        );
      }

      // Hierarchy checks
      await assertCanManageRole(ctx, organization, member, role.position);
      await assertCanManageRole(ctx, organization, member, item.position);
    }

    for (const item of args.rolePositions) {
      await ctx.db.patch("roles", item.roleId, { position: item.position });
    }

    return null;
  },
});
