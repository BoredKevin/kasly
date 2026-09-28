import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  Landmark,
  ChevronDown,
  CheckCircle2,
  Receipt,
  CreditCard,
  PenLine,
  ShieldAlert,
} from "lucide-react";

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

  const isFrozen = Boolean(fund?.isFrozen);
  const unpaidCount = unpaidPeriods?.length ?? 0;
  const totalUnpaid = unpaidPeriods?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
  const oldestPeriod = unpaidPeriods?.[0];
  const isOverdue = oldestPeriod ? oldestPeriod.dueDate < Date.now() : false;

  return (
    <Card
      cornerLines={false}
      className="bg-card/80 backdrop-blur-md border border-border/70 shadow-sm overflow-hidden"
    >
      <CardContent className="p-4 sm:p-5 space-y-3.5 sm:space-y-4">
        {/* Top Row: Fund Name & Small Saldo (Switched so Saldo is small & compact) */}
        <div className="flex items-center justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border/50">
          {/* Fund Switcher / Identification */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1 sm:p-1.5 bg-primary/10 border border-primary/30 text-primary shrink-0">
              <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>

            {funds && funds.length > 1 ? (
              <div className="relative min-w-0 max-w-[140px] sm:max-w-[260px]">
                <select
                  value={activeFundId ?? ""}
                  onChange={(e) => onSelectFund(e.target.value as Id<"funds">)}
                  className="w-full h-7 sm:h-8 px-2 sm:px-2.5 pr-6 sm:pr-7 bg-background/80 border border-border/80 text-xs sm:text-sm font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
                >
                  {funds.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} ({f.currency})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 absolute right-1.5 sm:right-2 top-2 sm:top-2.5 pointer-events-none text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground truncate max-w-[120px] sm:max-w-[260px]">
                  {fund?.name ?? "Treasury"}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 py-0 bg-primary/10 text-primary border-primary/30"
                >
                  {fund?.currency ?? "IDR"}
                </Badge>
              </div>
            )}
          </div>

          {/* Small Saldo Metric & Quick Record Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[9px] sm:text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                {t("treasury.overview.treasuryBalance")}
              </span>
              <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                {isFrozen && <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-400" />}
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground">
                  {fund?.currency ?? "IDR"} {fund ? fund.balance.toLocaleString() : "0"}
                </span>
              </div>
            </div>

            {canSign && !fund?.isArchived && onOpenRecordPayment && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={onOpenRecordPayment}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-mono px-2 sm:px-2.5 flex items-center gap-1 sm:gap-1.5 cursor-pointer border-border/80 hover:border-primary/40 ml-1"
              >
                <PenLine className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Record</span>
              </Button>
            )}
          </div>
        </div>

        {/* Main Hero Section: Big Tunggakan (Dues) Display */}
        {unpaidPeriods === undefined ? (
          /* Loading Skeleton */
          <div className="py-4 space-y-2 animate-pulse">
            <div className="h-3 w-28 bg-muted/60 rounded" />
            <div className="h-8 w-44 bg-muted/60 rounded" />
            <div className="h-10 w-full bg-muted/60 rounded mt-2" />
          </div>
        ) : unpaidCount > 0 ? (
          /* Unpaid Dues Hero State */
          <div className="space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{t("treasury.overview.outstandingDuesTitle")}</span>
              </span>
              <Badge
                variant="outline"
                className="text-[10px] sm:text-xs font-mono px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
              >
                {unpaidCount} {unpaidCount > 1 ? "CYCLES" : "CYCLE"}
              </Badge>
            </div>

            {/* Big Tunggakan Amount */}
            <div className="space-y-0.5 sm:space-y-1">
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-xs sm:text-sm font-mono font-bold text-amber-400/80">
                  {fund?.currency ?? "IDR"}
                </span>
                <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-amber-300">
                  {totalUnpaid.toLocaleString()}
                </span>
              </div>

              {oldestPeriod && (
                <p className="text-[11px] sm:text-xs font-mono text-muted-foreground truncate">
                  {oldestPeriod.periodLabel}
                  {" • "}
                  {isOverdue ? (
                    <span className="text-red-400 font-semibold">Jatuh Tempo</span>
                  ) : (
                    <span>Jatuh tempo {new Date(oldestPeriod.dueDate).toLocaleDateString()}</span>
                  )}
                </p>
              )}
            </div>

            {/* Big Pay Button Beneath the Tunggakan */}
            <Button
              type="button"
              variant="cyber"
              chamfer="dual"
              size="default"
              onClick={onOpenPayDues}
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-mono font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
            >
              <CreditCard className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              <span>
                {t("treasury.overview.payDuesNow")} ({fund?.currency ?? "IDR"}{" "}
                {totalUnpaid.toLocaleString()})
              </span>
            </Button>
          </div>
        ) : (
          /* All Paid Hero State */
          <div className="py-2 sm:py-3 space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{t("treasury.overview.outstandingDuesTitle")}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-emerald-400">
                {t("treasury.overview.allDuesPaidTitle")}
              </span>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground font-mono">
              {t("treasury.overview.allDuesPaidSubtitle")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { UnifiedMobileFinancialHero as UnifiedFinancialHero };
