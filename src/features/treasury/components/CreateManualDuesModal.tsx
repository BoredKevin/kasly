import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveDialog } from "../../../ui";
import {
  Button,
  Input,
} from "@boredkevin/ui";
import {
  CalendarPlus,
  Users,
  Coins,
  CalendarDays,
  CalendarRange,
  Info,
} from "lucide-react";
import {
  CreationMode,
  RangeType,
  getDateFromIsoWeek,
  formatDateToInput,
  getSuggestedPeriodLabel,
  getCurrentIsoWeekNumber,
} from "./duesModal/isoWeekUtils";
import { BatchRangeForm } from "./duesModal/BatchRangeForm";
import { SingleCycleForm } from "./duesModal/SingleCycleForm";

interface CreateManualDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  defaultFundId: Id<"funds"> | null;
  onSuccess?: () => void;
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

  useEffect(() => {
    if (isOpen) {
      setSelectedFundIdState(defaultFundId ?? null);
    }
  }, [isOpen, defaultFundId]);

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
  const [rangeEndDate, setRangeEndDate] = useState<string>(
    formatDateToInput(new Date())
  );
  const [rangeIntervalDays, setRangeIntervalDays] = useState<number>(7);

  // Auto enroll members toggle
  const [autoEnroll, setAutoEnroll] = useState<boolean>(true);

  // Submission feedback
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const createManualDuesCycle = useMutation(api.treasury.dues.createManualDuesCycle);
  const createBatchDuesCycles = useMutation(api.treasury.dues.createBatchDuesCycles);

  // Initialize amount from config if available
  useEffect(() => {
    if (duesConfig && duesConfig.amount && !amountInput) {
      setAmountInput(String(duesConfig.amount));
    }
  }, [duesConfig, amountInput]);

  // Derived suggested label for Single mode
  const suggestedLabel = useMemo(() => {
    return getSuggestedPeriodLabel(dateInput, duesConfig?.intervalType ?? "monthly");
  }, [dateInput, duesConfig?.intervalType]);

  const effectiveSingleLabel = customLabel.trim() || suggestedLabel;

  // Check if date is in the past
  const isSinglePastDate = useMemo(() => {
    if (!dateInput) return false;
    const target = new Date(dateInput + "T23:59:59").getTime();
    return target < Date.now();
  }, [dateInput]);

  // Existing period labels Set for duplicate detection
  const existingPeriodLabels = useMemo(() => {
    const set = new Set<string>();
    if (existingEvents) {
      existingEvents.forEach((ev) => set.add(ev.periodLabel.toLowerCase().trim()));
    }
    return set;
  }, [existingEvents]);

  // Computed cycles for Batch Range mode
  const computedRangeCycles = useMemo(() => {
    const list: Array<{
      periodLabel: string;
      dueDate: number;
      formattedDate: string;
      amount: number;
      isDuplicate: boolean;
    }> = [];

    const parsedAmount = parseFloat(amountInput) || (duesConfig?.amount ?? 0);

    if (rangeType === "weeks") {
      const minWk = Math.min(startWeek, endWeek);
      const maxWk = Math.max(startWeek, endWeek);
      for (let w = minWk; w <= maxWk; w++) {
        const dueDateObj = getDateFromIsoWeek(rangeYear, w);
        const periodLabel = `Week ${w}, ${rangeYear}`;
        const isDuplicate = existingPeriodLabels.has(periodLabel.toLowerCase().trim());
        list.push({
          periodLabel,
          dueDate: dueDateObj.getTime(),
          formattedDate: formatDateToInput(dueDateObj),
          amount: parsedAmount,
          isDuplicate,
        });
      }
    } else if (rangeType === "months") {
      const startDate = new Date(startMonthYear, startMonth - 1, 15);
      const endDate = new Date(endMonthYear, endMonth - 1, 15);

      const [startPeriodDate, endPeriodDate] =
        startDate <= endDate ? [startDate, endDate] : [endDate, startDate];

      const cursor = new Date(startPeriodDate.getTime());
      while (cursor <= endPeriodDate) {
        const periodLabel = cursor.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });
        const endOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
        const isDuplicate = existingPeriodLabels.has(periodLabel.toLowerCase().trim());

        list.push({
          periodLabel,
          dueDate: endOfMonth.getTime(),
          formattedDate: formatDateToInput(endOfMonth),
          amount: parsedAmount,
          isDuplicate,
        });

        cursor.setMonth(cursor.getMonth() + 1);
        cursor.setDate(15);
      }
    } else if (rangeType === "dates") {
      const start = new Date(rangeStartDate + "T12:00:00");
      const end = new Date(rangeEndDate + "T12:00:00");
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
        const intervalMs = Math.max(1, rangeIntervalDays) * 86400000;
        let cursorMs = start.getTime();
        let idx = 1;
        while (cursorMs <= end.getTime()) {
          const d = new Date(cursorMs);
          const periodLabel = `Cycle of ${d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}`;
          const isDuplicate = existingPeriodLabels.has(periodLabel.toLowerCase().trim());
          list.push({
            periodLabel,
            dueDate: d.getTime(),
            formattedDate: formatDateToInput(d),
            amount: parsedAmount,
            isDuplicate,
          });
          cursorMs += intervalMs;
          idx++;
          if (idx > 200) break; // safety bound
        }
      }
    }

    return list;
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
    duesConfig?.amount,
    existingPeriodLabels,
  ]);

  const duplicateCyclesCount = useMemo(
    () => computedRangeCycles.filter((c) => c.isDuplicate).length,
    [computedRangeCycles]
  );
  const newCyclesCount = computedRangeCycles.length - duplicateCyclesCount;

  // Preset handlers for quick past date selection
  const handleSinglePreset = (monthsAgo: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    setDateInput(formatDateToInput(d));
    setError(null);
  };

  const handleWeekPreset = (start: number, end: number) => {
    setStartWeek(start);
    setEndWeek(end);
    setRangeYear(currentIso.year);
  };

  const activeMembersCount = useMemo(() => {
    return members?.length ?? 0;
  }, [members]);

  // Month names for Month range picker
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId) {
      setError("Please select a fund.");
      return;
    }

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessInfo(null);

    try {
      if (creationMode === "single") {
        if (!dateInput) {
          throw new Error("Due date is required.");
        }
        const dueDate = new Date(dateInput + "T23:59:59").getTime();
        if (isNaN(dueDate)) {
          throw new Error("Invalid date format.");
        }

        await createManualDuesCycle({
          organizationId,
          fundId: selectedFundId,
          periodLabel: effectiveSingleLabel,
          amount: parsedAmount,
          dueDate,
        });

        setSuccessInfo(
          `Cycle "${effectiveSingleLabel}" created successfully.`
        );
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        // Range Batch Creation Mode
        const nonDuplicateCycles = computedRangeCycles
          .filter((c) => !c.isDuplicate)
          .map((c) => ({
            periodLabel: c.periodLabel,
            amount: c.amount,
            dueDate: c.dueDate,
          }));

        if (nonDuplicateCycles.length === 0) {
          throw new Error(
            "All generated periods in this range already exist! Try adjusting your range."
          );
        }

        const res = await createBatchDuesCycles({
          organizationId,
          fundId: selectedFundId,
          cycles: nonDuplicateCycles,
        });

        setSuccessInfo(
          `Created ${res.createdCount} dues cycles successfully! (${res.skippedCount} duplicates skipped).`
        );
        onSuccess?.();
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create dues cycle.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.dues.createPastTitle", "Create Past / Historical Dues Cycles")}
      description={t(
        "treasury.dues.createPastSubtitle",
        "Generate retroactively dated dues cycles with automated member enrollment."
      )}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Creation Mode Switcher Header */}
        <div className="flex border-b border-border/60 bg-muted/20 px-3 pt-2 gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              setCreationMode("range");
              setError(null);
            }}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              creationMode === "range"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" />
            <span>Generate Range of Cycles</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreationMode("single");
              setError(null);
            }}
            className={`pb-2 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              creationMode === "single"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Single Past Date Cycle</span>
          </button>
        </div>

        {/* Informational Guidance Callout */}
        <div className="flex items-start gap-2.5 p-3 bg-primary/10 border border-primary/20 text-xs font-mono text-muted-foreground leading-relaxed">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>
            {creationMode === "range"
              ? "Use Range Mode to generate past dues for multiple weeks or months in one operation. Existing periods are automatically detected and safely skipped to avoid duplicate billing."
              : "Use Single Mode to backdate a specific historical period or insert a missed past billing cycle for your organization."}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono rounded">
            {error}
          </div>
        )}

        {successInfo && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded">
            {successInfo}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            {/* Target Fund Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Target Fund *
              </label>
              {funds && funds.length > 0 ? (
                <select
                  value={selectedFundId ?? ""}
                  disabled={isSubmitting}
                  onChange={(e) => setSelectedFundIdState(e.target.value as Id<"funds">)}
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

            {/* Dues Amount Input */}
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
                chamfer="none"
                className="font-mono text-xs"
                required
              />
            </div>

            {/* PERIOD RANGE MODE CONTROLS */}
            {creationMode === "range" ? (
              <BatchRangeForm
                rangeType={rangeType}
                setRangeType={setRangeType}
                rangeYear={rangeYear}
                setRangeYear={setRangeYear}
                startWeek={startWeek}
                setStartWeek={setStartWeek}
                endWeek={endWeek}
                setEndWeek={setEndWeek}
                startMonth={startMonth}
                setStartMonth={setStartMonth}
                startMonthYear={startMonthYear}
                setStartMonthYear={setStartMonthYear}
                endMonth={endMonth}
                setEndMonth={setEndMonth}
                endMonthYear={endMonthYear}
                setEndMonthYear={setEndMonthYear}
                monthNames={monthNames}
                rangeStartDate={rangeStartDate}
                setRangeStartDate={setRangeStartDate}
                rangeEndDate={rangeEndDate}
                setRangeEndDate={setRangeEndDate}
                rangeIntervalDays={rangeIntervalDays}
                setRangeIntervalDays={setRangeIntervalDays}
                computedRangeCycles={computedRangeCycles}
                duplicateCyclesCount={duplicateCyclesCount}
                currentFund={currentFund}
                isSubmitting={isSubmitting}
                handleWeekPreset={handleWeekPreset}
                currentIso={currentIso}
              />
            ) : (
              <SingleCycleForm
                isSubmitting={isSubmitting}
                handleSinglePreset={handleSinglePreset}
                isSinglePastDate={isSinglePastDate}
                dateInput={dateInput}
                setDateInput={setDateInput}
                setError={setError}
                customLabel={customLabel}
                setCustomLabel={setCustomLabel}
                suggestedLabel={suggestedLabel}
                effectiveSingleLabel={effectiveSingleLabel}
              />
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
                    activeMembersCount *
                    (parseFloat(amountInput) || 0) *
                    (creationMode === "range" ? newCyclesCount : 1)
                  ).toLocaleString(currentFund?.currency === "IDR" ? "id-ID" : undefined)}
                </span>
              </div>
            </div>

            {/* Auto Enroll Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-mono select-none">
              <input
                type="checkbox"
                checked={autoEnroll}
                disabled={isSubmitting}
                onChange={(e) => setAutoEnroll(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span className="text-foreground">
                Automatically create unpaid dues obligations for all {activeMembersCount} active members
              </span>
            </label>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="cyber"
              chamfer="none"
              disabled={
                isSubmitting ||
                !selectedFundId ||
                !amountInput ||
                (creationMode === "range" && newCyclesCount === 0)
              }
              className="text-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>Generating Cycles...</>
              ) : (
                <>
                  <CalendarPlus className="w-3.5 h-3.5" />
                  {creationMode === "range"
                    ? `Create ${newCyclesCount} Cycles`
                    : "Create Single Cycle"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
