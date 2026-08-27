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
    enableRegistrationLinks: v.boolean(),
    enablePublicLedgerReceipts: v.boolean(),
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

    const regLinksSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enableRegistrationLinks"))
      .unique();

    const publicReceiptsSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enablePublicLedgerReceipts"))
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
      enableRegistrationLinks:
        regLinksSetting !== null ? regLinksSetting.value : true,
      enablePublicLedgerReceipts:
        publicReceiptsSetting !== null ? publicReceiptsSetting.value : true,
    };
  },
});

/**
 * Populates default app settings on initial setup or deployment.
 * Checks for existing entries and skips them, whilst inserting any missing default settings.
 * Returns what was added and what was skipped.
 */
export const populate = mutation({
  args: {},
  returns: v.object({
    added: v.array(v.string()),
    skipped: v.array(v.string()),
    message: v.string(),
  }),
  handler: async (ctx) => {
    const DEFAULT_SETTINGS = [
      {
        key: "allowOrganizationCreation",
        value: true,
        description:
          "Controls whether users are permitted to create new organization workspaces.",
      },
      {
        key: "enableNISN",
        value: true,
        description:
          "Controls whether the 10-digit private NISN identification and verification system is enabled.",
      },
      {
        key: "allowProfileNameChange",
        value: true,
        description:
          "Controls whether users are permitted to edit and update their profile display names.",
      },
      {
        key: "allowSignUps",
        value: true,
        description:
          "Controls whether new user registrations and sign ups are permitted on the platform.",
      },
      {
        key: "enablePreRegistration",
        value: false,
        description:
          "Controls whether user registration requires claiming a pre-registered identity.",
      },
      {
        key: "enableRegistrationLinks",
        value: true,
        description:
          "Controls whether personalized pre-registration invitation links are enabled.",
      },
      {
        key: "enablePublicLedgerReceipts",
        value: true,
        description:
          "Controls whether possessing a transaction hash allows viewing the cryptographic receipt without logging in.",
      },
    ];

    const existingSettings = await ctx.db.query("appSettings").collect();
    const existingKeys = new Set(existingSettings.map((s) => s.key));

    const added: string[] = [];
    const skipped: string[] = [];

    for (const setting of DEFAULT_SETTINGS) {
      if (existingKeys.has(setting.key)) {
        skipped.push(setting.key);
      } else {
        await ctx.db.insert("appSettings", {
          key: setting.key,
          value: setting.value,
          description: setting.description,
        });
        added.push(setting.key);
      }
    }

    let message: string;
    if (added.length === 0) {
      message = `All ${skipped.length} app setting(s) already exist. None added, ${skipped.length} skipped.`;
    } else if (skipped.length === 0) {
      message = `Successfully populated all ${added.length} default app setting(s).`;
    } else {
      message = `Populated default app settings: added ${added.length}, skipped ${skipped.length}.`;
    }

    return {
      added,
      skipped,
      message,
    };
  },
});

/**
 * Toggles the public ledger receipts system setting.
 */
export const togglePublicLedgerReceipts = mutation({
  args: {
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enablePublicLedgerReceipts"))
      .unique();

    if (existing) {
      await ctx.db.patch("appSettings", existing._id, {
        value: args.enabled,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: "enablePublicLedgerReceipts",
        value: args.enabled,
        description:
          "Controls whether possessing a transaction hash allows viewing the cryptographic receipt without logging in.",
      });
    }

    return null;
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
