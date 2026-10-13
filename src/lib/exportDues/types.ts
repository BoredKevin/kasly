export interface DuesExportEvent {
  _id: string;
  periodLabel: string;
  dueDate: number;
  amount: number;
  totalMembers: number;
  paidCount: number;
}

export interface DuesExportMember {
  _id: string;
  userId: string;
  name: string;
  email?: string;
  nickname?: string;
  image?: string;
  unpaidPeriodsCount: number;
  totalPaidAmount: number;
}

export interface DuesExportCell {
  hasPaid: boolean;
  isWaived?: boolean;
  paidAt?: number;
  ledgerEntryId?: string;
}

export interface DuesExportPayload {
  fundName: string;
  organizationName?: string;
  currency?: string;
  events: DuesExportEvent[];
  members: DuesExportMember[];
  cellMap: Map<string, DuesExportCell>;
  rangeLabel?: string;
  summary?: {
    totalUnpaidMemberships?: number;
    totalEvents?: number;
    config?: {
      isEnabled: boolean;
      intervalType: string;
      intervalValue: number;
      amount: number;
    } | null;
  };
}

export interface DuesMemberSummary {
  member: DuesExportMember;
  rangePaid: number;
  rangeUnpaid: number;
}

export interface DuesReportAggregates {
  rangeMemberTotals: DuesMemberSummary[];
  totalPaidSum: number;
  totalUnpaidSum: number;
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
}

export const DUES_JSON_FORMAT_VERSION = "1.0.0";

export interface DuesJsonCycle {
  _id: string;
  periodLabel: string;
  dueDate: number;
  dueDateFormatted: string;
  dueDateShort: string;
  amount: number;
  totalMembers: number;
  paidCount: number;
  unpaidCount: number;
  expectedAmount: number;
  collectedAmount: number;
  outstandingAmount: number;
  collectionRate: number;
}

export interface DuesJsonCell {
  eventId: string;
  periodLabel: string;
  dueDate: number;
  dueDateFormatted: string;
  amount: number;
  status: "PAID" | "UNPAID" | "WAIVED";
  hasPaid: boolean;
  isWaived: boolean;
  paidAt?: number;
  ledgerEntryId?: string;
}

export interface DuesJsonMember {
  index: number;
  _id: string;
  userId: string;
  name: string;
  nickname?: string;
  displayName: string;
  email?: string;
  image?: string;
  rangePaid: number;
  rangeUnpaid: number;
  rangeStatus: string;
  totalPaidAmount: number;
  unpaidPeriodsCount: number;
  cells: DuesJsonCell[];
}

export interface DuesJsonCycleTotal {
  eventId: string;
  periodLabel: string;
  paidCount: number;
  totalMembers: number;
  ratio: string;
  collectedAmount: number;
  expectedAmount: number;
}

export interface DuesJsonExport {
  formatVersion: string;
  metadata: {
    title: string;
    organizationName: string;
    fundName: string;
    currency: string;
    rangeLabel: string;
    generatedAt: string;
    app: {
      name: string;
      version: string;
      buildHash: string;
      website: string;
    };
  };
  summary: {
    enrolledMembers: number;
    cyclesInRange: number;
    totalCollected: number;
    totalExpected: number;
    totalOutstanding: number;
    collectionRate: number;
    totalPaidSum: number;
    totalUnpaidSum: number;
    totalUnpaidMemberships?: number;
    totalEvents?: number;
    config?: {
      isEnabled: boolean;
      intervalType: string;
      intervalValue: number;
      amount: number;
    } | null;
  };
  cycles: DuesJsonCycle[];
  members: DuesJsonMember[];
  cellRecords: Record<string, DuesExportCell>;
  tableFooter: {
    label: string;
    totalPaidSum: number;
    totalUnpaidSum: number;
    totalUnpaidStatus: string;
    cycleTotals: DuesJsonCycleTotal[];
  };
}
