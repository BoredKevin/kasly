import { ReactNode, useState } from "react";
import { Authenticated, useQuery } from "convex/react";
import { Link, useLocation } from "wouter";
import { api } from "../../../convex/_generated/api";
import { ConstellationsBackground } from "@boredkevin/ui";
import { Header } from "./Header";
import { SwipeDrawer } from "./SwipeDrawer";
import { NavDrawerProvider } from "./NavDrawerContext";
import { useNavDrawer } from "./useNavDrawer";
import { ActiveWorkspaceProvider, useActiveWorkspace } from "../../contexts";
import { SignOutButton } from "../../features/auth";
import {
  User,
  Building2,
  Shield,
  Link as LinkIcon,
  Users,
  ChevronDown,
  X,
  Landmark,
  ScrollText,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

export type OrgTab = "overview" | "roles" | "invites" | "members";
export type TreasuryTab = "overview" | "ledger" | "keys" | "admin";

interface LayoutProps {
  children: ReactNode;
}

function AuthenticatedDrawerContent({ onClose }: { onClose: () => void }) {
  const [location] = useLocation();
  const orgs = useQuery(api.organizations.listMine);
  const { activeOrgId } = useActiveWorkspace();
  const effectiveOrgId = activeOrgId ?? orgs?.[0]?._id;

  const myMembership = useQuery(
    api.members.getMyMembership,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip",
  );

  const canManageInvites = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_INVITES")
  );

  const canCreateInvites = Boolean(
    canManageInvites || myMembership?.permissions.includes("CREATE_INVITES")
  );

  const canViewInvites = canManageInvites || canCreateInvites;

  const canViewTreasury = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("VIEW_TREASURY")
  );

  const canSignTreasury = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  const canManageTreasury = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const hasOrgs = Boolean(orgs && orgs.length > 0);

  const orgSubTabs: { tab: OrgTab; label: string; href: string; icon: typeof Building2 }[] = hasOrgs
    ? [
        { tab: "overview", label: "Overview", href: "/organization", icon: Building2 },
        { tab: "roles", label: "Roles", href: "/organization/roles", icon: Shield },
        ...(canViewInvites
          ? [{ tab: "invites" as OrgTab, label: "Invites", href: "/organization/invites", icon: LinkIcon }]
          : []),
        { tab: "members", label: "Members", href: "/organization/members", icon: Users },
      ]
    : [];

  const treasurySubTabs: { tab: TreasuryTab; label: string; href: string; icon: typeof Landmark }[] = hasOrgs && canViewTreasury
    ? [
        { tab: "overview", label: "Overview", href: "/treasury", icon: Landmark },
        { tab: "ledger", label: "Ledger", href: "/treasury/ledger", icon: ScrollText },
        ...(canSignTreasury
          ? [{ tab: "keys" as TreasuryTab, label: "My Keys", href: "/treasury/keys", icon: KeyRound }]
          : []),
        ...(canManageTreasury
          ? [{ tab: "admin" as TreasuryTab, label: "Admin Panel", href: "/treasury/admin", icon: ShieldCheck }]
          : []),
      ]
    : [];

  const [orgDropdownManualState, setOrgDropdownManualState] = useState<boolean | null>(null);
  const [treasuryDropdownManualState, setTreasuryDropdownManualState] = useState<boolean | null>(null);

  const isOrgActive = location.startsWith("/organization");
  const isTreasuryActive = location.startsWith("/treasury");
  const isProfileActive = location === "/profile" || location === "/";

  const isOrgDropdownOpen =
    hasOrgs && (orgDropdownManualState !== null ? orgDropdownManualState : isOrgActive);

  const isTreasuryDropdownOpen =
    hasOrgs && (treasuryDropdownManualState !== null ? treasuryDropdownManualState : isTreasuryActive);

  const handleToggleOrgDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOrgDropdownManualState(!isOrgDropdownOpen);
  };

  const handleToggleTreasuryDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTreasuryDropdownManualState(!isTreasuryDropdownOpen);
  };

  return (
    <div className="space-y-6">
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-primary/10 border border-primary/30 text-primary font-bold font-mono text-xs">
            K
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            Kasly Menu
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* System Navigation Section */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
          NAVIGATION
        </div>

        <div className="space-y-1.5">
          {/* User Profile Link */}
          <Link
            href="/profile"
            onClick={onClose}
            style={{
              backgroundColor: isProfileActive
                ? "rgba(255, 255, 255, 0.08)"
                : "rgba(255, 255, 255, 0.03)",
            }}
            className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${
              isProfileActive
                ? "border-primary/60 text-foreground font-semibold shadow-md"
                : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 border ${
                  isProfileActive
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-muted/40 border-border/60 text-muted-foreground"
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">User Profile</span>
            </div>
          </Link>

          {/* Organization Item with Dropdown */}
          <div className="space-y-1">
            <div
              style={{
                backgroundColor: isOrgActive
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
              }}
              className={`w-full flex items-center justify-between border transition-all ${
                isOrgActive
                  ? "border-primary/60 text-foreground font-semibold shadow-md"
                  : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
            >
              <Link
                href="/organization"
                onClick={() => {
                  if (hasOrgs) {
                    setOrgDropdownManualState(true);
                  }
                  onClose();
                }}
                className="flex-1 p-3 flex items-center gap-3 text-left cursor-pointer"
              >
                <div
                  className={`p-2 border ${
                    isOrgActive
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">Organization</span>
              </Link>

              {hasOrgs && (
                <button
                  type="button"
                  onClick={handleToggleOrgDropdown}
                  className="p-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Toggle organization pages dropdown"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isOrgDropdownOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
              )}
            </div>

            {/* Organization Page Navigation Dropdown Sub-menu */}
            {hasOrgs && isOrgDropdownOpen && (
              <div className="pl-3 pr-1 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="border-l-2 border-primary/30 pl-2 space-y-1">
                  {orgSubTabs.map(({ tab, label, href, icon: SubIcon }) => {
                    const isSubActive =
                      (tab === "overview" && location === "/organization") ||
                      (tab !== "overview" && location === href);
                    return (
                      <Link
                        key={tab}
                        href={href}
                        onClick={onClose}
                        className={`w-full px-2.5 py-2 flex items-center justify-between text-left text-xs transition-all cursor-pointer ${
                          isSubActive
                            ? "bg-primary/15 text-primary border border-primary/40 font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <SubIcon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Treasury Item with Dropdown */}
          {hasOrgs && canViewTreasury && (
            <div className="space-y-1">
              <div
                style={{
                  backgroundColor: isTreasuryActive
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.03)",
                }}
                className={`w-full flex items-center justify-between border transition-all ${
                  isTreasuryActive
                    ? "border-primary/60 text-foreground font-semibold shadow-md"
                    : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
                }`}
              >
                <Link
                  href="/treasury"
                  onClick={() => {
                    setTreasuryDropdownManualState(true);
                    onClose();
                  }}
                  className="flex-1 p-3 flex items-center gap-3 text-left cursor-pointer"
                >
                  <div
                    className={`p-2 border ${
                      isTreasuryActive
                        ? "bg-primary/20 border-primary/40 text-primary"
                        : "bg-muted/40 border-border/60 text-muted-foreground"
                    }`}
                  >
                    <Landmark className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium">Treasury</span>
                </Link>

                {treasurySubTabs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleTreasuryDropdown}
                    className="p-3 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    aria-label="Toggle treasury pages dropdown"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isTreasuryDropdownOpen ? "rotate-180 text-primary" : ""
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* Treasury Page Navigation Dropdown Sub-menu */}
              {isTreasuryDropdownOpen && treasurySubTabs.length > 0 && (
                <div className="pl-3 pr-1 py-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="border-l-2 border-primary/30 pl-2 space-y-1">
                    {treasurySubTabs.map(({ tab, label, href, icon: SubIcon }) => {
                      const isSubActive =
                        (tab === "overview" && location === "/treasury") ||
                        (tab !== "overview" && location === href);
                      return (
                        <Link
                          key={tab}
                          href={href}
                          onClick={onClose}
                          className={`w-full px-2.5 py-2 flex items-center justify-between text-left text-xs transition-all cursor-pointer ${
                            isSubActive
                              ? "bg-primary/15 text-primary border border-primary/40 font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <SubIcon className="w-3.5 h-3.5" />
                            <span>{label}</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session Control Section */}
      <div className="pt-4 border-t border-border/60 space-y-3">
        <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
          Session
        </div>
        <div
          style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          className="p-3 border border-border/70 flex items-center justify-between"
        >
          <span className="text-xs text-muted-foreground">Signed in</span>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function LayoutInner({ children }: LayoutProps) {
  const { isMainNavOpen, closeMainNav } = useNavDrawer();

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      <ConstellationsBackground
        particleCount={30}
        lineOpacity={0.12}
        starSize={1.5}
      />

      <Header />

      {/* Main Navigation Left Drawer */}
      <SwipeDrawer side="left" isOpen={isMainNavOpen} onClose={closeMainNav}>
        <Authenticated>
          <AuthenticatedDrawerContent onClose={closeMainNav} />
        </Authenticated>
      </SwipeDrawer>

      <main className="p-4 sm:p-8 flex flex-col gap-8 relative z-10 w-full max-w-6xl mx-auto flex-1">
        {children}
      </main>
    </div>
  );
}

export function Layout(props: LayoutProps) {
  return (
    <ActiveWorkspaceProvider>
      <NavDrawerProvider>
        <LayoutInner {...props} />
      </NavDrawerProvider>
    </ActiveWorkspaceProvider>
  );
}


