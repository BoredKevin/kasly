import { Id } from "../../../../../convex/_generated/dataModel";

export interface StagedPaymentItem {
  id: string; // Unique row ID
  userId: Id<"users">;
  periodCount: number;
  customMemo: string;
  status: "idle" | "signing" | "completed" | "error";
  errorMessage?: string;
  entryHash?: string;
  entryId?: Id<"ledgerEntries">;
}

export interface SpreadsheetMember {
  _id: Id<"members">;
  userId: Id<"users">;
  name: string;
  email?: string;
  nickname?: string;
}

export interface SpreadsheetEvent {
  _id: Id<"duesEvents">;
  periodLabel: string;
  dueDate: number;
  amount: number;
}

export interface ResolvedStagedRow extends StagedPaymentItem {
  member?: SpreadsheetMember;
  unpaidEvents: SpreadsheetEvent[];
  selectedPeriods: SpreadsheetEvent[];
  amount: number;
  periodRange: string;
  defaultMemo: string;
  effectiveMemo: string;
}
