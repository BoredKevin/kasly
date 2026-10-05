import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  CardContent,
  Button,
} from "@boredkevin/ui";
import { Panel, StatusPill } from "../../../ui";
import { useFormat } from "../../../hooks/useFormat";
import {
  Landmark,
  Plus,
  PenLine,
  ShieldAlert,
} from "lucide-react";

interface FundItem {
  _id: Id<"funds">;
  name: string;
  currency: string;
  balance: number;
  isArchived: boolean;
  isFrozen?: boolean;
}

interface CompactBalanceBannerProps {
  fund: FundItem | null | undefined;
  funds?: FundItem[];
  activeFundId: Id<"funds"> | null;
  onSelectFund: (fundId: Id<"funds">) => void;
  canSign: boolean;
  canAdmin: boolean;
  onOpenRecordPayment?: () => void;
  onOpenCreateFund?: () => void;
}

export function CompactBalanceBanner({
  fund,
  canSign,
  canAdmin,
  onOpenRecordPayment,
  onOpenCreateFund,
}: CompactBalanceBannerProps) {
  const { t } = useTranslation();
  const { money: formatMoney } = useFormat();

  if (!fund) {
    return (
      <Panel className="p-3 shadow-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("treasury.sidebar.noFundsFound", "No active treasury funds.")}</span>
          {canAdmin && onOpenCreateFund && (
            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="none"
              onClick={onOpenCreateFund}
              className="h-7 text-xs px-2.5 flex items-center gap-1 cursor-pointer font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("nav.newFund", "New Fund")}</span>
            </Button>
          )}
        </div>
      </Panel>
    );
  }

  const isFrozen = Boolean(fund.isFrozen);
  const isPositive = fund.balance > 0;
  const isNegative = fund.balance < 0;

  return (
    <Panel className="shadow-sm">
      <CardContent className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Treasury Ledger Anchor */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary rounded-[var(--fintech-radius-sm)] shrink-0">
            <Landmark className="w-4 h-4" />
          </div>
        </div>

        {/* Right: Quick Action & Balance Display */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-auto">
          {/* Quick Record Action for Treasurers */}
          {canSign && !fund.isArchived && onOpenRecordPayment && (
            <Button
              type="button"
              variant={isFrozen ? "destructive" : "outline"}
              size="sm"
              chamfer="none"
              disabled={isFrozen}
              onClick={onOpenRecordPayment}
              className="h-8 text-xs px-2.5 flex items-center gap-1.5 cursor-pointer shrink-0 border-border/80 hover:border-primary/40 font-medium"
              title={isFrozen ? "Ledger is frozen" : t("nav.recordPayment", "Record Payment")}
              aria-label={t("nav.recordPayment", "Record Payment")}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("nav.recordPayment", "Record Payment")}</span>
            </Button>
          )}

          {/* Balance Amount */}
          <div className="text-right space-y-0.5">
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center justify-end gap-1.5 font-medium">
              <span>{t("treasury.overview.treasuryBalance", "Balance")}</span>
              {isFrozen ? (
                <span className="text-red-400 font-semibold flex items-center gap-0.5">
                  <ShieldAlert className="w-3 h-3" />
                  <span className="hidden sm:inline">Frozen</span>
                </span>
              ) : (
                <StatusPill tone="success" dot className="py-0 px-1 text-[9px]">
                  <span className="hidden sm:inline">Verified</span>
                </StatusPill>
              )}
            </div>

            <div className="flex items-baseline justify-end gap-1 font-mono">
              <span
                className={`text-sm sm:text-base font-bold tracking-tight ${
                  isFrozen
                    ? "text-red-400 opacity-70"
                    : isPositive
                      ? "text-emerald-400"
                      : isNegative
                        ? "text-red-400"
                        : "text-foreground"
                }`}
              >
                {formatMoney(fund.balance, fund.currency)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Panel>
  );
}
