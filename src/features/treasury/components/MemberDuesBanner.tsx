import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Calendar,
  Sparkles,
} from "lucide-react";

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
      <Card
        telemetry="DUES.LOADING"
        cornerLines
        className="bg-card/60 border-border/80 shadow-md animate-pulse"
      >
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 bg-muted/60 rounded" />
            <div className="h-4 w-16 bg-muted/60 rounded" />
          </div>
          <div className="h-8 w-44 bg-muted/60 rounded" />
          <div className="h-9 w-full sm:w-36 bg-muted/60 rounded" />
        </CardContent>
      </Card>
    );
  }

  const unpaidCount = unpaidPeriods.length;
  const totalUnpaid = unpaidPeriods.reduce((sum, p) => sum + p.amount, 0);
  const oldestPeriod = unpaidPeriods[0];
  const isOverdue = oldestPeriod ? oldestPeriod.dueDate < Date.now() : false;

  // Unpaid dues: Prominent Actionable Banner
  if (unpaidCount > 0) {
    return (
      <Card
        telemetry="DUES.ACTION_REQUIRED"
        cornerLines
        className="bg-amber-500/10 border-amber-500/50 shadow-xl relative overflow-hidden"
      >
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Top header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300">
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                {t("treasury.overview.outstandingDuesTitle")}
              </span>
            </div>

            <Badge
              variant="outline"
              className="font-mono text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
            >
              {unpaidCount} {unpaidCount > 1 ? "CYCLES" : "CYCLE"}
            </Badge>
          </div>

          {/* Amount and Due Context */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-mono font-bold text-amber-400/80">
                  {currency}
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-amber-300">
                  {totalUnpaid.toLocaleString()}
                </span>
              </div>

              {oldestPeriod && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-amber-200/90">
                  <Calendar className="w-3 h-3 shrink-0 text-amber-400" />
                  <span>
                    {oldestPeriod.periodLabel}
                    {" • "}
                    {isOverdue ? (
                      <span className="text-red-400 font-bold">
                        Overdue ({new Date(oldestPeriod.dueDate).toLocaleDateString()})
                      </span>
                    ) : (
                      <span>Due {new Date(oldestPeriod.dueDate).toLocaleDateString()}</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Actions: Pay Now + Breakdown Toggle */}
            <div className="flex items-center gap-2 pt-1 sm:pt-0">
              <Button
                type="button"
                variant="cyber"
                chamfer="dual"
                size="sm"
                onClick={onOpenPayDues}
                className="w-full sm:w-auto h-9 text-xs font-bold font-mono px-4 flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t("treasury.overview.payDuesNow")}</span>
              </Button>

              {unpaidCount > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  size="sm"
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className="h-9 px-2.5 text-xs font-mono text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
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
            <div className="pt-3 border-t border-amber-500/30 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80 block">
                Unpaid Cycles Breakdown:
              </span>
              <div className="space-y-1.5">
                {unpaidPeriods.map((period) => (
                  <div
                    key={period.membershipId}
                    className="flex items-center justify-between p-2 bg-black/30 border border-amber-500/30 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="font-semibold text-foreground truncate">
                        {period.periodLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({new Date(period.dueDate).toLocaleDateString()})
                      </span>
                    </div>
                    <span className="font-bold text-amber-300 shrink-0 ml-2">
                      {currency} {period.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // All Paid: Reassuring Good Standing Banner
  return (
    <Card
      telemetry="DUES.IN_GOOD_STANDING"
      cornerLines
      className="bg-emerald-500/10 border-emerald-500/40 shadow-md"
    >
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="font-mono text-sm font-bold text-emerald-300">
                {t("treasury.overview.allDuesPaidTitle")}
              </h4>
              <Badge
                variant="outline"
                className="font-mono text-[9px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
              >
                {t("treasury.overview.inGoodStanding")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              {t("treasury.overview.allDuesPaidSubtitle")}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-emerald-400/80">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Kas Terpenuhi</span>
        </div>
      </CardContent>
    </Card>
  );
}
