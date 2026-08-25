import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  CalendarPlus,
  X,
  History,
  Clock,
  Sparkles,
  Users,
  Coins,
  CalendarDays,
  CalendarRange,
  Check,
  Layers,
  Minus,
  Plus,
  Info,
} from "lucide-react";

interface CreateManualDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  defaultFundId: Id<"funds"> | null;
  onSuccess?: () => void;
}

type CreationMode = "single" | "range";
type RangeType = "weeks" | "months" | "dates";

function getDateFromIsoWeek(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const firstMonday = new Date(jan4.getTime() - jan4Day * 86400000);
  const targetThursday = new Date(firstMonday.getTime() + ((weekNumber - 1) * 7 + 3) * 86400000);
  targetThursday.setHours(12, 0, 0, 0);
  return targetThursday;
}

function formatDateToInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSuggestedPeriodLabel(
  dateStr: string,
  intervalType: "weekly" | "monthly" | "custom_days" = "monthly"
): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return "";

  if (intervalType === "monthly") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else if (intervalType === "weekly") {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `Week ${weekNumber}, ${d.getFullYear()}`;
  } else {
    return `Cycle of ${d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
}

function getCurrentIsoWeekNumber(): { year: number; week: number } {
  const now = new Date();
  const target = new Date(now.valueOf());
  const dayNr = (now.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: now.getFullYear(), week: weekNumber };
}

export function CreateManualDuesModal({
  isOpen,
  onClose,
  organizationId,
  defaultFundId,
  onSuccess,
}: CreateManualDuesModalProps) {
  const { t } = useTranslation();
  const funds = useQuery(api.treasury.funds.list, { organizationId });
  const members = useQuery(api.members.list, { organizationId });

  const [selectedFundIdState, setSelectedFundIdState] = useState<Id<"funds"> | null>(
    defaultFundId ?? null
  );

  const selectedFundId = selectedFundIdState ?? defaultFundId ?? funds?.[0]?._id ?? null;
  const currentFund = funds?.find((f) => f._id === selectedFundId);

  const duesConfig = useQuery(
    api.treasury.dues.getDuesConfig,
    organizationId && selectedFundId
      ? { organizationId, fundId: selectedFundId }
      : "skip"
  );

  const existingEvents = useQuery(
    api.treasury.dues.listDuesEvents,
    organizationId && selectedFundId
      ? { organizationId, fundId: selectedFundId, limit: 100 }
      : "skip"
  );

  const [creationMode, setCreationMode] = useState<CreationMode>("range");
  const [rangeType, setRangeType] = useState<RangeType>("weeks");

  // Single Date Mode State
  const [dateInput, setDateInput] = useState<string>(formatDateToInput(new Date()));
  const [amountInput, setAmountInput] = useState<string>("");
  const [customLabel, setCustomLabel] = useState<string>("");

  // Range Mode State: Week Numbers
  const currentIso = getCurrentIsoWeekNumber();
  const [rangeYear, setRangeYear] = useState<number>(currentIso.year);
  const [startWeek, setStartWeek] = useState<number>(Math.max(1, currentIso.week - 15));
  const [endWeek, setEndWeek] = useState<number>(Math.max(1, currentIso.week));

  // Range Mode State: Month Range
  const [startMonth, setStartMonth] = useState<number>(1);
  const [startMonthYear, setStartMonthYear] = useState<number>(currentIso.year);
  const [endMonth, setEndMonth] = useState<number>(new Date().getMonth() + 1);
  const [endMonthYear, setEndMonthYear] = useState<number>(currentIso.year);

  // Range Mode State: Custom Date Range
  const [rangeStartDate, setRangeStartDate] = useState<string>(
    formatDateToInput(new Date(Date.now() - 90 * 86400000))
  );
  const [rangeEndDate, setRangeEndDate] = useState<string>(formatDateToInput(new Date()));
  const [rangeIntervalDays, setRangeIntervalDays] = useState<number>(7);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createManualDues = useMutation(api.treasury.dues.createManualDuesCycle);
  const createBatchDues = useMutation(api.treasury.dues.createBatchDuesCycles);

  // Sync default amount whenever fund config loads or changes
  useEffect(() => {
    if (duesConfig?.amount) {
      setAmountInput(duesConfig.amount.toString());
    } else if (!amountInput) {
      setAmountInput("20000");
    }
  }, [duesConfig?.amount, selectedFundId]);

  // Existing label set for duplicate detection
  const existingLabelsSet = useMemo(() => {
    if (!existingEvents) return new Set<string>();
    return new Set(existingEvents.map((e) => e.periodLabel.toLowerCase().trim()));
  }, [existingEvents]);

  // Derived suggested label for single mode
  const suggestedLabel = getSuggestedPeriodLabel(
    dateInput,
    duesConfig?.intervalType ?? "monthly"
  );
  const effectiveSingleLabel = customLabel.trim() || suggestedLabel;

  // Single mode past date detection
  const isSinglePastDate = (() => {
    if (!dateInput) return false;
    const selected = new Date(dateInput + "T23:59:59");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected.getTime() < today.getTime();
  })();

  const activeMembersCount = members?.length ?? 0;

  // Generate computed list of cycles for Range Mode
  const computedRangeCycles = useMemo(() => {
    const parsedAmount = parseInt(amountInput.replace(/[^0-9]/g, ""), 10) || (duesConfig?.amount ?? 20000);
    const cycles: Array<{
      dueDate: number;
      periodLabel: string;
      formattedDate: string;
      amount: number;
      isDuplicate: boolean;
    }> = [];

    if (rangeType === "weeks") {
      const minW = Math.min(Math.max(1, startWeek), 53);
      const maxW = Math.min(Math.max(1, endWeek), 53);
      const start = Math.min(minW, maxW);
      const end = Math.max(minW, maxW);

      for (let w = start; w <= end; w++) {
        const d = getDateFromIsoWeek(rangeYear, w);
        const label = `Week ${w}, ${rangeYear}`;
        const isDuplicate = existingLabelsSet.has(label.toLowerCase().trim());
        cycles.push({
          dueDate: d.getTime(),
          periodLabel: label,
          formattedDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          amount: parsedAmount,
          isDuplicate,
        });
      }
    } else if (rangeType === "months") {
      const startVal = startMonthYear * 12 + (startMonth - 1);
      const endVal = endMonthYear * 12 + (endMonth - 1);
      const minMonth = Math.min(startVal, endVal);
      const maxMonth = Math.max(startVal, endVal);

      for (let m = minMonth; m <= maxMonth; m++) {
        const y = Math.floor(m / 12);
        const monthIndex = m % 12;
        const dayOfMonth = duesConfig?.intervalType === "monthly" ? duesConfig.intervalValue : 1;
        const d = new Date(y, monthIndex, dayOfMonth, 12, 0, 0);
        const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        const isDuplicate = existingLabelsSet.has(label.toLowerCase().trim());
        cycles.push({
          dueDate: d.getTime(),
          periodLabel: label,
          formattedDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          amount: parsedAmount,
          isDuplicate,
        });
      }
    } else {
      // Date Range mode
      const start = new Date(rangeStartDate + "T12:00:00").getTime();
      const end = new Date(rangeEndDate + "T12:00:00").getTime();
      const step = Math.max(1, rangeIntervalDays) * 86400000;

      if (!isNaN(start) && !isNaN(end) && start <= end) {
        let curr = start;
        while (curr <= end && cycles.length < 100) {
          const d = new Date(curr);
          const label = getSuggestedPeriodLabel(
            formatDateToInput(d),
            duesConfig?.intervalType ?? "weekly"
          );
          const isDuplicate = existingLabelsSet.has(label.toLowerCase().trim());
          cycles.push({
            dueDate: curr,
            periodLabel: label,
            formattedDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            amount: parsedAmount,
            isDuplicate,
          });
          curr += step;
        }
      }
    }

    return cycles;
  }, [
    rangeType,
    startWeek,
    endWeek,
    rangeYear,
    startMonth,
    startMonthYear,
    endMonth,
    endMonthYear,
    rangeStartDate,
    rangeEndDate,
    rangeIntervalDays,
    amountInput,
    duesConfig,
    existingLabelsSet,
  ]);

  const newCyclesCount = computedRangeCycles.filter((c) => !c.isDuplicate).length;
  const duplicateCyclesCount = computedRangeCycles.filter((c) => c.isDuplicate).length;

  const handleSinglePreset = (monthsAgo: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    setDateInput(formatDateToInput(d));
    setCustomLabel("");
    setError(null);
  };

  const handleWeekPreset = (startW: number, endW: number) => {
    setStartWeek(startW);
    setEndWeek(endW);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId) {
      setError("Please select a target fund.");
      return;
    }

    const parsedAmount = parseInt(amountInput.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive integer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (creationMode === "single") {
        if (!dateInput) {
          setError("Please select a due date.");
          setIsSubmitting(false);
          return;
        }

        const selectedDateTime = new Date(dateInput + "T12:00:00").getTime();
        if (isNaN(selectedDateTime)) {
          setError("Invalid date selected.");
          setIsSubmitting(false);
          return;
        }

        await createManualDues({
          organizationId,
          fundId: selectedFundId,
          dueDate: selectedDateTime,
          amount: parsedAmount,
          periodLabel: effectiveSingleLabel,
        });
      } else {
        // Range Mode Submission
        if (computedRangeCycles.length === 0) {
          setError("No valid periods found in the selected range.");
          setIsSubmitting(false);
          return;
        }

        if (newCyclesCount === 0) {
          setError("All selected periods in this range already exist in this fund.");
          setIsSubmitting(false);
          return;
        }

        await createBatchDues({
          organizationId,
          fundId: selectedFundId,
          cycles: computedRangeCycles.map((c) => ({
            dueDate: c.dueDate,
            periodLabel: c.periodLabel,
            amount: c.amount,
          })),
          skipDuplicates: true,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create dues cycle(s).");
    } finally {
      setIsSubmitting(false);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[90vh] flex flex-col">
        <Card telemetry="TREASURY.CREATE_PAST_DUES_MODAL" cornerLines className="bg-card border-border shadow-2xl flex flex-col overflow-hidden">
          <CardHeader className="pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <CalendarPlus className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Create Dues Cycles
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate dues obligations for a single date or batch range of past periods
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 overflow-y-auto space-y-4">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 border border-border/80">
              <Button
                type="button"
                variant={creationMode === "range" ? "cyber" : "ghost"}
                chamfer="dual"
                size="sm"
                onClick={() => {
                  setCreationMode("range");
                  setError(null);
                }}
                className={`text-xs flex items-center justify-center gap-2 cursor-pointer ${
                  creationMode === "range" ? "" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Period Range (e.g. Wk 20–35)</span>
              </Button>

              <Button
                type="button"
                variant={creationMode === "single" ? "cyber" : "ghost"}
                chamfer="dual"
                size="sm"
                onClick={() => {
                  setCreationMode("single");
                  setError(null);
                }}
                className={`text-xs flex items-center justify-center gap-2 cursor-pointer ${
                  creationMode === "single" ? "" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Single Date Cycle</span>
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Target Fund Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Target Fund *
                </label>
                {funds && funds.length > 0 ? (
                  <select
                    value={selectedFundId ?? ""}
                    onChange={(e) => setSelectedFundIdState(e.target.value as Id<"funds">)}
                    disabled={isSubmitting}
                    className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    required
                  >
                    {funds.map((fund) => (
                      <option key={fund._id} value={fund._id}>
                        {fund.name} ({fund.currency}) {fund.isArchived ? "[Archived]" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-xs text-muted-foreground italic py-1">
                    No active funds available.
                  </div>
                )}
              </div>

              {/* Dues Amount Input (Common to both modes) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-primary" />
                    <span>Amount per Member per Cycle ({currentFund?.currency ?? "Units"}) *</span>
                  </label>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Prefilled from fund schedule
                  </span>
                </div>
                <Input
                  type="text"
                  placeholder="e.g. 20000"
                  value={amountInput}
                  disabled={isSubmitting}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    setAmountInput(val);
                  }}
                  chamfer="dual"
                  className="font-mono text-xs"
                  required
                />
              </div>

              {/* ========================================================================= */}
              {/* PERIOD RANGE MODE CONTROLS */}
              {/* ========================================================================= */}
              {creationMode === "range" ? (
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
                        chamfer="dual"
                        size="sm"
                        onClick={() => setRangeType("weeks")}
                        className="h-7 text-[11px] px-2 cursor-pointer font-mono"
                      >
                        Weekly (Wk #)
                      </Button>
                      <Button
                        type="button"
                        variant={rangeType === "months" ? "cyber" : "outline"}
                        chamfer="dual"
                        size="sm"
                        onClick={() => setRangeType("months")}
                        className="h-7 text-[11px] px-2 cursor-pointer font-mono"
                      >
                        Monthly Range
                      </Button>
                      <Button
                        type="button"
                        variant={rangeType === "dates" ? "cyber" : "outline"}
                        chamfer="dual"
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
                              chamfer="dual"
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
                              chamfer="dual"
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
                              chamfer="dual"
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
                              chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
                          chamfer="dual"
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
              ) : (
                /* ========================================================================= */
                /* SINGLE DATE CYCLE MODE */
                /* ========================================================================= */
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
                        chamfer="dual"
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
                        chamfer="dual"
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
                        chamfer="dual"
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
                        chamfer="dual"
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
                      chamfer="dual"
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
                      chamfer="dual"
                      className="text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground font-mono">
                      Display name: <strong className="text-foreground">{effectiveSingleLabel || "Untitled Period"}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Summary / Impact Preview Card */}
              <div className="p-3 bg-muted/30 border border-border/80 space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>Active Members Enrolled:</span>
                  </div>
                  <span className="text-foreground font-bold">{activeMembersCount} members</span>
                </div>

                <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-border/40">
                  <span className="text-muted-foreground">
                    {creationMode === "range"
                      ? `Total Expected (${newCyclesCount} new cycle${newCyclesCount > 1 ? "s" : ""}):`
                      : "Total Expected:"}
                  </span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {currentFund?.currency ?? "IDR"}{" "}
                    {(
                      (parseInt(amountInput.replace(/[^0-9]/g, ""), 10) || 0) *
                      activeMembersCount *
                      (creationMode === "range" ? newCyclesCount : 1)
                    ).toLocaleString(currentFund?.currency === "IDR" ? "id-ID" : undefined)}
                  </span>
                </div>

                <div className="pt-1.5 flex items-start gap-1.5 text-[11px] text-amber-300/90 font-mono">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {creationMode === "range"
                      ? `Will create ${newCyclesCount} dues column(s) in the matrix. Members can pay cycles incrementally in order.`
                      : "Past dues records will appear in the spreadsheet matrix with their historical date for retroactive dues tracking."}
                  </span>
                </div>
              </div>

              {error && (
                <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  onClick={onClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={
                    isSubmitting ||
                    !selectedFundId ||
                    !amountInput ||
                    (creationMode === "single" ? !dateInput : newCyclesCount === 0)
                  }
                  className="text-xs flex items-center gap-1.5 cursor-pointer font-semibold min-w-[160px] justify-center shadow-md"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Generating...</span>
                    </>
                  ) : creationMode === "range" ? (
                    <>
                      <CalendarRange className="w-3.5 h-3.5" />
                      <span>Generate {newCyclesCount} Dues Cycle{newCyclesCount > 1 ? "s" : ""}</span>
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>{isSinglePastDate ? "Create Past Dues" : "Create Dues Cycle"}</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
