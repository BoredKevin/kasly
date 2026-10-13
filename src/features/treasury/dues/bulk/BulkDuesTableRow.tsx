import { Id } from "../../../../../convex/_generated/dataModel";
import { ResolvedStagedRow } from "./bulkDuesTypes";
import { StatusPill } from "../../../../ui/StatusPill";
import { Minus, Plus, CheckCheck, Sparkles, AlertTriangle, Trash2 } from "lucide-react";

export interface BulkDuesTableRowProps {
  row: ResolvedStagedRow;
  currency: string;
  isProcessing: boolean;
  formatMoney: (amount: number, currency: string) => string;
  onUpdatePeriodCount: (rowId: string, count: number, maxCount: number) => void;
  onUpdateCustomMemo: (rowId: string, memo: string) => void;
  onRemoveRow: (rowId: string) => void;
  onInspectEntry?: (entryId: Id<"ledgerEntries">) => void;
}

export function BulkDuesTableRow({
  row,
  currency,
  isProcessing,
  formatMoney,
  onUpdatePeriodCount,
  onUpdateCustomMemo,
  onRemoveRow,
  onInspectEntry,
}: BulkDuesTableRowProps) {
  const isCompleted = row.status === "completed";
  const isRowSigning = row.status === "signing";
  const isRowError = row.status === "error";

  return (
    <tr
      className={`transition-colors ${
        isCompleted
          ? "bg-emerald-500/5 opacity-80"
          : isRowError
          ? "bg-destructive/10"
          : "hover:bg-muted/20"
      }`}
    >
      {/* Member Info */}
      <td className="py-2.5 px-4">
        <div className="font-semibold text-foreground flex items-center gap-1.5">
          <span>{row.member?.nickname || row.member?.name || "Member"}</span>
          {row.unpaidEvents.length > 0 && (
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded-[var(--fintech-radius-sm)] border border-amber-500/30">
              {row.unpaidEvents.length} due
            </span>
          )}
        </div>
        {row.member?.nickname && (
          <div className="text-[11px] text-muted-foreground">
            {row.member.name}
          </div>
        )}
      </td>

      {/* Cycles Stepper */}
      <td className="py-2.5 px-3 text-center">
        {isCompleted ? (
          <span className="text-xs font-bold text-emerald-400">
            {row.periodCount} cycle{row.periodCount > 1 ? "s" : ""}
          </span>
        ) : (
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={isProcessing || row.periodCount <= 1}
              onClick={() =>
                onUpdatePeriodCount(
                  row.id,
                  row.periodCount - 1,
                  row.unpaidEvents.length
                )
              }
              className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
            >
              <Minus className="w-3 h-3" />
            </button>

            <span className="w-7 text-center font-bold text-xs text-primary font-mono">
              {row.periodCount}
            </span>

            <button
              type="button"
              disabled={
                isProcessing || row.periodCount >= row.unpaidEvents.length
              }
              onClick={() =>
                onUpdatePeriodCount(
                  row.id,
                  row.periodCount + 1,
                  row.unpaidEvents.length
                )
              }
              className="h-6 w-6 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </td>

      {/* Covered Cycles */}
      <td className="py-2.5 px-3 text-xs text-muted-foreground">
        {row.periodRange || "—"}
      </td>

      {/* Calculated Amount */}
      <td className="py-2.5 px-3 text-right font-bold text-emerald-400 font-mono">
        {formatMoney(row.amount, currency)}
      </td>

      {/* Memo Input */}
      <td className="py-2.5 px-3">
        {isCompleted ? (
          <span className="text-xs text-muted-foreground truncate block max-w-xs">
            {row.effectiveMemo}
          </span>
        ) : (
          <input
            type="text"
            value={row.customMemo}
            placeholder={row.defaultMemo}
            disabled={isProcessing}
            onChange={(e) => onUpdateCustomMemo(row.id, e.target.value)}
            className="w-full h-7 px-2 bg-background border border-border rounded-[var(--fintech-radius-sm)] text-xs text-foreground focus:outline-none focus:border-primary font-mono"
          />
        )}
      </td>

      {/* Status Column */}
      <td className="py-2.5 px-3 text-center">
        {isCompleted ? (
          <div className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
            <CheckCheck className="w-3.5 h-3.5" />
            {row.entryId && onInspectEntry ? (
              <button
                type="button"
                onClick={() => onInspectEntry(row.entryId!)}
                className="underline hover:text-emerald-300 cursor-pointer"
              >
                Recorded
              </button>
            ) : (
              <span>Recorded</span>
            )}
          </div>
        ) : isRowSigning ? (
          <div className="inline-flex items-center gap-1 text-primary text-xs font-semibold animate-pulse">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Signing...</span>
          </div>
        ) : isRowError ? (
          <div
            className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold"
            title={row.errorMessage}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </div>
        ) : (
          <StatusPill tone="neutral">
            Staged
          </StatusPill>
        )}
      </td>

      {/* Action Column */}
      <td className="py-2.5 px-3 text-center">
        {!isCompleted && !isRowSigning && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onRemoveRow(row.id)}
            className="p-1 text-muted-foreground hover:text-rose-400 cursor-pointer"
            title="Remove from batch"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}
