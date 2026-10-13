import { Button, Input } from "@boredkevin/ui";
import { Layers, Minus, Plus, Sparkles } from "lucide-react";
import { RangeType } from "./isoWeekUtils";

export interface BatchRangeCyclePreview {
  periodLabel: string;
  dueDate: number;
  formattedDate: string;
  amount: number;
  isDuplicate: boolean;
}

export interface BatchRangeFormProps {
  rangeType: RangeType;
  setRangeType: (type: RangeType) => void;
  rangeYear: number;
  setRangeYear: (year: number) => void;
  startWeek: number;
  setStartWeek: React.Dispatch<React.SetStateAction<number>>;
  endWeek: number;
  setEndWeek: React.Dispatch<React.SetStateAction<number>>;
  startMonth: number;
  setStartMonth: (m: number) => void;
  startMonthYear: number;
  setStartMonthYear: (y: number) => void;
  endMonth: number;
  setEndMonth: (m: number) => void;
  endMonthYear: number;
  setEndMonthYear: (y: number) => void;
  monthNames: string[];
  rangeStartDate: string;
  setRangeStartDate: (d: string) => void;
  rangeEndDate: string;
  setRangeEndDate: (d: string) => void;
  rangeIntervalDays: number;
  setRangeIntervalDays: (days: number) => void;
  computedRangeCycles: BatchRangeCyclePreview[];
  duplicateCyclesCount: number;
  currentFund?: { currency?: string };
  isSubmitting: boolean;
  handleWeekPreset: (start: number, end: number) => void;
  currentIso: { year: number; week: number };
}

export function BatchRangeForm({
  rangeType,
  setRangeType,
  rangeYear,
  setRangeYear,
  startWeek,
  setStartWeek,
  endWeek,
  setEndWeek,
  startMonth,
  setStartMonth,
  startMonthYear,
  setStartMonthYear,
  endMonth,
  setEndMonth,
  endMonthYear,
  setEndMonthYear,
  monthNames,
  rangeStartDate,
  setRangeStartDate,
  rangeEndDate,
  setRangeEndDate,
  rangeIntervalDays,
  setRangeIntervalDays,
  computedRangeCycles,
  duplicateCyclesCount,
  currentFund,
  isSubmitting,
  handleWeekPreset,
  currentIso,
}: BatchRangeFormProps) {
  return (
    <div className="space-y-4 p-3.5 bg-background/50 border border-border/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Layers className="w-4 h-4 text-primary" />
          <span>Range Type</span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant={rangeType === "weeks" ? "cyber" : "outline"}
            chamfer="none"
            size="sm"
            onClick={() => setRangeType("weeks")}
            className="h-7 text-[11px] px-2 cursor-pointer font-mono"
          >
            Weekly (Wk #)
          </Button>
          <Button
            type="button"
            variant={rangeType === "months" ? "cyber" : "outline"}
            chamfer="none"
            size="sm"
            onClick={() => setRangeType("months")}
            className="h-7 text-[11px] px-2 cursor-pointer font-mono"
          >
            Monthly Range
          </Button>
          <Button
            type="button"
            variant={rangeType === "dates" ? "cyber" : "outline"}
            chamfer="none"
            size="sm"
            onClick={() => setRangeType("dates")}
            className="h-7 text-[11px] px-2 cursor-pointer font-mono"
          >
            Date Range
          </Button>
        </div>
      </div>

      {/* Range Type: WEEKS (e.g. Week 20 - Week 35) */}
      {rangeType === "weeks" && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-muted-foreground">
                Year
              </label>
              <select
                value={rangeYear}
                onChange={(e) => setRangeYear(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground font-mono cursor-pointer"
              >
                {[currentIso.year - 2, currentIso.year - 1, currentIso.year, currentIso.year + 1].map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-muted-foreground">
                  Start Week (1–53)
                </label>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  disabled={isSubmitting || startWeek <= 1}
                  onClick={() => setStartWeek((prev) => Math.max(1, prev - 1))}
                  className="h-8 w-7 p-0 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={startWeek}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setStartWeek(Math.min(53, Math.max(1, val)));
                  }}
                  className="w-full h-8 text-center font-mono font-bold text-xs bg-background border border-border text-primary"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  disabled={isSubmitting || startWeek >= 53}
                  onClick={() => setStartWeek((prev) => Math.min(53, prev + 1))}
                  className="h-8 w-7 p-0 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-muted-foreground">
                  End Week (1–53)
                </label>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  disabled={isSubmitting || endWeek <= 1}
                  onClick={() => setEndWeek((prev) => Math.max(1, prev - 1))}
                  className="h-8 w-7 p-0 flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3 h-3" />
                </Button>
                <input
                  type="number"
                  min={1}
                  max={53}
                  value={endWeek}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setEndWeek(Math.min(53, Math.max(1, val)));
                  }}
                  className="w-full h-8 text-center font-mono font-bold text-xs bg-background border border-border text-primary"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  disabled={isSubmitting || endWeek >= 53}
                  onClick={() => setEndWeek((prev) => Math.min(53, prev + 1))}
                  className="h-8 w-7 p-0 flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Week Presets */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-mono text-muted-foreground">Presets:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isSubmitting}
              onClick={() => handleWeekPreset(20, 35)}
              className="h-6 text-[10px] font-mono px-2 border-border/80 hover:border-primary cursor-pointer"
            >
              Wk 20 – 35
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isSubmitting}
              onClick={() => handleWeekPreset(1, 13)}
              className="h-6 text-[10px] font-mono px-2 border-border/80 hover:border-primary cursor-pointer"
            >
              Q1 (Wk 1–13)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isSubmitting}
              onClick={() => handleWeekPreset(14, 26)}
              className="h-6 text-[10px] font-mono px-2 border-border/80 hover:border-primary cursor-pointer"
            >
              Q2 (Wk 14–26)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isSubmitting}
              onClick={() => handleWeekPreset(27, 39)}
              className="h-6 text-[10px] font-mono px-2 border-border/80 hover:border-primary cursor-pointer"
            >
              Q3 (Wk 27–39)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isSubmitting}
              onClick={() => handleWeekPreset(1, currentIso.week)}
              className="h-6 text-[10px] font-mono px-2 border-border/80 hover:border-primary cursor-pointer"
            >
              Year-to-Date
            </Button>
          </div>
        </div>
      )}

      {/* Range Type: MONTHS */}
      {rangeType === "months" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-muted-foreground">
              From Month
            </label>
            <div className="flex gap-1.5">
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-2/3 h-8 px-2 bg-background border border-border text-xs text-foreground font-mono cursor-pointer"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={startMonthYear}
                onChange={(e) => setStartMonthYear(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-1/3 h-8 px-2 bg-background border border-border text-xs text-foreground font-mono cursor-pointer"
              >
                {[currentIso.year - 2, currentIso.year - 1, currentIso.year, currentIso.year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-muted-foreground">
              To Month
            </label>
            <div className="flex gap-1.5">
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-2/3 h-8 px-2 bg-background border border-border text-xs text-foreground font-mono cursor-pointer"
              >
                {monthNames.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={endMonthYear}
                onChange={(e) => setEndMonthYear(parseInt(e.target.value, 10))}
                disabled={isSubmitting}
                className="w-1/3 h-8 px-2 bg-background border border-border text-xs text-foreground font-mono cursor-pointer"
              >
                {[currentIso.year - 2, currentIso.year - 1, currentIso.year, currentIso.year + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Range Type: CUSTOM DATES */}
      {rangeType === "dates" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-muted-foreground">
              Start Date
            </label>
            <Input
              type="date"
              value={rangeStartDate}
              disabled={isSubmitting}
              onChange={(e) => setRangeStartDate(e.target.value)}
              chamfer="none"
              className="h-8 font-mono text-xs cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-muted-foreground">
              End Date
            </label>
            <Input
              type="date"
              value={rangeEndDate}
              disabled={isSubmitting}
              onChange={(e) => setRangeEndDate(e.target.value)}
              chamfer="none"
              className="h-8 font-mono text-xs cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-muted-foreground">
              Cadence (Days)
            </label>
            <Input
              type="number"
              min={1}
              max={365}
              value={rangeIntervalDays}
              disabled={isSubmitting}
              onChange={(e) => setRangeIntervalDays(parseInt(e.target.value, 10) || 7)}
              chamfer="none"
              className="h-8 font-mono text-xs"
            />
          </div>
        </div>
      )}

      {/* Generated Period Preview List */}
      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground font-mono flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Generated Periods ({computedRangeCycles.length} total)</span>
          </span>
          {duplicateCyclesCount > 0 && (
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 border border-amber-500/30">
              {duplicateCyclesCount} duplicate(s) will be skipped
            </span>
          )}
        </div>

        <div className="max-h-36 overflow-y-auto border border-border/80 bg-muted/20 p-2 space-y-1 font-mono text-xs">
          {computedRangeCycles.length === 0 ? (
            <div className="py-3 text-center text-muted-foreground text-[11px]">
              No periods generated for the selected range.
            </div>
          ) : (
            computedRangeCycles.map((cycle, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-1.5 rounded text-[11px] border ${
                  cycle.isDuplicate
                    ? "bg-muted/30 border-border/40 text-muted-foreground opacity-60"
                    : "bg-background/80 border-border/60 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-primary font-bold">{idx + 1}.</span>
                  <span className="font-semibold">{cycle.periodLabel}</span>
                  <span className="text-muted-foreground text-[10px]">({cycle.formattedDate})</span>
                </div>

                <div>
                  {cycle.isDuplicate ? (
                    <span className="text-[9px] font-bold text-amber-400 px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30">
                      EXISTS (SKIP)
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      +{currentFund?.currency ?? "IDR"}{" "}
                      {cycle.amount.toLocaleString(
                        currentFund?.currency === "IDR" ? "id-ID" : undefined
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
