import {
  Landmark,
  Receipt,
  CalendarDays,
  ScrollText,
  KeyRound,
  ShieldCheck,
  Building2,
  Users,
  Shield,
  Link as LinkIcon,
  User,
  LucideIcon,
} from "lucide-react";

export interface NavItem {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
  permission?: "canSign" | "canAdmin" | "canManageRoles" | "canViewInvites" | "canManageMembers";
}

export const MAIN_BOTTOM_TABS: NavItem[] = [
  {
    id: "overview",
    labelKey: "nav.overview",
    fallbackLabel: "Overview",
    href: "/treasury",
    icon: Landmark,
  },
  {
    id: "invoices",
    labelKey: "nav.invoices",
    fallbackLabel: "Invoices",
    href: "/treasury/invoices",
    icon: Receipt,
  },
  {
    id: "dues",
    labelKey: "nav.duesAndPayments",
    fallbackLabel: "Dues",
    href: "/treasury/dues",
    icon: CalendarDays,
  },
  {
    id: "ledger",
    labelKey: "nav.ledger",
    fallbackLabel: "Activity",
    href: "/treasury/ledger",
    icon: ScrollText,
  },
];

export const TREASURY_SUB_ITEMS: NavItem[] = [
  {
    id: "overview",
    labelKey: "nav.overview",
    fallbackLabel: "Overview",
    href: "/treasury",
    icon: Landmark,
  },
  {
    id: "ledger",
    labelKey: "nav.ledger",
    fallbackLabel: "Ledger",
    href: "/treasury/ledger",
    icon: ScrollText,
  },
  {
    id: "dues",
    labelKey: "nav.duesAndPayments",
    fallbackLabel: "Dues & Payments",
    href: "/treasury/dues",
    icon: CalendarDays,
  },
  {
    id: "bulk-dues",
    labelKey: "treasury.bulkDues.title",
    fallbackLabel: "Bulk Dues",
    href: "/treasury/bulk-dues",
    icon: Users,
    permission: "canSign",
  },
  {
    id: "invoices",
    labelKey: "nav.invoices",
    fallbackLabel: "Invoices",
    href: "/treasury/invoices",
    icon: Receipt,
  },
  {
    id: "keys",
    labelKey: "nav.myKeys",
    fallbackLabel: "My Keys",
    href: "/treasury/keys",
    icon: KeyRound,
    permission: "canSign",
  },
  {
    id: "admin",
    labelKey: "nav.adminPanel",
    fallbackLabel: "Admin Panel",
    href: "/treasury/admin",
    icon: ShieldCheck,
    permission: "canAdmin",
  },
];

export const ORG_SUB_ITEMS: NavItem[] = [
  {
    id: "org-overview",
    labelKey: "nav.overview",
    fallbackLabel: "Overview",
    href: "/organization",
    icon: Building2,
  },
  {
    id: "org-members",
    labelKey: "nav.members",
    fallbackLabel: "Members",
    href: "/organization/members",
    icon: Users,
  },
  {
    id: "org-roles",
    labelKey: "nav.roles",
    fallbackLabel: "Roles",
    href: "/organization/roles",
    icon: Shield,
    permission: "canManageRoles",
  },
  {
    id: "org-invites",
    labelKey: "nav.invites",
    fallbackLabel: "Invites",
    href: "/organization/invites",
    icon: LinkIcon,
    permission: "canViewInvites",
  },
];

export const USER_NAV_ITEMS: NavItem[] = [
  {
    id: "profile",
    labelKey: "nav.userProfile",
    fallbackLabel: "Profile",
    href: "/profile",
    icon: User,
  },
];
