import { useTranslation } from "react-i18next";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { CheckCircle2, Minus, Plus, CalendarDays, ChevronDown } from "lucide-react";
import { MemberSearchSelect, MemberItem } from "../MemberSearchSelect";

export interface UnpaidPeriodItem {
  membershipId: Id<"duesMemberships">;
  duesEventId: Id<"duesEvents">;
  periodLabel: string;
  dueDate: number;
  amount: number;
}

export interface DuesPaymentFormProps {
  members: MemberItem[] | undefined;
  duesUserId: string;
  unpaidPeriods: UnpaidPeriodItem[] | undefined;
  duesPeriodCount: number;
  showDuesBreakdown: boolean;
  effectiveDuesMemo: string;
  defaultDuesMemo: string;
  currency: string;
  duesCalculatedAmount: number;
  selectedPeriodsToPay: UnpaidPeriodItem[];
  periodRangeLabel: string;
  isSigning: boolean;
  onUserSelect: (userId: string) => void;
  onPeriodCountChange: (count: number) => void;
  onToggleBreakdown: () => void;
  onCustomMemoChange: (memo: string) => void;
}

export function DuesPaymentForm({
  members,
  duesUserId,
  unpaidPeriods,
  duesPeriodCount,
  showDuesBreakdown,
  effectiveDuesMemo,
  defaultDuesMemo,
  currency,
  duesCalculatedAmount,
  selectedPeriodsToPay,
  periodRangeLabel,
  isSigning,
  onUserSelect,
  onPeriodCountChange,
  onToggleBreakdown,
  onCustomMemoChange,
}: DuesPaymentFormProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Member Selection */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Select Member *
        </label>
        <MemberSearchSelect
          members={members}
          value={duesUserId}
          onChange={onUserSelect}
          disabled={isSigning}
          placeholder="Search member by nickname, name, or email..."
        />
      </div>

      {/* Dues Periods & Amount Calculation */}
      {duesUserId && (
        <div className="space-y-3 p-3.5 sm:p-4 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-sm)] font-sans shadow-xs">
          {unpaidPeriods === undefined ? (
            <div className="py-2 text-xs font-mono text-muted-foreground animate-pulse text-center">
              Loading unpaid dues cycles...
            </div>
          ) : unpaidPeriods.length === 0 ? (
            <div className="flex items-center gap-2 text-primary text-xs py-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="font-medium text-foreground">This member has no outstanding dues! All periods are paid.</span>
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-foreground tracking-tight">
                  {t("treasury.invoices.numberOfPeriods", "Number of Periods to Pay")}
                </label>
                <span className="inline-flex items-center text-[11px] font-mono font-medium text-muted-foreground bg-muted/50 border border-border/60 px-2 py-0.5 rounded-[var(--fintech-radius-sm)]">
                  {t("treasury.invoices.maxAvailableCycles", "Max available: {{count}} cycle(s)", {
                    count: unpaidPeriods.length,
                  })}
                </span>
              </div>

              {/* Stepper & Preset Controls */}
              <div className="space-y-2.5 pt-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm sm:text-base font-bold text-foreground">
                    {t("treasury.invoices.cyclesToPay", "Cycles to pay:")}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="none"
                      disabled={isSigning || duesPeriodCount <= 1}
                      onClick={() => onPeriodCountChange(Math.max(1, duesPeriodCount - 1))}
                      className="h-9 w-9 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-30 rounded-[var(--fintech-radius-sm)] border-border/80 bg-background hover:bg-muted/50 text-foreground transition-all active:scale-95 shadow-xs"
                      title="Decrease periods"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={duesPeriodCount}
                      disabled={isSigning}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        if (!raw) {
                          onPeriodCountChange(1);
                          return;
                        }
                        const val = parseInt(raw, 10);
                        onPeriodCountChange(Math.min(unpaidPeriods.length, Math.max(1, val)));
                      }}
                      className="h-9 w-12 p-0 text-center font-sans font-bold text-base bg-background border border-border/80 rounded-[var(--fintech-radius-sm)] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shrink-0 shadow-xs"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="none"
                      disabled={isSigning || duesPeriodCount >= unpaidPeriods.length}
                      onClick={() => onPeriodCountChange(Math.min(unpaidPeriods.length, duesPeriodCount + 1))}
                      className="h-9 w-9 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-30 rounded-[var(--fintech-radius-sm)] border-border/80 bg-background hover:bg-muted/50 text-foreground transition-all active:scale-95 shadow-xs"
                      title="Increase periods"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Quick Preset Chips */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    disabled={isSigning}
                    onClick={() => onPeriodCountChange(1)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer ${
                      duesPeriodCount === 1
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-background/80 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {t("treasury.invoices.cycleSingle", "1 Cycle")}
                  </button>

                  {unpaidPeriods.length > 1 && (
                    <button
                      type="button"
                      disabled={isSigning}
                      onClick={() => onPeriodCountChange(2)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer ${
                        duesPeriodCount === 2
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                          : "bg-background/80 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                      }`}
                    >
                      {t("treasury.invoices.cyclesMultiple", "{{count}} Cycles", { count: 2 })}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSigning}
                    onClick={() => onPeriodCountChange(unpaidPeriods.length)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer ${
                      duesPeriodCount === unpaidPeriods.length
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-background/80 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {t("treasury.invoices.allCycles", "All ({{count}})", { count: unpaidPeriods.length })}
                  </button>
                </div>
              </div>

              {/* Divider & Preview Summary */}
              <div className="pt-3 border-t border-border/60 space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground font-medium flex items-center gap-2 shrink-0">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    {t("treasury.invoices.coveredCycles", "Covered Cycle(s):")}
                  </span>
                  <span className="text-foreground font-semibold text-right truncate max-w-[210px] sm:max-w-none">
                    {periodRangeLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-sm pt-0.5">
                  <span className="text-muted-foreground font-medium">
                    {t("treasury.invoices.calculatedTotal", "Calculated Total:")}
                  </span>
                  <span className="text-base font-bold text-primary font-sans tabular-nums text-right">
                    {currency} {duesCalculatedAmount.toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Expandable Breakdown Toggle */}
                <div className="pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={onToggleBreakdown}
                    className="flex items-center justify-between w-full py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <span>
                      {t("treasury.invoices.viewCycleBreakdown", "Rincian Siklus")} ({selectedPeriodsToPay.length})
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        showDuesBreakdown ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {showDuesBreakdown && (
                    <div className="pt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 animate-in fade-in duration-150">
                      {selectedPeriodsToPay.map((p) => (
                        <div
                          key={p.membershipId}
                          className="flex items-center justify-between py-1 px-2 rounded-[var(--fintech-radius-sm)] bg-background/50 border border-border/40 text-[11px]"
                        >
                          <span className="truncate font-medium text-foreground">{p.periodLabel}</span>
                          <span className="text-muted-foreground shrink-0 tabular-nums font-sans">
                            {currency} {p.amount.toLocaleString("id-ID")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Dues Memo Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Ledger Memo *
        </label>
        <Input
          type="text"
          value={effectiveDuesMemo}
          placeholder={defaultDuesMemo || "e.g. Member Dues Payment"}
          disabled={isSigning}
          onChange={(e) => onCustomMemoChange(e.target.value)}
          chamfer="none"
          required
        />
      </div>
    </>
  );
}
