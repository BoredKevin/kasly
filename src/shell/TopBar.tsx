import { Authenticated, useQuery } from "convex/react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useActiveWorkspace } from "../contexts";
import { LanguageToggle } from "../components/common";
import { SignOutButton } from "../features/auth";
import {
  Landmark,
  Building2,
  User,
  ChevronDown,
} from "lucide-react";

export function TopBar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { activeOrgId, setActiveOrgId, activeFundId, setActiveFundId } = useActiveWorkspace();

  const orgs = useQuery(api.organizations.listMine);
  const effectiveOrgId = activeOrgId ?? orgs?.[0]?._id;

  const funds = useQuery(
    api.treasury.funds.list,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  // If user has orgs but activeOrgId is not set, set it
  if (orgs && orgs.length > 0 && !activeOrgId) {
    setActiveOrgId(orgs[0]._id);
  }

  // Derive active fund
  const currentFund =
    funds?.find((f) => f._id === activeFundId) ??
    funds?.find((f) => !f.isArchived) ??
    funds?.[0];

  // Auto-sync active fund in context if not yet set
  if (funds && funds.length > 0 && !activeFundId && currentFund) {
    setActiveFundId(currentFund._id);
  }

  const isTreasuryActive = location.startsWith("/treasury") || location === "/";
  const isOrgActive = location.startsWith("/organization");
  const isProfileActive = location.startsWith("/profile");

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md px-4 sm:px-6 h-14 border-b border-border/80 flex items-center justify-between">
      {/* Left: Brand & Desktop Section Navigation */}
      <div className="flex items-center gap-3 sm:gap-6">
        <Link href="/treasury" className="flex items-center gap-2 cursor-pointer group">
          <div className="w-7 h-7 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold font-mono text-xs group-hover:bg-primary/20 transition-colors">
            K
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            Kasly
          </span>
        </Link>

        {/* Organization Switcher Dropdown (If > 1 org) or Org Badge */}
        <Authenticated>
          {orgs && orgs.length > 1 ? (
            <div className="relative">
              <select
                value={effectiveOrgId ?? ""}
                onChange={(e) => setActiveOrgId(e.target.value as Id<"organizations">)}
                className="h-7 pl-2 pr-6 bg-muted/30 border border-border/70 rounded-[var(--fintech-radius-sm)] text-xs font-medium text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary max-w-[140px] truncate"
                aria-label="Select organization"
              >
                {orgs.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 pointer-events-none text-muted-foreground" />
            </div>
          ) : orgs && orgs.length === 1 ? (
            <span className="hidden sm:inline-block text-xs font-medium text-muted-foreground border-l border-border/60 pl-3">
              {orgs[0].name}
            </span>
          ) : null}

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/20 p-0.5 rounded-[var(--fintech-radius-sm)] border border-border/60">
            <Link
              href="/treasury"
              className={`px-3 py-1 text-xs font-medium rounded-[var(--fintech-radius-xs)] transition-colors flex items-center gap-1.5 cursor-pointer ${
                isTreasuryActive
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>{t("nav.treasury")}</span>
            </Link>

            <Link
              href="/organization"
              className={`px-3 py-1 text-xs font-medium rounded-[var(--fintech-radius-xs)] transition-colors flex items-center gap-1.5 cursor-pointer ${
                isOrgActive
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{t("nav.organization")}</span>
            </Link>

            <Link
              href="/profile"
              className={`px-3 py-1 text-xs font-medium rounded-[var(--fintech-radius-xs)] transition-colors flex items-center gap-1.5 cursor-pointer ${
                isProfileActive
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{t("nav.userProfile")}</span>
            </Link>
          </nav>
        </Authenticated>
      </div>

      {/* Right: Active Fund Selector, Language Toggle & User Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Authenticated>
          {/* Fund Selector Pill (Universal) */}
          {funds && funds.length > 0 && isTreasuryActive && (
            <div className="relative">
              <select
                value={currentFund?._id ?? ""}
                onChange={(e) => setActiveFundId(e.target.value as Id<"funds">)}
                className="h-7 pl-2 pr-6 bg-muted/40 hover:bg-muted/60 border border-border/80 rounded-[var(--fintech-radius-sm)] text-xs font-medium text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary max-w-[150px] sm:max-w-[200px] truncate"
                aria-label="Active treasury fund"
              >
                {funds.map((fund) => (
                  <option key={fund._id} value={fund._id}>
                    {fund.name} ({fund.currency})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 top-2 pointer-events-none text-muted-foreground" />
            </div>
          )}
        </Authenticated>

        <LanguageToggle />

        <Authenticated>
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </Authenticated>
      </div>
    </header>
  );
}
