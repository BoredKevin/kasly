export interface PermissionDef {
  key: string;
  name: string;
  description: string;
  category: "Admin" | "Management" | "Moderation" | "General";
}

export const PERMISSIONS_LIST: PermissionDef[] = [
  // Admin
  {
    key: "ADMINISTRATOR",
    name: "Administrator",
    description: "Bypasses all permission checks and grants full administrative authority.",
    category: "Admin",
  },
  {
    key: "MANAGE_ORGANIZATION",
    name: "Manage Organization",
    description: "Allows modifying organization name, slug, description, and settings.",
    category: "Admin",
  },
  {
    key: "VIEW_AUDIT_LOG",
    name: "View Audit Log",
    description: "Allows viewing moderation logs and administrative history.",
    category: "Admin",
  },

  // Management & Privacy
  {
    key: "MANAGE_ROLES",
    name: "Manage Roles",
    description: "Allows creating, editing, and deleting roles below the user's highest role.",
    category: "Management",
  },
  {
    key: "MANAGE_MEMBERS",
    name: "Manage Members",
    description: "Allows changing member nicknames and assigning roles.",
    category: "Management",
  },
  {
    key: "VIEW_EMAILS",
    name: "View Member Emails",
    description: "Allows viewing real email addresses of other organization members.",
    category: "Management",
  },
  {
    key: "MANAGE_INVITES",
    name: "Manage Invites",
    description: "Allows viewing and revoking organization invitation links.",
    category: "Management",
  },

  // Moderation
  {
    key: "KICK_MEMBERS",
    name: "Kick Members",
    description: "Allows removing members with a lower role hierarchy rank.",
    category: "Moderation",
  },
  {
    key: "BAN_MEMBERS",
    name: "Ban Members",
    description: "Allows banning and unbanning members with a lower role hierarchy rank.",
    category: "Moderation",
  },

  // General
  {
    key: "VIEW_ORGANIZATION",
    name: "View Organization",
    description: "Basic access to view the organization details and member directory.",
    category: "General",
  },
  {
    key: "CREATE_INVITES",
    name: "Create Invites",
    description: "Allows generating invite links for new members to join.",
    category: "General",
  },
  {
    key: "CREATE_CONTENT",
    name: "Create Content",
    description: "Allows publishing and creating organization-scoped content.",
    category: "General",
  },
  {
    key: "MANAGE_CONTENT",
    name: "Manage Content",
    description: "Allows editing and deleting content created by any member.",
    category: "General",
  },
];

export const PRESET_ROLE_COLORS = [
  "#5865F2", // Discord Blurple
  "#57F287", // Green
  "#FEE75C", // Yellow
  "#EB459E", // Fuchsia
  "#ED4245", // Red
  "#38BDF8", // Sky Blue
  "#A855F7", // Purple
  "#F97316", // Orange
  "#10B981", // Emerald
  "#94A3B8", // Slate
];
