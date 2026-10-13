import React from "react";
import { Button } from "@boredkevin/ui";
import { Lock, Sparkles } from "lucide-react";

export interface BulkDuesCommitBarProps {
  totalBatchAmount: number;
  currency: string;
  pendingCount: number;
  totalBatchCycles: number;
  isProcessing: boolean;
  isSubmitDisabled: boolean;
  isHolding: boolean;
  holdProgress: number;
  holdDurationMs: number;
  batchProgress: { current: number; total: number };
  formatMoney: (amount: number, currency: string) => string;
  onPointerDown: (e: React.SyntheticEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export function BulkDuesCommitBar({
  totalBatchAmount,
  currency,
  pendingCount,
  totalBatchCycles,
  isProcessing,
  isSubmitDisabled,
  isHolding,
  holdProgress,
  holdDurationMs,
  batchProgress,
  formatMoney,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: BulkDuesCommitBarProps) {
  return (
    <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="text-xs font-semibold text-foreground flex items-center gap-2">
          <span>Batch Total:</span>
          <span className="font-mono text-emerald-400 text-sm font-bold">
            {formatMoney(totalBatchAmount, currency)}
          </span>
          <span className="text-muted-foreground text-xs">
            ({pendingCount} member{pendingCount === 1 ? "" : "s"} · {totalBatchCycles} cycle{totalBatchCycles === 1 ? "" : "s"})
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isProcessing
            ? `Committing sequential blocks: ${batchProgress.current} / ${batchProgress.total} completed...`
            : "Transactions are cryptographically signed sequentially using your local browser key."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="cyber"
          chamfer="none"
          size="sm"
          disabled={isSubmitDisabled}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative overflow-hidden text-xs flex items-center justify-center gap-1.5 cursor-pointer select-none px-6 py-2.5 min-w-[260px] transition-all rounded-[var(--fintech-radius-md)] ${
            isHolding ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.35)]" : ""
          }`}
        >
          {isHolding && (
            <div
              className="absolute inset-0 bg-emerald-500/35 pointer-events-none transition-none"
              style={{
                width: `${Math.min(100, holdProgress * 100)}%`,
              }}
            />
          )}

          <span className="relative z-10 flex items-center gap-1.5 font-bold">
            {isProcessing ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>
                  Processing {batchProgress.current + 1} of {batchProgress.total}...
                </span>
              </>
            ) : isHolding ? (
              <>
                <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>
                  Hold to Commit: {((holdDurationMs * (1 - holdProgress)) / 1000).toFixed(1)}s
                </span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>
                  Hold to Sign Batch ({formatMoney(totalBatchAmount, currency)})
                </span>
              </>
            )}
          </span>
        </Button>
      </div>
    </div>
  );
}
