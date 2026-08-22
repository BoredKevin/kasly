import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Preserved for frontend backwards compatibility
export const listNumbers = query({
  args: {
    count: v.number(),
  },
  returns: v.object({
    viewer: v.union(v.string(), v.null()),
    numbers: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    const numbers = await ctx.db
      .query("numbers")
      .order("desc")
      .take(args.count);

    const userId = await getAuthUserId(ctx);
    const user = userId === null ? null : await ctx.db.get("users", userId);

    return {
      viewer: user?.email ?? user?.name ?? null,
      numbers: numbers.reverse().map((number) => number.value),
    };
  },
});

export const addNumber = mutation({
  args: {
    value: v.number(),
  },
  returns: v.id("numbers"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const id = await ctx.db.insert("numbers", {
      value: args.value,
      createdBy: userId ?? undefined,
    });
    return id;
  },
});

export const myAction = action({
  args: {
    first: v.number(),
    second: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runQuery(api.myFunctions.listNumbers, {
      count: 10,
    });

    await ctx.runMutation(api.myFunctions.addNumber, {
      value: args.first,
    });

    return null;
  },
});
