import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Custom User Profile Extension (includes hashed NISN)
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    nisn: v.optional(v.string()), // Salted cryptographic hash of 10-character NISN
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  // Organizations (Servers in Discord terminology)
  organizations: defineTable({
    name: v.string(),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    iconStorageId: v.optional(v.id("_storage")),
    iconUrl: v.optional(v.string()),
    ownerId: v.id("users"),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_slug", ["slug"]),

  // Roles scoped to an organization
  roles: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    position: v.number(), // Hierarchy position: 0 is lowest (@everyone), higher = higher authority
    permissions: v.array(v.string()),
    isDefault: v.boolean(), // True for @everyone role which applies to all members
    isSystem: v.optional(v.boolean()), // Protected roles that cannot be deleted
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_and_position", ["organizationId", "position"])
    .index("by_organizationId_and_isDefault", ["organizationId", "isDefault"]),

  // Members belonging to an organization
  members: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    roleIds: v.array(v.id("roles")),
    nickname: v.optional(v.string()),
    joinedAt: v.number(),
  })
    .index("by_organizationId_and_userId", ["organizationId", "userId"])
    .index("by_userId", ["userId"])
    .index("by_organizationId", ["organizationId"]),

  // Invites to join an organization
  invites: defineTable({
    organizationId: v.id("organizations"),
    code: v.string(),
    inviterId: v.id("users"),
    maxUses: v.optional(v.number()), // null/omitted = unlimited
    uses: v.number(),
    expiresAt: v.optional(v.number()), // null/omitted = never
    roleIds: v.optional(v.array(v.id("roles"))), // Optional roles automatically granted on join
  })
    .index("by_code", ["code"])
    .index("by_organizationId", ["organizationId"]),

  // Bans list for an organization
  bans: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    bannedBy: v.id("users"),
    bannedAt: v.number(),
  })
    .index("by_organizationId_and_userId", ["organizationId", "userId"])
    .index("by_organizationId", ["organizationId"]),

  // Global application settings (database-managed)
  appSettings: defineTable({
    key: v.string(), // Configuration key, e.g. "allowOrganizationCreation"
    value: v.boolean(),
    description: v.optional(v.string()),
  }).index("by_key", ["key"]),
});

