import { memo } from "react";
import { Badge } from "@boredkevin/ui";
import { StatusPill } from "../../../../ui/StatusPill";
import {
  CheckSquare,
  Square,
  Trash2,
  Edit2,
  Eye,
  UserPlus,
  Loader2,
} from "lucide-react";
import { DuesCycleItemProps } from "./duesCycleTypes";

/**
 * Mobile Stacked Card Item Component (< 768px / < md:)
 */
export const DuesCycleMobileCard = memo(function DuesCycleMobileCard({
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
