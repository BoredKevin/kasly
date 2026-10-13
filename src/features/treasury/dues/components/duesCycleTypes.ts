import { Id } from "../../../../../convex/_generated/dataModel";

export type StatusFilter = "all" | "completed" | "in_progress" | "unpaid" | "archived";

export interface CycleItem {
  _id: Id<"duesEvents">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  periodLabel: string;
  dueDate: number;
  amount: number;
  totalMembers: number;
  paidCount: number;
  isArchived?: boolean;
}

export interface DuesCycleItemProps {
  cycle: CycleItem;
  isSelected: boolean;
  currency: string;
  canManage: boolean;
  isSyncing: boolean;
  onToggleSelect: (id: Id<"duesEvents">) => void;
  onInspect: (id: Id<"duesEvents">) => void;
  onEdit: (cycle: CycleItem) => void;
  onSync: (id: Id<"duesEvents">) => void;
  onDelete: (cycle: CycleItem) => void;
  formatDate: (timestamp: number) => string;
  formatMoney: (amount: number, currency?: string) => string;
}
