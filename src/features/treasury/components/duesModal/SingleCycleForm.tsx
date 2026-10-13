import { Button, Input, Badge } from "@boredkevin/ui";
import { History, Clock, Check, CalendarDays } from "lucide-react";

export interface SingleCycleFormProps {
  isSubmitting: boolean;
  handleSinglePreset: (monthsAgo: number) => void;
  isSinglePastDate: boolean;
  dateInput: string;
  setDateInput: (date: string) => void;
  setError: (err: string | null) => void;
  customLabel: string;
  setCustomLabel: (label: string) => void;
  suggestedLabel: string;
  effectiveSingleLabel: string;
}

export function SingleCycleForm({
  isSubmitting,
  handleSinglePreset,
  isSinglePastDate,
  dateInput,
  setDateInput,
  setError,
  customLabel,
  setCustomLabel,
  suggestedLabel,
  effectiveSingleLabel,
}: SingleCycleFormProps) {
  return (
    <div className="space-y-4 p-3.5 bg-background/50 border border-border/80">
      {/* Quick Presets for Single Past Dates */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-primary" />
            <span>Quick Date Presets</span>
          </label>
          <span className="text-[10px] font-mono text-muted-foreground">
            Select relative period
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            disabled={isSubmitting}
            onClick={() => handleSinglePreset(0)}
            className="h-7 text-[11px] font-mono px-1 border-border/80 hover:border-primary cursor-pointer"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            disabled={isSubmitting}
            onClick={() => handleSinglePreset(1)}
            className="h-7 text-[11px] font-mono px-1 border-border/80 hover:border-primary cursor-pointer"
          >
            1 Mo Ago
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            disabled={isSubmitting}
            onClick={() => handleSinglePreset(2)}
            className="h-7 text-[11px] font-mono px-1 border-border/80 hover:border-primary cursor-pointer"
          >
            2 Mo Ago
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            disabled={isSubmitting}
            onClick={() => handleSinglePreset(3)}
            className="h-7 text-[11px] font-mono px-1 border-border/80 hover:border-primary cursor-pointer"
          >
            3 Mo Ago
          </Button>
        </div>
      </div>

      {/* Due Date Input & Past Status Pill */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">
            Due Date *
          </label>
          {isSinglePastDate ? (
            <Badge
              variant="secondary"
              className="text-[10px] font-mono px-2 py-0.5 border-amber-500/40 text-amber-300 bg-amber-500/15 font-bold flex items-center gap-1"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>PAST DATE (RETROACTIVE)</span>
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="text-[10px] font-mono px-2 py-0.5 border-emerald-500/40 text-emerald-300 bg-emerald-500/15 font-bold flex items-center gap-1"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>CURRENT / FUTURE</span>
            </Badge>
          )}
        </div>
        <Input
          type="date"
          value={dateInput}
          disabled={isSubmitting}
          onChange={(e) => {
            setDateInput(e.target.value);
            setError(null);
          }}
          chamfer="none"
          className="font-mono text-xs cursor-pointer"
          required
        />
      </div>

      {/* Period Label Override */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>Period Label</span>
          </label>
          <span className="text-[10px] text-muted-foreground font-mono">
            Suggested: {suggestedLabel || "None"}
          </span>
        </div>
        <Input
          type="text"
          placeholder={suggestedLabel || "e.g. July 2026 Dues"}
          value={customLabel}
          disabled={isSubmitting}
          onChange={(e) => setCustomLabel(e.target.value)}
          chamfer="none"
          className="text-xs font-mono"
        />
        <p className="text-[10px] text-muted-foreground font-mono">
          Display name: <strong className="text-foreground">{effectiveSingleLabel || "Untitled Period"}</strong>
        </p>
      </div>
    </div>
  );
}
