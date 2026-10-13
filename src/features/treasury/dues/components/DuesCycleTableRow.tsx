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
 * Desktop Tabular Row Component (>= 768px / md:)
 */
export const DuesCycleTableRow = memo(function DuesCycleTableRow({
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
