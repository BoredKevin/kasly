import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

/**
 * Retrieves the global application settings.
 * If a specific setting has not been explicitly configured in the database,
 * safe default values are returned (e.g. allowOrganizationCreation defaults to true).
 */
export const get = query({
  args: {},
  returns: v.object({
    allowOrganizationCreation: v.boolean(),
    enableNISN: v.boolean(),
    allowProfileNameChange: v.boolean(),
    allowSignUps: v.boolean(),
    enablePreRegistration: v.boolean(),
  }),
  handler: async (ctx) => {
    const orgCreationSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "allowOrganizationCreation"))
      .unique();

    const nisnSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enableNISN"))
      .unique();

    const nameChangeSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "allowProfileNameChange"))
      .unique();

    const signUpsSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "allowSignUps"))
      .unique();

    const preRegSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enablePreRegistration"))
      .unique();

    return {
      allowOrganizationCreation:
        orgCreationSetting !== null ? orgCreationSetting.value : true,
      enableNISN:
        nisnSetting !== null ? nisnSetting.value : true,
      allowProfileNameChange:
        nameChangeSetting !== null ? nameChangeSetting.value : true,
      allowSignUps:
        signUpsSetting !== null ? signUpsSetting.value : true,
      enablePreRegistration:
        preRegSetting !== null ? preRegSetting.value : false,
    };
  },
});

/**
 * Populates default app settings on initial setup or deployment.
 * Only executes and inserts entries if there are no existing app settings in the database.
 */
export const populate = mutation({
  args: {},
  returns: v.object({
    populated: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const existing = await ctx.db.query("appSettings").take(1);
    if (existing.length > 0) {
      return {
        populated: false,
        message:
          "App settings already exist in the database. Skipping initialization.",
      };
    }

    await ctx.db.insert("appSettings", {
      key: "allowOrganizationCreation",
      value: true,
      description:
        "Controls whether users are permitted to create new organization workspaces.",
    });

    await ctx.db.insert("appSettings", {
      key: "enableNISN",
      value: true,
      description:
        "Controls whether the 10-digit private NISN identification and verification system is enabled.",
    });

    await ctx.db.insert("appSettings", {
      key: "allowProfileNameChange",
      value: true,
      description:
        "Controls whether users are permitted to edit and update their profile display names.",
    });

    await ctx.db.insert("appSettings", {
      key: "allowSignUps",
      value: true,
      description:
        "Controls whether new user registrations and sign ups are permitted on the platform.",
    });

    await ctx.db.insert("appSettings", {
      key: "enablePreRegistration",
      value: false,
      description:
        "Controls whether user registration requires claiming a pre-registered identity.",
    });

    return {
      populated: true,
      message: "Successfully populated default app settings.",
    };
  },
});

/**
 * Internal mutation to create or update app settings directly in the database.
 * Not exposed as a public API to prevent regular users from editing settings.
 */
export const setInternal = internalMutation({
  args: {
    key: v.string(),
    value: v.boolean(),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch("appSettings", existing._id, {
        value: args.value,
        description: args.description ?? existing.description,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        value: args.value,
        description: args.description,
      });
    }

    return null;
  },
});
