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
  PenLine,
  CalendarDays,
  Receipt,
  Users,
} from "lucide-react";
import { StatusPill } from "../../../ui";

export type TreasuryTab = "overview" | "ledger" | "dues" | "invoices" | "keys" | "admin" | "bulk-dues";

interface TreasurySidebarProps {
  activeTab?: TreasuryTab;
  onSelectTab?: (tab: TreasuryTab) => void;
  activeOrgId: Id<"organizations"> | null;
  activeFundId: Id<"funds"> | null;
  onSelectFund?: (id: Id<"funds">) => void;
  onOpenRecordPayment: (prefill?: any) => void;
  onOpenDueEvent: () => void;
  onOpenCreateFund?: () => void;
  onAfterSelect?: () => void;
  className?: string;
}

export function TreasurySidebar({
  activeTab: explicitTab,
  onSelectTab,
  activeOrgId,
  activeFundId,
  onOpenRecordPayment,
  onOpenDueEvent,
  onAfterSelect,
  className = "",
}: TreasurySidebarProps) {
  const { t } = useTranslation();
  const [location] = useLocation();

  const getTabFromLocation = (loc: string): TreasuryTab => {
    if (loc === "/treasury/ledger") return "ledger";
    if (loc === "/treasury/dues") return "dues";
    if (loc === "/treasury/invoices") return "invoices";
    if (loc === "/treasury/keys") return "keys";
    if (loc === "/treasury/admin") return "admin";
    if (loc === "/treasury/bulk-dues" || loc === "/treasury/dues/bulk") return "bulk-dues";
    return "overview";
  };

  const currentActiveTab = explicitTab ?? getTabFromLocation(location);

  const myMembership = useQuery(
    api.members.getMyMembership,
    activeOrgId ? { organizationId: activeOrgId } : "skip"
  );

  const duesSummary = useQuery(
    api.treasury.dues.getDuesSummary,
    activeOrgId && activeFundId ? { organizationId: activeOrgId, fundId: activeFundId } : "skip"
  );

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

  const navItems = [
    {
      tab: "overview" as const,
      label: t("nav.overview"),
      href: "/treasury",
      icon: Landmark,
    },
    {
      tab: "ledger" as const,
      label: t("nav.ledger"),
      href: "/treasury/ledger",
      icon: ScrollText,
    },
    {
      tab: "dues" as const,
      label: t("nav.duesAndPayments"),
      href: "/treasury/dues",
      icon: CalendarDays,
      badge:
        duesSummary && duesSummary.totalUnpaidMemberships > 0
          ? `${duesSummary.totalUnpaidMemberships} due`
          : undefined,
      badgeTone: "warning" as const,
    },
    {
      tab: "invoices" as const,
      label: t("nav.invoices"),
      href: "/treasury/invoices",
      icon: Receipt,
    },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Primary Treasury Links */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-2 font-medium">
          {t("treasury.sidebar.treasuryCategory") || "Treasury"}
        </div>

        <div className="space-y-1">
          {navItems.map(({ tab, label, href, icon: Icon, badge, badgeTone }) => {
            const isActive = currentActiveTab === tab;
            return (
              <Link
                key={tab}
                href={href}
                onClick={() => handleTabClick(tab)}
                className={`w-full p-2.5 flex items-center justify-between rounded-[var(--fintech-radius-md)] border transition-all text-left cursor-pointer ${
                  isActive
                    ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-xs"
                    : "bg-muted/15 border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-[var(--fintech-radius-sm)] border ${
                      isActive
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-muted/40 border-border/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs">{label}</span>
                </div>

                {badge && (
                  <StatusPill tone={badgeTone ?? "warning"} className="text-[10px] py-0 px-1.5">
                    {badge}
                  </StatusPill>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Treasurer Management Section */}
      {canSign && (
        <div className="pt-4 border-t border-border/60 space-y-1.5">
          <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-2 font-medium">
            {t("treasury.sidebar.treasurerCategory") || "Management"}
          </div>

          <div className="space-y-1">
            {/* Record Payment Action */}
            <button
              type="button"
              onClick={() => {
                onOpenRecordPayment();
                onAfterSelect?.();
              }}
              className="w-full p-2.5 flex items-center justify-between rounded-[var(--fintech-radius-md)] border border-border/50 bg-muted/15 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/30 transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-[var(--fintech-radius-sm)] border bg-muted/40 border-border/60 text-muted-foreground group-hover:text-primary group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                  <PenLine className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">{t("nav.recordPayment")}</span>
              </div>
            </button>

            {canAdmin && onOpenDueEvent && (
              <button
                type="button"
                onClick={() => {
                  onOpenDueEvent();
                  onAfterSelect?.();
                }}
                className="w-full p-2.5 flex items-center justify-between rounded-[var(--fintech-radius-md)] border border-border/50 bg-muted/15 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/30 transition-all text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-[var(--fintech-radius-sm)] border bg-muted/40 border-border/60 text-muted-foreground group-hover:text-primary group-hover:bg-primary/20 group-hover:border-primary/40 transition-colors">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium">Create Due Period</span>
                </div>
              </button>
            )}

            {/* Bulk Dues */}
            <Link
              href="/treasury/bulk-dues"
              onClick={() => handleTabClick("bulk-dues")}
              className={`w-full p-2.5 flex items-center justify-between rounded-[var(--fintech-radius-md)] border transition-all text-left cursor-pointer ${
                currentActiveTab === "bulk-dues"
                  ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-xs"
                  : "bg-muted/15 border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-1.5 rounded-[var(--fintech-radius-sm)] border ${
                    currentActiveTab === "bulk-dues"
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs">Bulk Dues</span>
              </div>
            </Link>

            {/* My Keys */}
            <Link
              href="/treasury/keys"
              onClick={() => handleTabClick("keys")}
              className={`w-full p-2.5 flex items-center justify-between rounded-[var(--fintech-radius-md)] border transition-all text-left cursor-pointer ${
                currentActiveTab === "keys"
                  ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-xs"
                  : "bg-muted/15 border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-1.5 rounded-[var(--fintech-radius-sm)] border ${
                    currentActiveTab === "keys"
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
                >
                  <KeyRound className="w-4 h-4" />
                </div>
                <span className="text-xs">{t("nav.myKeys")}</span>
              </div>
            </Link>

            {/* Admin Panel */}
            {canAdmin && (
              <Link
                href="/treasury/admin"
                onClick={() => handleTabClick("admin")}
                className={`w-full p-2.5 flex items-center justify-between rounded-[var(--fintech-radius-md)] border transition-all text-left cursor-pointer ${
                  currentActiveTab === "admin"
                    ? "bg-primary/10 border-primary/40 text-primary font-semibold shadow-xs"
                    : "bg-muted/15 border-border/50 text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-[var(--fintech-radius-sm)] border ${
                      currentActiveTab === "admin"
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-muted/40 border-border/60 text-muted-foreground"
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="text-xs">{t("nav.adminPanel")}</span>
                </div>

                {pendingKeys && pendingKeys.length > 0 && (
                  <StatusPill tone="warning" className="text-[10px] py-0 px-1.5">
                    {pendingKeys.length} pending
                  </StatusPill>
                )}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
