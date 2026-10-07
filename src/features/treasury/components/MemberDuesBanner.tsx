import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Panel } from "../../../ui/Panel";
import { StatusPill } from "../../../ui/StatusPill";
import { Button } from "@boredkevin/ui";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";

interface MemberDuesBannerProps {
  organizationId: Id<"organizations">;
  fundId: Id<"funds"> | null;
  currency?: string;
  onOpenPayDues: () => void;
}

export function MemberDuesBanner({
  organizationId,
  fundId,
  currency = "IDR",
  onOpenPayDues,
}: MemberDuesBannerProps) {
  const { t } = useTranslation();
  const { money: formatMoney, date: formatDate } = useFormat();
  const [showBreakdown, setShowBreakdown] = useState(false);

  const myMembership = useQuery(
    api.members.getMyMembership,
    organizationId ? { organizationId } : "skip"
  );

  const unpaidPeriods = useQuery(
    api.treasury.dues.getMemberUnpaidPeriods,
    organizationId && fundId && myMembership?.userId
      ? { organizationId, fundId, userId: myMembership.userId }
      : "skip"
  );

  if (!fundId) return null;

  // Loading skeleton state
  if (unpaidPeriods === undefined) {
    return (
      <Panel className="p-4 sm:p-5 space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-muted/60 rounded" />
          <div className="h-4 w-16 bg-muted/60 rounded" />
        </div>
        <div className="h-8 w-44 bg-muted/60 rounded" />
        <div className="h-9 w-full sm:w-36 bg-muted/60 rounded" />
      </Panel>
    );
  }

  const unpaidCount = unpaidPeriods.length;
  const totalUnpaid = unpaidPeriods.reduce((sum, p) => sum + p.amount, 0);
  const oldestPeriod = unpaidPeriods[0];
  const isOverdue = oldestPeriod ? oldestPeriod.dueDate < Date.now() : false;

  // Unpaid dues: Prominent Actionable Banner
  if (unpaidCount > 0) {
    return (
      <Panel className="bg-amber-500/10 border-amber-500/40 p-4 sm:p-5 space-y-4">
        {/* Top header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-[var(--fintech-radius-sm)]">
              <Receipt className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              {t("treasury.overview.outstandingDuesTitle", "Outstanding Dues")}
            </span>
          </div>
        </div>

        {/* Amount and Due Context */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
          <div className="space-y-1.5">
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-amber-300">
              {formatMoney(totalUnpaid, currency)}
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-200/90">
              <StatusPill tone="warning" className="text-[11px] py-0 px-2 shrink-0">
                {t(unpaidCount > 1 ? "treasury.overview.cycles" : "treasury.overview.cycle_one", { count: unpaidCount })}
              </StatusPill>
              {oldestPeriod && (
                <>
                  <span>•</span>
                  {isOverdue ? (
                    <span className="text-rose-400 font-semibold">
                      {t("treasury.overview.overdue", "Overdue")} ({formatDate(oldestPeriod.dueDate)})
                    </span>
                  ) : (
                    <span>{t("treasury.overview.due", "Due")} {formatDate(oldestPeriod.dueDate)}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions: Pay Now + Breakdown Toggle */}
          <div className="flex items-center gap-2 pt-1 sm:pt-0">
            <Button
              type="button"
              variant="default"
              chamfer="none"
              size="sm"
              onClick={onOpenPayDues}
              className="w-full sm:w-auto h-9 text-xs font-semibold px-4 flex items-center justify-center gap-2 cursor-pointer shadow-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{t("treasury.overview.payDuesNow", "Pay Dues Now")}</span>
            </Button>

            {unpaidCount > 1 && (
              <Button
                type="button"
                variant="outline"
                chamfer="none"
                size="sm"
                onClick={() => setShowBreakdown((prev) => !prev)}
                className="h-9 px-2.5 text-xs text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
                title={showBreakdown ? t("treasury.overview.hideCycles") : t("treasury.overview.viewCycles")}
                aria-label={showBreakdown ? t("treasury.overview.hideCycles") : t("treasury.overview.viewCycles")}
              >
                {showBreakdown ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Period Breakdown */}
        {showBreakdown && unpaidCount > 1 && (
          <div className="pt-3 border-t border-amber-500/30 space-y-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90 block">
              Unpaid Cycles Breakdown:
            </span>
            <div className="space-y-1.5">
              {unpaidPeriods.map((period) => (
                <div
                  key={period.membershipId}
                  className="flex items-center justify-between p-2.5 bg-black/30 border border-amber-500/30 rounded-[var(--fintech-radius-sm)] text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-semibold text-foreground truncate">
                      {period.periodLabel}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      ({formatDate(period.dueDate)})
                    </span>
                  </div>
                  <span className="font-bold text-amber-300 shrink-0 ml-2 font-mono">
                    {formatMoney(period.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    );
  }

  // All Paid: Reassuring Good Standing Banner
  return (
    <Panel className="bg-emerald-500/10 border-emerald-500/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-[var(--fintech-radius-sm)]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-emerald-300">
              {t("treasury.overview.allDuesPaidTitle", "All Dues Paid")}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("treasury.overview.allDuesPaidSubtitle", "You have no outstanding dues.")}
          </p>
        </div>
      </div>
    </Panel>
  );
}
