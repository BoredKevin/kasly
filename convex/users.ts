import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getCurrentUser, requireUser } from "./authz";
import {
  getAuthUserId,
  modifyAccountCredentials,
  retrieveAccount,
} from "@convex-dev/auth/server";
import { api } from "./_generated/api";

/**
 * Returns the currently authenticated user's profile information.
 */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      image: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      name: user.name,
      email: user.email,
      image: user.image,
    };
  },
});

/**
 * Updates the authenticated user's profile details (display name).
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (args.name !== undefined) {
      const setting = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "allowProfileNameChange"))
        .unique();

      const isAllowed = setting !== null ? setting.value : true;
      if (!isAllowed) {
        throw new Error(
          "Profile display name changes are currently disabled by application settings.",
        );
      }
    }

    const updates: Partial<{
      name: string;
    }> = {};

    if (args.name !== undefined) {
      updates.name = args.name.trim();
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch("users", user._id, updates);
    }

    return null;
  },
});

/**
 * Changes the authenticated user's email address and syncs their auth account.
 */
export const changeEmail = mutation({
  args: {
    newEmail: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const newEmail = args.newEmail.trim().toLowerCase();

    if (!newEmail || !newEmail.includes("@")) {
      throw new Error("Invalid email address format.");
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", newEmail))
      .unique();

    if (existingUser && existingUser._id !== user._id) {
      throw new Error("An account with this email address already exists.");
    }

    await ctx.db.patch("users", user._id, { email: newEmail });

    // Sync auth account provider ID
    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) =>
        q.eq("userId", user._id).eq("provider", "password"),
      )
      .collect();

    for (const acc of authAccounts) {
      await ctx.db.patch("authAccounts", acc._id, {
        providerAccountId: newEmail,
      });
    }

    return null;
  },
});

/**
 * Changes the authenticated user's password.
 */
export const changePassword = action({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Unauthenticated: Please log in to perform this action.");
    }

    if (!args.currentPassword) {
      throw new Error("Current password is required.");
    }

    if (!args.newPassword || args.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters long.");
    }

    const user = await ctx.runQuery(api.users.viewer);
    if (!user || !user.email) {
      throw new Error("User account or email address not found.");
    }

    // Strictly verify current password
    try {
      await retrieveAccount(ctx, {
        provider: "password",
        account: { id: user.email, secret: args.currentPassword },
      });
    } catch {
      throw new Error("The current password provided is incorrect.");
    }

    await modifyAccountCredentials(ctx, {
      provider: "password",
      account: {
        id: user.email,
        secret: args.newPassword,
      },
    });

    return null;
  },
});

/**
 * Returns authentication settings and account metadata for the viewer.
 */
export const getAuthSettings = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      authProvider: v.string(),
      hasPasswordAuth: v.boolean(),
      accountCreatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      authProvider: "Password (Convex Auth)",
      hasPasswordAuth: true,
      accountCreatedAt: user._creationTime,
    };
  },
});
