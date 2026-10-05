import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import { Panel } from "../../../ui/Panel";
import { StatusPill } from "../../../ui/StatusPill";
import { Button } from "@boredkevin/ui";
import {
  Landmark,
  ChevronDown,
  CheckCircle2,
  Receipt,
  CreditCard,
  PenLine,
  ShieldAlert,
} from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";

interface UnifiedMobileFinancialHeroProps {
  fund: {
    _id: Id<"funds">;
    name: string;
    currency: string;
    balance: number;
    isFrozen?: boolean;
    isArchived?: boolean;
  } | null | undefined;
  funds?: Array<{
    _id: Id<"funds">;
    name: string;
    currency: string;
    isArchived?: boolean;
  }>;
  activeFundId: Id<"funds"> | null;
  onSelectFund: (fundId: Id<"funds">) => void;
  unpaidPeriods: Array<{
    membershipId: Id<"duesMemberships">;
    duesEventId: Id<"duesEvents">;
    periodLabel: string;
    dueDate: number;
    amount: number;
  }> | undefined;
  canSign?: boolean;
  canAdmin?: boolean;
  onOpenPayDues: () => void;
  onOpenRecordPayment?: () => void;
  onOpenCreateFund?: () => void;
}

export function UnifiedMobileFinancialHero({
  fund,
  funds,
  activeFundId,
  onSelectFund,
  unpaidPeriods,
  canSign,
  onOpenPayDues,
  onOpenRecordPayment,
}: UnifiedMobileFinancialHeroProps) {
  const { t } = useTranslation();
  const { money: formatMoney, date: formatDate } = useFormat();

  const isFrozen = Boolean(fund?.isFrozen);
  const unpaidCount = unpaidPeriods?.length ?? 0;
  const totalUnpaid = unpaidPeriods?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const oldestPeriod = unpaidPeriods?.[0];
  const isOverdue = oldestPeriod ? oldestPeriod.dueDate < Date.now() : false;
  const currency = fund?.currency ?? "IDR";

  return (
    <Panel className="p-4 sm:p-5 space-y-4">
      {/* Top Row: Fund Name & Small Saldo */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
        {/* Fund Switcher / Identification */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary rounded-[var(--fintech-radius-sm)] shrink-0">
            <Landmark className="w-4 h-4" />
          </div>

          {funds && funds.length > 1 ? (
            <div className="relative min-w-0 max-w-[160px] sm:max-w-[260px]">
              <select
                value={activeFundId ?? ""}
                onChange={(e) => onSelectFund(e.target.value as Id<"funds">)}
                className="w-full h-8 px-2.5 pr-7 bg-background border border-border rounded-[var(--fintech-radius-sm)] text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer truncate"
              >
                {funds.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.currency})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 pointer-events-none text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-foreground truncate">
                {fund?.name ?? "Treasury"}
              </span>
              <StatusPill tone="info" dot={false}>
                {currency}
              </StatusPill>
            </div>
          )}
        </div>

        {/* Small Saldo Metric & Quick Record Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider block font-medium">
              {t("treasury.overview.treasuryBalance", "Treasury Balance")}
            </span>
            <div className="flex items-center justify-end gap-1.5">
              {isFrozen && <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />}
              <span className="text-xs sm:text-sm font-bold font-mono text-foreground">
                {formatMoney(fund?.balance ?? 0, currency)}
              </span>
            </div>
          </div>

          {canSign && !fund?.isArchived && onOpenRecordPayment && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={onOpenRecordPayment}
              className="h-7 text-xs px-2.5 flex items-center gap-1.5 cursor-pointer ml-1"
            >
              <PenLine className="w-3 h-3 text-primary" />
              <span>Record</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Hero Section: Outstanding Dues Display */}
      {unpaidPeriods === undefined ? (
        <div className="py-4 space-y-2 animate-pulse">
          <div className="h-3 w-28 bg-muted/60 rounded" />
          <div className="h-8 w-44 bg-muted/60 rounded" />
          <div className="h-10 w-full bg-muted/60 rounded mt-2" />
        </div>
      ) : unpaidCount > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>{t("treasury.overview.outstandingDuesTitle", "Outstanding Dues")}</span>
            </span>
            <StatusPill tone="warning">
              {unpaidCount} {unpaidCount > 1 ? "Cycles" : "Cycle"}
            </StatusPill>
          </div>

          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-bold font-mono tracking-tight text-amber-300">
              {formatMoney(totalUnpaid, currency)}
            </div>

            {oldestPeriod && (
              <p className="text-xs text-muted-foreground truncate">
                {oldestPeriod.periodLabel}
                {" • "}
                {isOverdue ? (
                  <span className="text-rose-400 font-medium">
                    Overdue ({formatDate(oldestPeriod.dueDate)})
                  </span>
                ) : (
                  <span>Due {formatDate(oldestPeriod.dueDate)}</span>
                )}
              </p>
            )}
          </div>

          <Button
            type="button"
            variant="cyber"
            chamfer="none"
            size="default"
            onClick={onOpenPayDues}
            className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
          >
            <CreditCard className="w-4 h-4" />
            <span>
              {t("treasury.overview.payDuesNow", "Pay Dues Now")} ({formatMoney(totalUnpaid, currency)})
            </span>
          </Button>
        </div>
      ) : (
        <div className="py-3 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {t("treasury.overview.outstandingDuesTitle", "Dues Status")}
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-400">
              {t("treasury.overview.allDuesPaidTitle", "All Dues Paid")}
            </span>
            <StatusPill tone="success">
              {t("treasury.overview.inGoodStanding", "Good Standing")}
            </StatusPill>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("treasury.overview.allDuesPaidSubtitle", "You have no outstanding dues for this fund.")}
          </p>
        </div>
      )}
    </Panel>
  );
}

export { UnifiedMobileFinancialHero as UnifiedFinancialHero };
