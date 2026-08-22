import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireUser, requirePermission } from "./authz";
import { PERMISSIONS } from "./permissions";

/**
 * Lists numbers scoped to a specific organization (requires VIEW_ORGANIZATION permission).
 */
export const listByOrg = query({
  args: {
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("numbers"),
      _creationTime: v.number(),
      value: v.number(),
      organizationId: v.optional(v.id("organizations")),
      createdBy: v.optional(v.id("users")),
      creatorName: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_ORGANIZATION,
    );

    const numbers = await ctx.db
      .query("numbers")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(args.limit ?? 50);

    const results = [];
    for (const num of numbers) {
      const creator = num.createdBy
        ? await ctx.db.get("users", num.createdBy)
        : null;

      results.push({
        _id: num._id,
        _creationTime: num._creationTime,
        value: num.value,
        organizationId: num.organizationId,
        createdBy: num.createdBy,
        creatorName: creator?.name ?? creator?.email,
      });
    }

    return results;
  },
});

/**
 * Adds a new number scoped to an organization (requires CREATE_CONTENT permission).
 */
export const add = mutation({
  args: {
    organizationId: v.id("organizations"),
    value: v.number(),
  },
  returns: v.id("numbers"),
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.CREATE_CONTENT,
    );

    const numberId = await ctx.db.insert("numbers", {
      value: args.value,
      organizationId: args.organizationId,
      createdBy: user._id,
    });

    return numberId;
  },
});

/**
 * Deletes a number (requires MANAGE_CONTENT or being the original creator).
 */
export const remove = mutation({
  args: {
    numberId: v.id("numbers"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const num = await ctx.db.get("numbers", args.numberId);
    if (!num) {
      throw new Error("Number record not found.");
    }

    if (num.organizationId) {
      const isCreator = num.createdBy === user._id;
      if (!isCreator) {
        // Must have MANAGE_CONTENT permission
        await requirePermission(
          ctx,
          num.organizationId,
          PERMISSIONS.MANAGE_CONTENT,
        );
      }
    }

    await ctx.db.delete("numbers", args.numberId);
    return null;
  },
});
