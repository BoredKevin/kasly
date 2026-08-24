import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { requirePermission } from "../authz";
import { PERMISSIONS } from "../permissions";
import { deriveFundBalance } from "./helpers";

/**
 * Lists funds belonging to an organization, including current derived balance.
 */
export const list = query({
  args: {
    organizationId: v.id("organizations"),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("funds"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      currency: v.string(),
      createdBy: v.id("users"),
      isArchived: v.boolean(),
      balance: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    let funds;
    if (args.includeArchived) {
      funds = await ctx.db
        .query("funds")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", args.organizationId)
        )
        .take(100);
    } else {
      funds = await ctx.db
        .query("funds")
        .withIndex("by_organizationId_and_isArchived", (q) =>
          q.eq("organizationId", args.organizationId).eq("isArchived", false)
        )
        .take(100);
    }

    const results = [];
    for (const fund of funds) {
      const balance = await deriveFundBalance(ctx, fund._id);
      results.push({
        _id: fund._id,
        _creationTime: fund._creationTime,
        organizationId: fund.organizationId,
        name: fund.name,
        description: fund.description,
        currency: fund.currency,
        createdBy: fund.createdBy,
        isArchived: fund.isArchived,
        balance,
      });
    }

    return results;
  },
});

/**
 * Retrieves details for a specific fund including its current derived balance.
 */
export const get = query({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("funds"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      name: v.string(),
      description: v.optional(v.string()),
      currency: v.string(),
      createdBy: v.id("users"),
      isArchived: v.boolean(),
      balance: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      return null;
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const balance = await deriveFundBalance(ctx, fund._id);

    return {
      _id: fund._id,
      _creationTime: fund._creationTime,
      organizationId: fund.organizationId,
      name: fund.name,
      description: fund.description,
      currency: fund.currency,
      createdBy: fund.createdBy,
      isArchived: fund.isArchived,
      balance,
    };
  },
});

/**
 * Creates a new fund within an organization (requires MANAGE_TREASURY).
 * The currency is immutable once created.
 */
export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    currency: v.string(),
  },
  returns: v.id("funds"),
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Fund name cannot be empty.");
    }

    const currencyCode = args.currency.trim().toUpperCase();
    if (!currencyCode) {
      throw new Error("Currency code cannot be empty.");
    }

    const fundId = await ctx.db.insert("funds", {
      organizationId: args.organizationId,
      name: trimmedName,
      description: args.description?.trim() || undefined,
      currency: currencyCode,
      createdBy: user._id,
      isArchived: false,
    });

    return fundId;
  },
});

/**
 * Updates a fund's metadata (name and description).
 * Currency is immutable and cannot be changed.
 */
export const update = mutation({
  args: {
    fundId: v.id("funds"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (fund.isArchived) {
      throw new Error("Cannot update an archived fund. Unarchive it first.");
    }

    const updates: Partial<{
      name: string;
      description?: string;
    }> = {};

    if (args.name !== undefined) {
      const trimmed = args.name.trim();
      if (!trimmed) {
        throw new Error("Fund name cannot be empty.");
      }
      updates.name = trimmed;
    }

    if (args.description !== undefined) {
      updates.description = args.description.trim() || undefined;
    }

    await ctx.db.patch("funds", args.fundId, updates);
    return null;
  },
});

/**
 * Archives a fund, preventing new ledger entries from being committed.
 * Ledger history and derived balances are preserved.
 */
export const archive = mutation({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (fund.isArchived) {
      return null;
    }

    await ctx.db.patch("funds", args.fundId, { isArchived: true });
    return null;
  },
});

/**
 * Unarchives a previously archived fund, restoring ability to commit new entries.
 */
export const unarchive = mutation({
  args: {
    fundId: v.id("funds"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Fund not found.");
    }

    await requirePermission(
      ctx,
      fund.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (!fund.isArchived) {
      return null;
    }

    await ctx.db.patch("funds", args.fundId, { isArchived: false });
    return null;
  },
});
