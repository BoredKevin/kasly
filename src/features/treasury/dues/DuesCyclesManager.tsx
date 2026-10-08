import { useState, useMemo, useEffect, memo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Panel } from "../../../ui/Panel";
import { StatusPill } from "../../../ui/StatusPill";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import { Button, Input, Badge } from "@boredkevin/ui";
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Coins,
  Search,
  CheckSquare,
  Square,
  Trash2,
  Edit2,
  Eye,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";
import { EditDuesModal } from "./EditDuesModal";
import { BulkDateAdjustModal } from "./BulkDateAdjustModal";
import { BulkAmountAdjustModal } from "./BulkAmountAdjustModal";
import { DuesCycleDetailsModal } from "./DuesCycleDetailsModal";

export interface DuesCyclesManagerProps {
  organizationId: Id<"organizations">;
  organizationName?: string;
  fundId: Id<"funds">;
  fundName?: string;
  currency?: string;
  canManage?: boolean;
  canSign?: boolean;
  onOpenCreateDues?: () => void;
  onOpenRecordPayment?: (prefill?: any) => void;
  onOpenInvoiceDetails?: (invoiceId: Id<"invoices">) => void;
  onOpenCreateInvoice?: (prefill: { userId: Id<"users">; periodCount: number }) => void;
}

type StatusFilter = "all" | "completed" | "in_progress" | "unpaid" | "archived";

interface CycleItem {
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

interface DuesCycleItemProps {
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

/**
 * Desktop Tabular Row Component (>= 768px / md:)
 */
const DuesCycleTableRow = memo(function DuesCycleTableRow({
  cycle,
  isSelected,
  currency,
  canManage,
  isSyncing,
  onToggleSelect,
  onInspect,
  onEdit,
  onSync,
  onDelete,
  formatDate,
  formatMoney,
}: DuesCycleItemProps) {
  const isPaidComplete = cycle.totalMembers > 0 && cycle.paidCount >= cycle.totalMembers;
  const isOverdue = !isPaidComplete && cycle.dueDate < Date.now();
  const collectionPercentage =
    cycle.totalMembers > 0
      ? Math.round((cycle.paidCount / cycle.totalMembers) * 100)
      : 0;

  const statusTone = cycle.isArchived
    ? "neutral"
    : isPaidComplete
    ? "success"
    : cycle.paidCount > 0
    ? "info"
    : "warning";

  const statusLabel = cycle.isArchived
    ? "ARCHIVED"
    : isPaidComplete
    ? "PAID"
    : cycle.paidCount > 0
    ? "IN PROGRESS"
    : "UNPAID";

  return (
    <tr
      onClick={() => onToggleSelect(cycle._id)}
      className={`hover:bg-muted/15 transition-colors cursor-pointer select-none ${
        isSelected ? "bg-primary/10" : ""
      } ${cycle.isArchived ? "opacity-60 bg-muted/5" : ""}`}
    >
      {/* Row Checkbox */}
      <td className="w-10 px-3 py-3 text-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(cycle._id);
          }}
          className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          aria-label={isSelected ? "Deselect row" : "Select row"}
        >
          {isSelected ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
      </td>

      {/* Period Label */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground font-mono">
            {cycle.periodLabel}
          </span>
          {cycle.isArchived && (
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-muted text-muted-foreground font-mono">
              ARCHIVED
            </Badge>
          )}
        </div>
      </td>

      {/* Due Date */}
      <td className="px-3 py-3">
        <div className="space-y-0.5">
          <div className="text-xs text-foreground font-mono">
            {formatDate(cycle.dueDate)}
          </div>
          {isOverdue && !cycle.isArchived && (
            <span className="text-[10px] text-rose-400 font-mono">
              Overdue
            </span>
          )}
        </div>
      </td>

      {/* Rate per Member */}
      <td className="px-3 py-3 font-mono text-foreground font-semibold">
        {formatMoney(cycle.amount, currency)}
      </td>

      {/* Collection Progress */}
      <td className="px-3 py-3">
        <div className="space-y-1 min-w-[130px] max-w-[180px]">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className={isPaidComplete ? "text-emerald-400 font-bold" : "text-foreground"}>
              {cycle.paidCount} / {cycle.totalMembers}
            </span>
            <span className="text-muted-foreground">
              {collectionPercentage}%
            </span>
          </div>
          {/* Mini Progress Bar */}
          <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                isPaidComplete
                  ? "bg-emerald-400"
                  : cycle.paidCount > 0
                  ? "bg-primary"
                  : "bg-transparent"
              }`}
              style={{ width: `${collectionPercentage}%` }}
            />
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-3 py-3 text-center">
        <StatusPill tone={statusTone} dot>
          {statusLabel}
        </StatusPill>
      </td>

      {/* Action Buttons */}
      <td className="px-3 py-3 text-right pr-4">
        <div className="flex items-center justify-end gap-1">
          {/* Inspect Details */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(cycle._id);
            }}
            className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-primary/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Inspect cycle details & roster"
            aria-label="Inspect cycle details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Edit Cycle */}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(cycle);
              }}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-primary/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Edit cycle metadata"
              aria-label="Edit cycle metadata"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sync Active Members */}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onSync(cycle._id);
              }}
              disabled={isSyncing}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-primary/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
              title="Sync missing organization members"
              aria-label="Sync roster"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Delete / Archive */}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(cycle);
              }}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-rose-500/60 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all cursor-pointer"
              title={cycle.paidCount > 0 ? "Archive cycle (CLE payments exist)" : "Permanently delete cycle"}
              aria-label="Delete or archive cycle"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

/**
 * Mobile Stacked Card Item Component (< 768px / < md:)
 */
const DuesCycleMobileCard = memo(function DuesCycleMobileCard({
  cycle,
  isSelected,
  currency,
  canManage,
  isSyncing,
  onToggleSelect,
  onInspect,
  onEdit,
  onSync,
  onDelete,
  formatDate,
  formatMoney,
}: DuesCycleItemProps) {
  const isPaidComplete = cycle.totalMembers > 0 && cycle.paidCount >= cycle.totalMembers;
  const isOverdue = !isPaidComplete && cycle.dueDate < Date.now();
  const collectionPercentage =
    cycle.totalMembers > 0
      ? Math.round((cycle.paidCount / cycle.totalMembers) * 100)
      : 0;

  const statusTone = cycle.isArchived
    ? "neutral"
    : isPaidComplete
    ? "success"
    : cycle.paidCount > 0
    ? "info"
    : "warning";

  const statusLabel = cycle.isArchived
    ? "ARCHIVED"
    : isPaidComplete
    ? "PAID"
    : cycle.paidCount > 0
    ? "IN PROGRESS"
    : "UNPAID";

  return (
    <div
      onClick={() => onToggleSelect(cycle._id)}
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggleSelect(cycle._id);
        }
      }}
      className={`p-4 rounded-[var(--fintech-radius-md)] border transition-all space-y-3 cursor-pointer select-none ${
        isSelected
          ? "bg-primary/10 border-primary/60 ring-1 ring-primary/40 shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)]"
          : "bg-card/70 hover:bg-card border-border/80 hover:border-primary/40 shadow-sm"
      } ${cycle.isArchived ? "opacity-60 bg-muted/10 border-dashed" : ""}`}
    >
      {/* Header: Selection Checkbox, Period Label, and Status Pill (right-aligned) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(cycle._id);
            }}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label={isSelected ? "Deselect cycle" : "Select cycle"}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <span className="font-semibold text-sm text-foreground font-mono truncate">
            {cycle.periodLabel}
          </span>
          {cycle.isArchived && (
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-muted text-muted-foreground shrink-0 font-mono">
              ARCHIVED
            </Badge>
          )}
        </div>

        <div className="shrink-0">
          <StatusPill tone={statusTone} dot>
            {statusLabel}
          </StatusPill>
        </div>
      </div>

      {/* Body: Due Date with Overdue Badge & Rate / Member */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
            Due Date
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-foreground font-mono">
              {formatDate(cycle.dueDate)}
            </span>
            {isOverdue && !cycle.isArchived && (
              <span className="text-[10px] text-rose-400 font-mono font-medium px-1 py-0.2 rounded bg-rose-500/10 border border-rose-500/20">
                Overdue
              </span>
            )}
          </div>
        </div>

        <div className="space-y-0.5 text-right">
          <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
            Rate / Mbr
          </span>
          <div className="text-xs font-mono text-foreground font-semibold">
            {formatMoney(cycle.amount, currency)}
          </div>
        </div>
      </div>

      {/* Body: Collection Progress Bar with ratio and percentage */}
      <div className="space-y-1.5 p-2 rounded-[var(--fintech-radius-sm)] bg-muted/20 border border-border/40">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-muted-foreground">Collection Progress</span>
          <div className="flex items-center gap-1.5">
            <span className={isPaidComplete ? "text-emerald-400 font-bold" : "text-foreground"}>
              {cycle.paidCount} / {cycle.totalMembers}
            </span>
            <span className="text-muted-foreground">({collectionPercentage}%)</span>
          </div>
        </div>
        <div className="w-full h-1.5 bg-muted/60 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              isPaidComplete
                ? "bg-emerald-400"
                : cycle.paidCount > 0
                ? "bg-primary"
                : "bg-transparent"
            }`}
            style={{ width: `${collectionPercentage}%` }}
          />
        </div>
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40">
        <div className="text-[11px] font-mono text-muted-foreground">
          {cycle.totalMembers} {cycle.totalMembers === 1 ? "member" : "members"}
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {/* Inspect Details */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onInspect(cycle._id);
            }}
            className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-primary/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Inspect cycle details & roster"
            aria-label="Inspect cycle details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {/* Edit Cycle */}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(cycle);
              }}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-primary/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              title="Edit cycle metadata"
              aria-label="Edit cycle metadata"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sync Active Members */}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void onSync(cycle._id);
              }}
              disabled={isSyncing}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-primary/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all cursor-pointer disabled:opacity-50"
              title="Sync missing organization members"
              aria-label="Sync roster"
            >
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Delete / Archive */}
          {canManage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(cycle);
              }}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] border border-border/60 hover:border-rose-500/60 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-all cursor-pointer"
              title={cycle.paidCount > 0 ? "Archive cycle (CLE payments exist)" : "Permanently delete cycle"}
              aria-label="Delete or archive cycle"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export function DuesCyclesManager({
  organizationId,
  organizationName: _organizationName,
  fundId,
  fundName: _fundName,
  currency = "IDR",
  canManage = false,
  canSign = false,
  onOpenCreateDues,
  onOpenRecordPayment,
  onOpenInvoiceDetails,
  onOpenCreateInvoice,
}: DuesCyclesManagerProps) {
  const { t } = useTranslation();
  const { money: formatMoney, date: formatDate } = useFormat();

  // Queries
  const cycles = useQuery(api.treasury.dues.listDuesEvents, {
    organizationId,
    fundId,
    includeArchived: true,
  });

  // Mutations
  const deleteCycleMutation = useMutation(api.treasury.dues.deleteDuesCycle);
  const deleteBatchMutation = useMutation(api.treasury.dues.deleteBatchDuesCycles);
  const syncCycleMutation = useMutation(api.treasury.dues.syncCycleMembers);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<Id<"duesEvents">>>(new Set());

  // Modal State
  const [cycleToEdit, setCycleToEdit] = useState<CycleItem | null>(null);
  const [cycleForDetails, setCycleForDetails] = useState<Id<"duesEvents"> | null>(null);
  const [cycleToDelete, setCycleToDelete] = useState<CycleItem | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bulk Modals State
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [batchDeleteError, setBatchDeleteError] = useState<string | null>(null);
  const [isBulkDateModalOpen, setIsBulkDateModalOpen] = useState(false);
  const [isBulkAmountModalOpen, setIsBulkAmountModalOpen] = useState(false);

  // Row sync loading indicator map
  const [syncingRowId, setSyncingRowId] = useState<Id<"duesEvents"> | null>(null);

  // Filter cycles
  const filteredCycles = useMemo(() => {
    if (!cycles) return [];
    return cycles.filter((c) => {
      // Status filter
      if (statusFilter === "archived" && !c.isArchived) return false;
      if (statusFilter !== "archived" && c.isArchived && statusFilter !== "all") return false;

      if (statusFilter === "completed") {
        if (c.isArchived || c.totalMembers === 0 || c.paidCount < c.totalMembers) return false;
      } else if (statusFilter === "in_progress") {
        if (c.isArchived || c.paidCount === 0 || c.paidCount >= c.totalMembers) return false;
      } else if (statusFilter === "unpaid") {
        if (c.isArchived || c.paidCount > 0) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return c.periodLabel.toLowerCase().includes(q);
      }

      return true;
    });
  }, [cycles, statusFilter, searchQuery]);

  // Reset page when search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  // Pagination slicing
  const totalItems = filteredCycles.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedCycles = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredCycles.slice(start, start + pageSize);
  }, [filteredCycles, validCurrentPage, pageSize]);

  // Multi-Select Handlers
  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedCycles.length === 0) return false;
    return paginatedCycles.every((c) => selectedIds.has(c._id));
  }, [paginatedCycles, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllCurrentPageSelected) {
      const next = new Set(selectedIds);
      paginatedCycles.forEach((c) => next.delete(c._id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      paginatedCycles.forEach((c) => next.add(c._id));
      setSelectedIds(next);
    }
  };

  const handleToggleSelectRow = (id: Id<"duesEvents">) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // Single Delete / Archive Handler
  const handleConfirmSingleDelete = async () => {
    if (!cycleToDelete) return;
    setIsDeletingSingle(true);
    setDeleteError(null);
    try {
      await deleteCycleMutation({
        organizationId,
        fundId,
        duesEventId: cycleToDelete._id,
        allowArchive: true,
      });
      // Deselect if was selected
      if (selectedIds.has(cycleToDelete._id)) {
        const next = new Set(selectedIds);
        next.delete(cycleToDelete._id);
        setSelectedIds(next);
      }
      setCycleToDelete(null);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete/archive cycle.");
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Batch Delete / Archive Handler
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);
    setBatchDeleteError(null);
    try {
      await deleteBatchMutation({
        organizationId,
        fundId,
        duesEventIds: Array.from(selectedIds),
        allowArchive: true,
      });
      setSelectedIds(new Set());
      setIsBatchDeleteOpen(false);
    } catch (err: unknown) {
      setBatchDeleteError(err instanceof Error ? err.message : "Failed to process batch deletion.");
    } finally {
      setIsBatchDeleting(false);
    }
  };

  // Row Sync Member Handler
  const handleSyncRow = async (cycleId: Id<"duesEvents">) => {
    setSyncingRowId(cycleId);
    try {
      const res = await syncCycleMutation({
        organizationId,
        fundId,
        duesEventId: cycleId,
      });
      if (res.addedCount > 0) {
        // Successfully synced
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sync roster.");
    } finally {
      setSyncingRowId(null);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className={`space-y-4 relative ${selectedCount > 0 ? "pb-44 md:pb-24" : "pb-16 md:pb-0"}`}>
      {/* Search, Filter & Action Toolbar */}
      <Panel className="p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("treasury.dues.searchCyclesPlaceholder", "Search dues cycles by period label...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              chamfer="none"
              className="pl-8 h-8 text-xs w-full font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Pill Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center border border-border rounded-[var(--fintech-radius-sm)] bg-card overflow-hidden h-8">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 text-xs font-mono transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-primary/20 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({cycles?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`px-2.5 text-xs font-mono border-l border-border transition-colors cursor-pointer ${
                  statusFilter === "completed"
                    ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("in_progress")}
                className={`px-2.5 text-xs font-mono border-l border-border transition-colors cursor-pointer ${
                  statusFilter === "in_progress"
                    ? "bg-cyan-500/20 text-cyan-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("unpaid")}
                className={`px-2.5 text-xs font-mono border-l border-border transition-colors cursor-pointer ${
                  statusFilter === "unpaid"
                    ? "bg-amber-500/20 text-amber-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unpaid
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("archived")}
                className={`px-2.5 text-xs font-mono border-l border-border transition-colors cursor-pointer ${
                  statusFilter === "archived"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Archived
              </button>
            </div>

            {/* Create Cycle Button */}
            {canManage && onOpenCreateDues && (
              <Button
                type="button"
                variant="cyber"
                chamfer="none"
                size="sm"
                onClick={onOpenCreateDues}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer font-semibold shrink-0"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>{t("treasury.dues.createCycleBtn", "Create Cycle")}</span>
              </Button>
            )}
          </div>
        </div>
      </Panel>

      {/* Main Paginated Table Panel */}
      <Panel className="p-0 overflow-hidden">
        {cycles === undefined ? (
          <div className="p-12 text-center text-xs text-muted-foreground animate-pulse font-mono">
            Loading dues cycles...
          </div>
        ) : paginatedCycles.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
            <p className="text-xs text-muted-foreground">
              {t("treasury.dues.noCyclesFound", "No dues cycles found matching your criteria.")}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View (>= 768px / md:) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/80 bg-muted/20 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
                  {/* Select All Checkbox */}
                  <th className="w-10 px-3 py-3 text-center">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      title={isAllCurrentPageSelected ? "Deselect All on Page" : "Select All on Page"}
                    >
                      {isAllCurrentPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>

                  <th className="px-3 py-3 font-medium">Period Label</th>
                  <th className="px-3 py-3 font-medium">Due Date</th>
                  <th className="px-3 py-3 font-medium">Rate / Mbr</th>
                  <th className="px-3 py-3 font-medium">Collection Progress</th>
                  <th className="px-3 py-3 font-medium text-center">Status</th>
                  <th className="px-3 py-3 font-medium text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {paginatedCycles.map((c) => (
                  <DuesCycleTableRow
                    key={c._id}
                    cycle={c}
                    isSelected={selectedIds.has(c._id)}
                    currency={currency}
                    canManage={canManage}
                    isSyncing={syncingRowId === c._id}
                    onToggleSelect={handleToggleSelectRow}
                    onInspect={setCycleForDetails}
                    onEdit={setCycleToEdit}
                    onSync={(id) => void handleSyncRow(id)}
                    onDelete={setCycleToDelete}
                    formatDate={formatDate}
                    formatMoney={formatMoney}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 768px / < md:) */}
          <div className="md:hidden">
            {/* Mobile Select-all Header Strip */}
            <div className="px-3.5 py-2.5 bg-muted/20 border-b border-border/80 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                title={isAllCurrentPageSelected ? "Deselect All on Page" : "Select All on Page"}
                aria-label={isAllCurrentPageSelected ? "Deselect All on Page" : "Select All on Page"}
              >
                {isAllCurrentPageSelected ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                <span>
                  {isAllCurrentPageSelected
                    ? t("treasury.dues.deselectPage", "Deselect Page")
                    : t("treasury.dues.selectPage", "Select All on Page")}
                </span>
              </button>
              <span className="text-[11px] text-muted-foreground">
                {paginatedCycles.length} {paginatedCycles.length === 1 ? "cycle" : "cycles"}
              </span>
            </div>

            {/* Stacked Cards with distinct container separation */}
            <div className="p-3.5 space-y-3 bg-muted/5">
              {paginatedCycles.map((c) => (
                <DuesCycleMobileCard
                  key={c._id}
                  cycle={c}
                  isSelected={selectedIds.has(c._id)}
                  currency={currency}
                  canManage={canManage}
                  isSyncing={syncingRowId === c._id}
                  onToggleSelect={handleToggleSelectRow}
                  onInspect={setCycleForDetails}
                  onEdit={setCycleToEdit}
                  onSync={(id) => void handleSyncRow(id)}
                  onDelete={setCycleToDelete}
                  formatDate={formatDate}
                  formatMoney={formatMoney}
                />
              ))}
            </div>
          </div>
        </>
      )}

        {/* Pagination Bar */}
        {totalItems > 0 && (
          <div className="p-3 border-t border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/10 text-xs text-muted-foreground font-mono">
            <div className="flex items-center gap-2">
              <span>
                {t(
                  "treasury.dues.paginationInfo",
                  `Page ${validCurrentPage} of ${totalPages} (${totalItems} cycles total)`,
                  {
                    current: validCurrentPage,
                    total: totalPages,
                    count: totalItems,
                  }
                )}
              </span>

              {/* Page size dropdown */}
              <div className="flex items-center gap-1 ml-2">
                <span className="text-[10px] text-muted-foreground">Rows:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  className="h-6 px-1.5 bg-background border border-border rounded-[var(--fintech-radius-sm)] text-[11px] text-foreground font-mono cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Prev / Next Page Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-7 px-2 cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              <span className="px-2 py-0.5 rounded-[var(--fintech-radius-sm)] bg-card border border-border font-bold text-foreground">
                {validCurrentPage}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 px-2 cursor-pointer flex items-center gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Panel>

      {/* Floating Multi-Select Action Bar (Active when ≥1 selected) */}
      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+12px)] md:bottom-6 z-50 flex justify-center pointer-events-none px-3">
          <div className="w-full max-w-xl pointer-events-auto p-2.5 sm:p-3 bg-card/95 backdrop-blur-xl border-2 border-primary/25 dark:border-primary/40 rounded-[var(--fintech-radius-lg)] shadow-[0_12px_36px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(var(--primary-rgb),0.25)] flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 animate-in slide-in-from-bottom-4 fade-in duration-200">
            {/* Top Row on Mobile / Left Column on Desktop */}
            <div className="flex items-center justify-between md:justify-start gap-2.5">
              <Badge
                variant="outline"
                className="font-mono text-xs border-primary/50 bg-primary/15 text-primary py-1 px-2.5 shadow-sm font-semibold flex items-center gap-1.5"
              >
                <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{t("treasury.dues.selectedCount", "{{count}} cycle(s) selected", { count: selectedCount })}</span>
              </Badge>

              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline cursor-pointer font-mono flex items-center gap-1 py-1 px-1.5 rounded hover:bg-muted/40 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t("treasury.dues.deselectAll", "Deselect All")}</span>
              </button>
            </div>

            {/* Action Buttons: 3-column equal grid on mobile, inline row on desktop */}
            {canManage && (
              <div className="grid grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center md:gap-1.5 pt-2 border-t border-border/60 md:pt-0 md:border-t-0">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="none"
                  size="sm"
                  onClick={() => setIsBulkDateModalOpen(true)}
                  className="h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer font-mono hover:border-primary/60 px-2 w-full md:w-auto"
                  title="Shift due dates for selected cycles"
                >
                  <CalendarRange className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    <span className="md:hidden">Dates</span>
                    <span className="hidden md:inline">{t("treasury.dues.adjustDatesSelected", "Shift Dates")}</span>
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  chamfer="none"
                  size="sm"
                  onClick={() => setIsBulkAmountModalOpen(true)}
                  className="h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer font-mono hover:border-primary/60 px-2 w-full md:w-auto"
                  title="Change rate for unpaid selected cycles"
                >
                  <Coins className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    <span className="md:hidden">Rate</span>
                    <span className="hidden md:inline">{t("treasury.dues.adjustAmountsSelected", "Adjust Rate")}</span>
                  </span>
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  chamfer="none"
                  size="sm"
                  onClick={() => setIsBatchDeleteOpen(true)}
                  className="h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold shadow-sm px-2 w-full md:w-auto"
                  title="Delete unpaid or archive paid cycles"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    <span className="md:hidden">Delete</span>
                    <span className="hidden md:inline">{t("treasury.dues.deleteSelected", "Delete / Archive")}</span>
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Dues Cycle Modal */}
      <EditDuesModal
        isOpen={Boolean(cycleToEdit)}
        onClose={() => setCycleToEdit(null)}
        organizationId={organizationId}
        fundId={fundId}
        cycle={cycleToEdit}
        currency={currency}
      />

      {/* Deep Inspection Details Modal */}
      <DuesCycleDetailsModal
        isOpen={Boolean(cycleForDetails)}
        onClose={() => setCycleForDetails(null)}
        organizationId={organizationId}
        fundId={fundId}
        duesEventId={cycleForDetails}
        currency={currency}
        canManage={canManage}
        canSign={canSign}
        onOpenRecordPayment={onOpenRecordPayment}
        onOpenInvoiceDetails={onOpenInvoiceDetails}
        onOpenCreateInvoice={onOpenCreateInvoice}
      />

      {/* Bulk Shift Dates Modal */}
      <BulkDateAdjustModal
        isOpen={isBulkDateModalOpen}
        onClose={() => setIsBulkDateModalOpen(false)}
        organizationId={organizationId}
        fundId={fundId}
        cycleIds={Array.from(selectedIds)}
        onSuccess={() => setSelectedIds(new Set())}
      />

      {/* Bulk Adjust Amounts Modal */}
      <BulkAmountAdjustModal
        isOpen={isBulkAmountModalOpen}
        onClose={() => setIsBulkAmountModalOpen(false)}
        organizationId={organizationId}
        fundId={fundId}
        cycleIds={Array.from(selectedIds)}
        currency={currency}
        onSuccess={() => setSelectedIds(new Set())}
      />

      {/* Confirm Single Delete / Archive Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cycleToDelete)}
        onClose={() => {
          setCycleToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmSingleDelete}
        title={
          cycleToDelete && cycleToDelete.paidCount > 0
            ? "Archive Dues Cycle"
            : "Delete Dues Cycle"
        }
        description={
          cycleToDelete
            ? cycleToDelete.paidCount > 0
              ? `Cycle "${cycleToDelete.periodLabel}" has ${cycleToDelete.paidCount} recorded payment(s) in the ledger. It will be safely archived to preserve cryptographic audit integrity while hiding it from active dues collection.`
              : `Are you sure you want to delete cycle "${cycleToDelete.periodLabel}"? All unpaid member assignments will be purged. This action cannot be undone.`
            : ""
        }
        confirmText={
          isDeletingSingle
            ? "Processing..."
            : cycleToDelete && cycleToDelete.paidCount > 0
            ? "Archive Cycle"
            : "Delete Cycle"
        }
        variant={cycleToDelete && cycleToDelete.paidCount > 0 ? "warning" : "danger"}
        isLoading={isDeletingSingle}
        error={deleteError}
      />

      {/* Confirm Batch Delete / Archive Dialog */}
      <ConfirmDialog
        isOpen={isBatchDeleteOpen}
        onClose={() => {
          setIsBatchDeleteOpen(false);
          setBatchDeleteError(null);
        }}
        onConfirm={handleConfirmBatchDelete}
        title="Delete / Archive Selected Cycles"
        description={`Are you sure you want to process ${selectedCount} selected cycle(s)? Unpaid cycles will be permanently deleted; cycles with existing ledger payments will be safely archived to preserve audit integrity.`}
        confirmText={isBatchDeleting ? "Processing Batch..." : `Process ${selectedCount} Cycles`}
        variant="danger"
        isLoading={isBatchDeleting}
        error={batchDeleteError}
      />
    </div>
  );
}
