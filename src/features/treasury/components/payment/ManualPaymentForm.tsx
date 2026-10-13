import { Button, Input } from "@boredkevin/ui";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export interface ManualPaymentFormProps {
  direction: "credit" | "debit";
  amountInput: string;
  memo: string;
  currency: string;
  isSigning: boolean;
  onDirectionChange: (direction: "credit" | "debit") => void;
  onAmountChange: (amount: string) => void;
  onMemoChange: (memo: string) => void;
}

export function ManualPaymentForm({
  direction,
  amountInput,
  memo,
  currency,
  isSigning,
  onDirectionChange,
  onAmountChange,
  onMemoChange,
}: ManualPaymentFormProps) {
  return (
    <>
      {/* Transaction Direction Selector Tab */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Transaction Direction *
        </label>
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 border border-border/80">
          <Button
            type="button"
            variant={direction === "credit" ? "cyber" : "ghost"}
            chamfer="none"
            size="sm"
            onClick={() => onDirectionChange("credit")}
            className={`h-8 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              direction === "credit"
                ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/70 shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
            <span>Credit (Income)</span>
          </Button>
          <Button
            type="button"
            variant={direction === "debit" ? "cyber" : "ghost"}
            chamfer="none"
            size="sm"
            onClick={() => onDirectionChange("debit")}
            className={`h-8 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
              direction === "debit"
                ? "bg-red-500/25 text-red-300 border border-red-500/70 shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-red-400" />
            <span>Debit (Expense)</span>
          </Button>
        </div>
      </div>

      {/* Amount Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">
            Amount ({currency}) *
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            Smallest Integer Units
          </span>
        </div>
        <Input
          type="text"
          placeholder="e.g. 500000"
          value={amountInput}
          disabled={isSigning}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, "");
            onAmountChange(val);
          }}
          chamfer="none"
          required
        />
        {amountInput && (
          <p className="text-[11px] font-mono text-primary">
            Formatted: {currency} {parseInt(amountInput, 10).toLocaleString()}
          </p>
        )}
      </div>

      {/* Memo */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Memo / Description *
        </label>
        <Input
          type="text"
          placeholder="e.g. Operating expense / grant receipt"
          value={memo}
          disabled={isSigning}
          onChange={(e) => onMemoChange(e.target.value)}
          chamfer="none"
          required
        />
      </div>
    </>
  );
}
