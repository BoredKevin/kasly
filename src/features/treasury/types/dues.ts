import { Doc, Id } from "../../../../convex/_generated/dataModel";

export type DueEventDoc = Doc<"duesEvents">;
export type DueEventId = Id<"duesEvents">;
export type DuesMembershipDoc = Doc<"duesMemberships">;
export type DuesMembershipId = Id<"duesMemberships">;

export type DuesStatus = "PAID" | "INVOICED" | "UNPAID" | "WAIVED";

export interface DuesEventItem {
  _id: Id<"duesEvents">;
  fundId: Id<"funds">;
  periodLabel: string;
  dueDate: number;
  amount: number;
  totalMembers: number;
  paidCount: number;
}

export interface DuesMemberItem {
  _id: Id<"members">;
  userId: Id<"users">;
  name: string;
  email?: string;
  nickname?: string;
  image?: string;
  unpaidPeriodsCount: number;
  totalPaidAmount: number;
}

export interface DuesCellItem {
  _id: Id<"duesMemberships">;
  duesEventId: Id<"duesEvents">;
  fundId: Id<"funds">;
  memberId: Id<"members">;
  userId: Id<"users">;
  hasPaid: boolean;
  isWaived?: boolean;
  paidAt?: number;
  ledgerEntryId?: Id<"ledgerEntries">;
  invoiceId?: Id<"invoices">;
}

export interface DuesSpreadsheetData {
  events: DuesEventItem[];
  members: DuesMemberItem[];
  cells: DuesCellItem[];
}

export interface DuesSummaryConfig {
  isEnabled: boolean;
  intervalType: string;
  intervalValue: number;
  amount: number;
  nextScheduledAt?: number;
}

export interface DuesSummaryData {
  totalEvents: number;
  totalUnpaidMemberships: number;
  latestEvent: DuesEventItem | null;
  config: DuesSummaryConfig | null;
}

export interface MemberUnpaidPeriodItem {
  membershipId: Id<"duesMemberships">;
  duesEventId: Id<"duesEvents">;
  periodLabel: string;
  dueDate: number;
  amount: number;
}
