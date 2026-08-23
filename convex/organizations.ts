import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireUser,
  requireMember,
  requirePermission,
} from "./authz";
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_EVERYONE_PERMISSIONS,
  PERMISSIONS,
} from "./permissions";

/**
 * Creates a new organization (server).
 * Automatically sets the creator as owner and creates the default @everyone and Admin roles.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    // Verify global app setting for organization creation
    const orgCreationSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "allowOrganizationCreation"))
      .unique();

    if (orgCreationSetting && !orgCreationSetting.value) {
      throw new Error(
        "Forbidden: Organization creation is currently disabled by system policy.",
      );
    }

    const organizationId = await ctx.db.insert("organizations", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      ownerId: user._id,
    });

    // 1. Create the default @everyone role (Position 0)
    await ctx.db.insert("roles", {
      organizationId,
      name: "@everyone",
      description: "Default permissions for all members",
      position: 0,
      permissions: [...DEFAULT_EVERYONE_PERMISSIONS],
      isDefault: true,
      isSystem: true,
    });

    // 2. Create the Admin role (Position 100)
    const adminRoleId = await ctx.db.insert("roles", {
      organizationId,
      name: "Admin",
      description: "Server administrators with full access",
      color: "#5865F2",
      position: 100,
      permissions: [...DEFAULT_ADMIN_PERMISSIONS],
      isDefault: false,
      isSystem: false,
    });

    // 3. Add the creator as the first member with the Admin role
    await ctx.db.insert("members", {
      organizationId,
      userId: user._id,
      roleIds: [adminRoleId],
      joinedAt: Date.now(),
    });

    return organizationId;
  },
});

/**
 * Retrieves details for a specific organization.
 */
export const get = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("organizations"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.optional(v.string()),
      iconStorageId: v.optional(v.id("_storage")),
      iconUrl: v.optional(v.string()),
      ownerId: v.id("users"),
      isOwner: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      return null;
    }

    // Verify membership
    await requireMember(ctx, args.organizationId, user._id);

    return {
      _id: organization._id,
      _creationTime: organization._creationTime,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      iconStorageId: organization.iconStorageId,
      iconUrl: organization.iconUrl,
      ownerId: organization.ownerId,
      isOwner: organization.ownerId === user._id,
    };
  },
});

/**
 * Lists all organizations the authenticated user is a member of.
 */
export const listMine = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("organizations"),
      _creationTime: v.number(),
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.optional(v.string()),
      iconUrl: v.optional(v.string()),
      ownerId: v.id("users"),
      isOwner: v.boolean(),
      joinedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    const memberships = await ctx.db
      .query("members")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(100);

    const results = [];
    for (const membership of memberships) {
      const org = await ctx.db.get("organizations", membership.organizationId);
      if (org) {
        results.push({
          _id: org._id,
          _creationTime: org._creationTime,
          name: org.name,
          slug: org.slug,
          description: org.description,
          iconUrl: org.iconUrl,
          ownerId: org.ownerId,
          isOwner: org.ownerId === user._id,
          joinedAt: membership.joinedAt,
        });
      }
    }

    return results;
  },
});

/**
 * Updates organization metadata (requires MANAGE_ORGANIZATION).
 */
export const update = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
    iconStorageId: v.optional(v.id("_storage")),
    iconUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_ORGANIZATION,
    );

    const updates: Partial<{
      name: string;
      description?: string;
      slug?: string;
      iconStorageId?: typeof args.iconStorageId;
      iconUrl?: string;
    }> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.slug !== undefined) updates.slug = args.slug;
    if (args.iconStorageId !== undefined) updates.iconStorageId = args.iconStorageId;
    if (args.iconUrl !== undefined) updates.iconUrl = args.iconUrl;

    await ctx.db.patch("organizations", args.organizationId, updates);
    return null;
  },
});

/**
 * Transfers server ownership to another existing member (Owner only).
 */
export const transferOwnership = mutation({
  args: {
    organizationId: v.id("organizations"),
    newOwnerUserId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) {
      throw new Error("Organization not found.");
    }

    if (org.ownerId !== user._id) {
      throw new Error(
        "Forbidden: Only the current organization owner can transfer ownership.",
      );
    }

    // Verify target user is a member
    await requireMember(ctx, args.organizationId, args.newOwnerUserId);

    await ctx.db.patch("organizations", args.organizationId, {
      ownerId: args.newOwnerUserId,
    });

    return null;
  },
});

/**
 * Permanently deletes an organization and cascades deletion to child records (Owner only).
 */
export const deleteOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) {
      throw new Error("Organization not found.");
    }

    if (org.ownerId !== user._id) {
      throw new Error(
        "Forbidden: Only the organization owner can delete the organization.",
      );
    }

    // Cascade delete roles
    const roles = await ctx.db
      .query("roles")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(1000);
    for (const r of roles) {
      await ctx.db.delete("roles", r._id);
    }

    // Cascade delete members
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(1000);
    for (const m of members) {
      await ctx.db.delete("members", m._id);
    }

    // Cascade delete invites
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(1000);
    for (const inv of invites) {
      await ctx.db.delete("invites", inv._id);
    }

    // Cascade delete bans
    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(1000);
    for (const b of bans) {
      await ctx.db.delete("bans", b._id);
    }

    // Delete organization itself
    await ctx.db.delete("organizations", args.organizationId);

    return null;
  },
});

/**
 * Leaves an organization (non-owners only).
 */
export const leave = mutation({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const org = await ctx.db.get("organizations", args.organizationId);
    if (!org) {
      throw new Error("Organization not found.");
    }

    if (org.ownerId === user._id) {
      throw new Error(
        "Forbidden: Organization owner cannot leave. Please transfer ownership or delete the organization.",
      );
    }

    const member = await requireMember(ctx, args.organizationId, user._id);
    await ctx.db.delete("members", member._id);

    return null;
  },
});
