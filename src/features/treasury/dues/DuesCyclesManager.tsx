import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Panel } from "../../../ui/Panel";
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
  ChevronLeft,
  ChevronRight,
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

import {
  CycleItem,
  StatusFilter,
} from "./components/duesCycleTypes";
import { DuesCycleTableRow } from "./components/DuesCycleTableRow";
import { DuesCycleMobileCard } from "./components/DuesCycleMobileCard";


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
