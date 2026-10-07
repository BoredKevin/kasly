import { useEffect } from "react";
import { Authenticated, useQuery, useConvexAuth } from "convex/react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../convex/_generated/api";
import { useActiveWorkspace } from "../contexts";
import { SignOutButton } from "../features/auth";
import { ThemeToggle, LanguageToggle } from "../components/common";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
} from "@boredkevin/ui";
import {
  Landmark,
  Building2,
  User,
  ChevronDown,
  Check,
} from "lucide-react";

export function TopBar() {
  const { t } = useTranslation();
  const [location] = useLocation();
  const { isAuthenticated } = useConvexAuth();
  const { activeOrgId, setActiveOrgId, activeFundId, setActiveFundId } = useActiveWorkspace();

  const orgs = useQuery(
    api.organizations.listMine,
    isAuthenticated ? {} : "skip"
  );
  const effectiveOrgId = activeOrgId ?? orgs?.[0]?._id;

  const funds = useQuery(
    api.treasury.funds.list,
    isAuthenticated && effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  // If user has orgs but activeOrgId is not set or invalid, sync it
  useEffect(() => {
    if (orgs && orgs.length > 0) {
      if (!activeOrgId || !orgs.some((o) => o._id === activeOrgId)) {
        setActiveOrgId(orgs[0]._id);
      }
    }
  }, [orgs, activeOrgId, setActiveOrgId]);

  // Derive active fund: prioritize active fund if present in funds list, otherwise pick first active
  const currentFund =
    funds?.find((f) => f._id === activeFundId && !f.isArchived) ??
    funds?.find((f) => f._id === activeFundId) ??
    funds?.find((f) => !f.isArchived) ??
    funds?.[0];

  // Auto-sync active fund in context if not yet set or if activeFundId is not valid
  useEffect(() => {
    if (funds && funds.length > 0 && currentFund) {
      const isStoredValid = funds.some((f) => f._id === activeFundId && !f.isArchived);
      if (!isStoredValid) {
        setActiveFundId(currentFund._id);
      }
    }
  }, [funds, activeFundId, currentFund, setActiveFundId]);

  const isTreasuryActive = location.startsWith("/treasury") || location === "/";
  const isOrgActive = location.startsWith("/organization");
  const isProfileActive = location.startsWith("/profile");

  return (
    <header
      className="sticky top-0 z-30 px-4 sm:px-6 h-14 border-b border-border/80 flex items-center justify-between"
      style={{
        backgroundColor: "hsl(var(--background) / 0.85)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Left: Brand & Desktop Section Navigation */}
      <div className="flex items-center gap-3 sm:gap-6">
        <Link
          href={isAuthenticated ? "/treasury" : "/login"}
          className="flex items-center gap-2 cursor-pointer group"
        >
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  className="h-7 px-2 bg-muted/30 hover:bg-muted/60 border-border/70 text-xs font-medium text-foreground flex items-center gap-1.5 cursor-pointer max-w-[140px]"
                  aria-label="Select organization"
                >
                  <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {orgs.find((org) => org._id === effectiveOrgId)?.name ?? "Organization"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 p-1">
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1">
                  {t("nav.organization", "Organizations")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {orgs.map((org) => {
                  const isSelected = org._id === effectiveOrgId;
                  return (
                    <DropdownMenuItem
                      key={org._id}
                      onClick={() => setActiveOrgId(org._id)}
                      className={`flex items-center justify-between px-2 py-1.5 text-xs rounded-[var(--fintech-radius-xs)] cursor-pointer ${
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span className="truncate">{org.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Right: Active Fund Selector & User Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Authenticated>
          {/* Fund Selector Dropdown (Universal) */}
          {funds && funds.length > 0 && isTreasuryActive && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  className="h-8 px-2.5 sm:px-3 bg-muted/40 hover:bg-muted/70 active:bg-muted/80 border-border/80 hover:border-primary/40 text-xs font-medium text-foreground flex items-center gap-1.5 sm:gap-2 cursor-pointer shadow-xs"
                  aria-label="Select active treasury fund"
                >
                  <Landmark className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-semibold text-xs text-foreground truncate max-w-[100px] sm:max-w-[160px]">
                    {currentFund?.name ?? "Treasury"}
                  </span>
                  {currentFund?.currency && (
                    <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {currentFund.currency}
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                  {t("treasury.funds.title", "Treasury Funds")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {funds.map((fund) => {
                  const isSelected = fund._id === currentFund?._id;
                  return (
                    <DropdownMenuItem
                      key={fund._id}
                      onClick={() => setActiveFundId(fund._id)}
                      className={`flex items-center justify-between px-2.5 py-2 cursor-pointer text-xs rounded-[var(--fintech-radius-xs)] transition-colors ${
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Landmark
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                        <span className="truncate">{fund.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                          {fund.currency}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </Authenticated>

        {/* Global Desktop Toggles */}
        <div className="hidden sm:flex items-center gap-1.5">
          <ThemeToggle compact />
          <LanguageToggle compact />
        </div>

        <Authenticated>
          <div className="hidden sm:block">
            <SignOutButton />
          </div>
        </Authenticated>
      </div>
    </header>
  );
}
