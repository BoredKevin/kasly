import React from "react";
import { Button } from "@boredkevin/ui";
import { Lock, Sparkles } from "lucide-react";

export interface HoldToSignButtonProps {
  paymentMode: "manual" | "dues";
  currency: string;
  duesCalculatedAmount: number;
  isSigning: boolean;
  isHolding: boolean;
  holdProgress: number;
  holdDurationMs: number;
  isSubmitDisabled: boolean;
  cancelLabel: string;
  onClose: () => void;
  onPointerDown: (e: React.SyntheticEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export function HoldToSignButton({
  paymentMode,
  currency,
  duesCalculatedAmount,
  isSigning,
  isHolding,
  holdProgress,
  holdDurationMs,
  isSubmitDisabled,
  cancelLabel,
  onClose,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}: HoldToSignButtonProps) {
  return (
    <div className="pt-3 border-t border-border space-y-1.5">
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          chamfer="none"
          onClick={onClose}
          disabled={isSigning || isHolding}
          size="sm"
          className="text-xs cursor-pointer"
        >
          {cancelLabel}
        </Button>
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
          className={`relative overflow-hidden text-xs flex items-center justify-center gap-1.5 cursor-pointer select-none px-4 py-2 min-w-[220px] transition-all ${
            isHolding ? "border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.3)]" : ""
          }`}
        >
          {/* 3-second Hold Progress Fill */}
          {isHolding && (
            <div
              className="absolute inset-0 bg-emerald-500/35 pointer-events-none transition-none"
              style={{
                width: `${Math.min(100, holdProgress * 100)}%`,
              }}
            />
          )}

          <span className="relative z-10 flex items-center gap-1.5 font-mono">
            {isSigning ? (
              <>
                <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Signing & Committing...</span>
              </>
            ) : isHolding ? (
              <>
                <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>
                  Hold to Sign: {((holdDurationMs * (1 - holdProgress)) / 1000).toFixed(1)}s
                </span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {paymentMode === "dues"
                    ? `Hold to Sign (${currency} ${duesCalculatedAmount.toLocaleString("id-ID")})`
                    : "Hold to Sign & Commit"}
                </span>
              </>
            )}
          </span>
        </Button>
      </div>
      {!isSubmitDisabled && !isSigning && (
        <p className="text-[10px] font-mono text-muted-foreground text-right">
          ⚠️You cannot undo this action!
        </p>
      )}
    </div>
  );
}
