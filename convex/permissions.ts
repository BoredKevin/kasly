import { v } from "convex/values";

/**
 * Discord-style granular permissions.
 */
export const PERMISSIONS = {
  // Organization Administration
  ADMINISTRATOR: "ADMINISTRATOR", // Grants all permissions, bypasses all permission checks (except owner-only actions)
  MANAGE_ORGANIZATION: "MANAGE_ORGANIZATION", // Update name, description, slug, icon, settings
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG", // View moderation and action logs

  // Role Management
  MANAGE_ROLES: "MANAGE_ROLES", // Create, edit, delete, and reorder roles lower than actor's highest role

  // Member Management & Privacy
  MANAGE_MEMBERS: "MANAGE_MEMBERS", // Manage member nicknames and assign roles
  VIEW_EMAILS: "VIEW_EMAILS", // View member email addresses (PII protection)
  KICK_MEMBERS: "KICK_MEMBERS", // Kick members with a lower role hierarchy position
  BAN_MEMBERS: "BAN_MEMBERS", // Ban and unban members with a lower role hierarchy position

  // Invites
  CREATE_INVITES: "CREATE_INVITES", // Generate invite links
  MANAGE_INVITES: "MANAGE_INVITES", // View all invites and revoke invites

  // Content & Resource Access
  VIEW_ORGANIZATION: "VIEW_ORGANIZATION", // Basic read access to the organization and member list
  CREATE_CONTENT: "CREATE_CONTENT", // Create organization-scoped items
  MANAGE_CONTENT: "MANAGE_CONTENT", // Edit or delete any content within the organization

  // Treasury & Ledger
  MANAGE_TREASURY: "MANAGE_TREASURY", // Create/archive funds, manage keys, create checkpoints
  SIGN_TREASURY: "SIGN_TREASURY", // Sign and commit ledger entries (debit/credit)
  VIEW_TREASURY: "VIEW_TREASURY", // View fund balances and ledger history
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const permissionValidator = v.union(
  v.literal("ADMINISTRATOR"),
  v.literal("MANAGE_ORGANIZATION"),
  v.literal("VIEW_AUDIT_LOG"),
  v.literal("MANAGE_ROLES"),
  v.literal("MANAGE_MEMBERS"),
  v.literal("VIEW_EMAILS"),
  v.literal("KICK_MEMBERS"),
  v.literal("BAN_MEMBERS"),
  v.literal("CREATE_INVITES"),
  v.literal("MANAGE_INVITES"),
  v.literal("VIEW_ORGANIZATION"),
  v.literal("CREATE_CONTENT"),
  v.literal("MANAGE_CONTENT"),
  v.literal("MANAGE_TREASURY"),
  v.literal("SIGN_TREASURY"),
  v.literal("VIEW_TREASURY"),
);

export const DEFAULT_EVERYONE_PERMISSIONS: Permission[] = [
  PERMISSIONS.VIEW_ORGANIZATION,
  PERMISSIONS.CREATE_CONTENT,
  PERMISSIONS.CREATE_INVITES,
  PERMISSIONS.VIEW_TREASURY,
];

export const DEFAULT_ADMIN_PERMISSIONS: Permission[] = [
  PERMISSIONS.ADMINISTRATOR,
];

