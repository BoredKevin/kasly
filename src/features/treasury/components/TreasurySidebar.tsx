import { useQuery } from "convex/react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Landmark,
  ScrollText,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  Plus,
  PenLine,
  CalendarDays,
} from "lucide-react";
import { Button, Badge } from "@boredkevin/ui";

export type TreasuryTab = "overview" | "ledger" | "dues" | "keys" | "admin";

interface TreasurySidebarProps {
  activeTab?: TreasuryTab;
  onSelectTab?: (tab: TreasuryTab) => void;
  activeOrgId: Id<"organizations"> | null;
  activeFundId: Id<"funds"> | null;
  onSelectFund: (id: Id<"funds">) => void;
  onOpenRecordPayment: (prefill?: any) => void;
  onOpenDueEvent: () => void;
  onOpenCreateFund: () => void;
  onAfterSelect?: () => void;
  className?: string;
}

export function TreasurySidebar({
  activeTab: explicitTab,
  onSelectTab,
  activeOrgId,
  activeFundId,
  onSelectFund,
  onOpenRecordPayment,
  onOpenDueEvent,
  onOpenCreateFund,
  onAfterSelect,
  className = "",
}: TreasurySidebarProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  const getTabFromLocation = (loc: string): TreasuryTab => {
    if (loc === "/treasury/ledger") return "ledger";
    if (loc === "/treasury/dues") return "dues";
    if (loc === "/treasury/keys") return "keys";
    if (loc === "/treasury/admin") return "admin";
    return "overview";
  };

  const currentActiveTab = explicitTab ?? getTabFromLocation(location);

  const myMembership = useQuery(
    api.members.getMyMembership,
    activeOrgId ? { organizationId: activeOrgId } : "skip"
  );

  const funds = useQuery(
    api.treasury.funds.list,
    activeOrgId ? { organizationId: activeOrgId } : "skip"
  );

  const duesSummary = useQuery(
    api.treasury.dues.getDuesSummary,
    activeOrgId && activeFundId ? { organizationId: activeOrgId, fundId: activeFundId } : "skip"
  );

  const activeFund = funds?.find((f) => f._id === activeFundId);

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  const canAdmin = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const pendingKeys = useQuery(
    api.treasury.keys.listPendingKeys,
    activeOrgId && canAdmin ? { organizationId: activeOrgId } : "skip"
  );

  const handleTabClick = (tab: TreasuryTab) => {
    onSelectTab?.(tab);
    onAfterSelect?.();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Treasury Category */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
          {t("treasury.sidebar.treasuryCategory")}
        </div>

        <div className="space-y-2">
          {/* Overview Link */}
          <Link
            href="/treasury"
            onClick={() => handleTabClick("overview")}
            style={{
              backgroundColor:
                currentActiveTab === "overview"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
            }}
            className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${currentActiveTab === "overview"
              ? "border-primary/60 text-foreground font-semibold shadow-md"
              : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 border ${currentActiveTab === "overview"
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
              >
                <Landmark className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{t("nav.overview")}</span>
            </div>
          </Link>

          {/* Ledger Link */}
          <Link
            href="/treasury/ledger"
            onClick={() => handleTabClick("ledger")}
            style={{
              backgroundColor:
                currentActiveTab === "ledger"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
            }}
            className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${currentActiveTab === "ledger"
              ? "border-primary/60 text-foreground font-semibold shadow-md"
              : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 border ${currentActiveTab === "ledger"
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
              >
                <ScrollText className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{t("nav.ledger")}</span>
            </div>
          </Link>

          {/* Dues & Payments Link */}
          <Link
            href="/treasury/dues"
            onClick={() => handleTabClick("dues")}
            style={{
              backgroundColor:
                currentActiveTab === "dues"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
            }}
            className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${currentActiveTab === "dues"
              ? "border-primary/60 text-foreground font-semibold shadow-md"
              : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 border ${currentActiveTab === "dues"
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
              >
                <CalendarDays className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">{t("nav.duesAndPayments")}</span>
            </div>

            {duesSummary && duesSummary.totalUnpaidMemberships > 0 && (
              <span className="font-mono text-[10px] text-amber-400 px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 font-bold animate-pulse">
                {duesSummary.totalUnpaidMemberships} {t("treasury.sidebar.dueBadge")}
              </span>
            )}
          </Link>
        </div>
      </div>


      {/* Treasurer Category */}
      {canSign && (
        <div className="pt-4 border-t border-border/60 space-y-2">
          <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
            {t("treasury.sidebar.treasurerCategory")}
          </div>

          <div className="space-y-2">
            {/* Record Payment Action Button */}
            <button
              type="button"
              onClick={() => {
                onOpenRecordPayment();
                onAfterSelect?.();
              }}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
              className="w-full p-3 flex items-center justify-between border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/60 hover:bg-white/5 transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 border bg-muted/40 border-border/60 text-muted-foreground group-hover:text-primary group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                  <PenLine className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{t("nav.recordPayment")}</span>
              </div>
            </button>

            {/* My Keys Link */}
            <Link
              href="/treasury/keys"
              onClick={() => handleTabClick("keys")}
              style={{
                backgroundColor:
                  currentActiveTab === "keys"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.03)",
              }}
              className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${currentActiveTab === "keys"
                ? "border-primary/60 text-foreground font-semibold shadow-md"
                : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 border ${currentActiveTab === "keys"
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-muted/40 border-border/60 text-muted-foreground"
                    }`}
                >
                  <KeyRound className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{t("nav.myKeys")}</span>
              </div>
            </Link>

            {/* Weekly Due Stub Action */}
            <button
              type="button"
              onClick={() => {
                onOpenDueEvent();
                onAfterSelect?.();
              }}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
              className="w-full p-3 flex items-center justify-between border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/60 hover:bg-white/5 transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 border bg-muted/40 border-border/60 text-muted-foreground group-hover:text-primary group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{t("nav.dueAdjustment")}</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Admin Category */}
      {canAdmin && (
        <div className="pt-4 border-t border-border/60 space-y-2">
          <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
            {t("treasury.sidebar.adminCategory")}
          </div>

          <div className="space-y-2">
            {/* Admin Panel Link */}
            <Link
              href="/treasury/admin"
              onClick={() => handleTabClick("admin")}
              style={{
                backgroundColor:
                  currentActiveTab === "admin"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.03)",
              }}
              className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${currentActiveTab === "admin"
                ? "border-primary/60 text-foreground font-semibold shadow-md"
                : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
                }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 border ${currentActiveTab === "admin"
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-muted/40 border-border/60 text-muted-foreground"
                    }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{t("nav.adminPanel")}</span>
              </div>
              {pendingKeys && pendingKeys.length > 0 && (
                <span className="font-mono text-[10px] text-amber-400 px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/30 font-bold animate-pulse">
                  {pendingKeys.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Fund Switcher Section at bottom */}
      <div className="pt-4 border-t border-border/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
          <span>{t("treasury.sidebar.activeFund")}</span>
          {activeFund && (
            <Badge
              variant="secondary"
              className={`text-[9px] px-1 py-0 font-mono ${activeFund.isFrozen
                ? "bg-destructive/20 text-red-300 border-destructive/40 font-bold animate-pulse"
                : "bg-primary/15 text-primary border-primary/30"
                }`}
            >
              {activeFund.isFrozen ? t("treasury.sidebar.frozenBadge") : activeFund.currency}
            </Badge>
          )}
        </div>

        <div
          style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          className="p-3 border border-border/70 space-y-3"
        >
          {funds && funds.length > 0 ? (
            <div className="relative">
              <select
                value={activeFundId ?? ""}
                onChange={(e) => {
                  onSelectFund(e.target.value as Id<"funds">);
                  onAfterSelect?.();
                }}
                className="w-full h-8 px-2.5 pr-8 bg-background border border-border text-xs text-foreground font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
              >
                {funds.map((fund) => (
                  <option key={fund._id} value={fund._id}>
                    {fund.isFrozen ? "⚠️ [FROZEN] " : ""}{fund.name} ({fund.currency})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none text-muted-foreground" />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic py-1">
              {t("treasury.sidebar.noFundsFound")}
            </div>
          )}

          {canAdmin && (
            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="dual"
              onClick={() => {
                onOpenCreateFund();
                onAfterSelect?.();
              }}
              className="w-full h-7 text-[11px] px-2 flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t("nav.newFund")}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
