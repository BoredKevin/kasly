import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import { Panel } from "../../../ui/Panel";
import { StatusPill } from "../../../ui/StatusPill";
import { Button } from "@boredkevin/ui";
import {
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
  onSelectFund?: (fundId: Id<"funds">) => void;
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
      {/* Top Row: Saldo Kas on Left, Quick Record Action on Right */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="min-w-0">
          <span className="text-xs font-medium text-muted-foreground block">
            {t("treasury.overview.treasuryBalance", "Saldo Kas")}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isFrozen && <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="text-xl sm:text-2xl font-bold font-sans tabular-nums text-foreground tracking-tight">
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
            className="h-8 text-xs px-3 flex items-center gap-1.5 cursor-pointer rounded-[var(--fintech-radius-sm)] font-medium shrink-0"
          >
            <PenLine className="w-3.5 h-3.5 text-primary" />
            <span>{t("nav.recordPayment", "Catat Pembayaran")}</span>
          </Button>
        )}
      </div>

      {/* Main Hero Section: Outstanding Dues Display */}
      {unpaidPeriods === undefined ? (
        <div className="py-4 space-y-2 animate-pulse">
          <div className="h-3 w-28 bg-muted/60 rounded" />
          <div className="h-8 w-44 bg-muted/60 rounded" />
          <div className="h-10 w-full bg-muted/60 rounded mt-2" />
        </div>
      ) : unpaidCount > 0 ? (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>{t("treasury.overview.outstandingDuesTitle", "Tunggakan Anda")}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="text-3xl sm:text-4xl font-bold font-sans tabular-nums tracking-tight text-amber-400">
              {formatMoney(totalUnpaid, currency)}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="text-amber-500 font-medium">
                {t(unpaidCount > 1 ? "treasury.overview.cycles" : "treasury.overview.cycle_one", { count: unpaidCount })}
              </span>
              {oldestPeriod && (
                <>
                  <span>•</span>
                  {isOverdue ? (
                    <span className="text-rose-400 font-medium">
                      {t("treasury.overview.overdue", "Terlambat")} {formatDate(oldestPeriod.dueDate)}
                    </span>
                  ) : (
                    <span>{t("treasury.overview.due", "Jatuh Tempo")} ({formatDate(oldestPeriod.dueDate)})</span>
                  )}
                </>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="default"
            chamfer="none"
            size="default"
            onClick={onOpenPayDues}
            className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-[var(--fintech-radius-sm)] pay-cta-glow mt-2 relative overflow-hidden group"
          >
            {/* Swiping shine effect */}
            <span
              className="absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]"
              aria-hidden="true"
            >
              <span className="absolute top-0 bottom-0 left-0 w-1/2 shine-gradient-swipe animate-shine-sweep" />
            </span>

            <CreditCard className="w-4 h-4 relative z-10" />
            <span className="relative z-10">
              {t("treasury.overview.payDuesNow", "Bayar")}
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
