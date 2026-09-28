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
  PenLine,
  Plus,
  ShieldAlert,
} from "lucide-react";

interface CompactBalanceBannerProps {
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
  canSign?: boolean;
  canAdmin?: boolean;
  onOpenRecordPayment?: () => void;
  onOpenCreateFund?: () => void;
}

export function CompactBalanceBanner({
  fund,
  funds,
  activeFundId,
  onSelectFund,
  canSign,
  canAdmin,
  onOpenRecordPayment,
  onOpenCreateFund,
}: CompactBalanceBannerProps) {
  const { t } = useTranslation();

  if (!fund) {
    return (
      <Card
        telemetry="TREASURY.NO_FUND_STRIP"
        cornerLines
        className="bg-card/80 border-border/80 shadow-md p-3"
      >
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span>{t("treasury.sidebar.noFundsFound")}</span>
          {canAdmin && onOpenCreateFund && (
            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="dual"
              onClick={onOpenCreateFund}
              className="h-7 text-xs px-2.5 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("nav.newFund")}</span>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const isFrozen = Boolean(fund.isFrozen);
  const isPositive = fund.balance > 0;
  const isNegative = fund.balance < 0;

  return (
    <Card
      telemetry="TREASURY.BALANCE_STRIP"
      cornerLines
      className="bg-card/90 backdrop-blur-md border-border/80 shadow-md"
    >
      <CardContent className="p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Fund Selector & Identification */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary shrink-0">
            <Landmark className="w-4 h-4" />
          </div>

          {funds && funds.length > 1 ? (
            <div className="relative min-w-0 max-w-[170px] sm:max-w-[220px]">
              <select
                value={activeFundId ?? ""}
                onChange={(e) => onSelectFund(e.target.value as Id<"funds">)}
                className="w-full h-8 px-2 pr-7 bg-background/80 border border-border/80 text-xs font-mono font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
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
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-mono text-xs font-bold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
                {fund.name}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-mono px-1.5 py-0 bg-primary/10 text-primary border-primary/30 shrink-0"
              >
                {fund.currency}
              </Badge>
            </div>
          )}
        </div>

        {/* Right: Balance Display, Health Indicator & Quick Action */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 ml-auto">
          {/* Balance Amount */}
          <div className="text-right space-y-0.5">
            <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center justify-end gap-1.5">
              <span>{t("treasury.overview.treasuryBalance")}</span>
              {isFrozen ? (
                <span className="text-red-400 font-bold flex items-center gap-0.5">
                  <ShieldAlert className="w-3 h-3" />
                  <span className="hidden sm:inline">Frozen</span>
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="hidden sm:inline">Verified</span>
                </span>
              )}
            </div>

            <div className="flex items-baseline justify-end gap-1 font-mono">
              <span className="text-[10px] font-semibold text-muted-foreground">
                {fund.currency}
              </span>
              <span
                className={`text-sm sm:text-base font-extrabold tracking-tight ${
                  isFrozen
                    ? "text-red-400 opacity-70"
                    : isPositive
                      ? "text-emerald-400"
                      : isNegative
                        ? "text-red-400"
                        : "text-foreground"
                }`}
              >
                {fund.balance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Quick Record Action for Treasurers */}
          {canSign && !fund.isArchived && onOpenRecordPayment && (
            <Button
              type="button"
              variant={isFrozen ? "destructive" : "outline"}
              size="sm"
              chamfer="dual"
              disabled={isFrozen}
              onClick={onOpenRecordPayment}
              className="h-8 text-xs font-mono px-2.5 flex items-center gap-1.5 cursor-pointer shrink-0 border-border/80 hover:border-primary/40"
              title={isFrozen ? "Ledger is frozen" : t("nav.recordPayment")}
              aria-label={t("nav.recordPayment")}
            >
              <PenLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("nav.recordPayment")}</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
