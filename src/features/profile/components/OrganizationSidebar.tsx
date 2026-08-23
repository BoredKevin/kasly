import { useQuery } from "convex/react";
import { Link, useLocation } from "wouter";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Building2,
  Shield,
  Users,
  Link as LinkIcon,
  Crown,
  ChevronDown,
  Plus,
  LogIn,
} from "lucide-react";
import { Button, Badge } from "@boredkevin/ui";

export type OrgTab = "overview" | "roles" | "invites" | "members";

interface OrganizationSidebarProps {
  activeTab?: OrgTab;
  onSelectTab?: (tab: OrgTab) => void;
  activeOrgId: Id<"organizations"> | null;
  onSelectOrg: (id: Id<"organizations">) => void;
  onOpenCreateOrg: () => void;
  onOpenJoinOrg: () => void;
  onAfterSelect?: () => void;
  className?: string;
}

export function OrganizationSidebar({
  activeTab: explicitTab,
  onSelectTab,
  activeOrgId,
  onSelectOrg,
  onOpenCreateOrg,
  onOpenJoinOrg,
  onAfterSelect,
  className = "",
}: OrganizationSidebarProps) {
  const [location] = useLocation();

  const getTabFromLocation = (loc: string): OrgTab => {
    if (loc === "/organization/roles") return "roles";
    if (loc === "/organization/invites") return "invites";
    if (loc === "/organization/members") return "members";
    return "overview";
  };

  const currentActiveTab = explicitTab ?? getTabFromLocation(location);
  const appSettings = useQuery(api.appSettings.get);
  const isOrgCreationDisabled = appSettings?.allowOrganizationCreation === false;

  const orgs = useQuery(api.organizations.listMine);
  const hasOrgs = Boolean(orgs && orgs.length > 0 && activeOrgId);
  const activeOrg = useQuery(
    api.organizations.get,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );
  const myMembership = useQuery(
    api.members.getMyMembership,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );

  const roles = useQuery(
    api.roles.list,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );
  const members = useQuery(
    api.members.list,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
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

  const invites = useQuery(
    api.invites.list,
    activeOrgId && canManageInvites ? { organizationId: activeOrgId } : "skip",
  );

  const handleTabClick = (tab: OrgTab) => {
    onSelectTab?.(tab);
    onAfterSelect?.();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Workspace Settings Category */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
          WORKSPACE SETTINGS
        </div>

        <div className="space-y-2">
          {/* Overview Link */}
          <Link
            href="/organization"
            onClick={() => handleTabClick("overview")}
            style={{
              backgroundColor:
                currentActiveTab === "overview"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.03)",
            }}
            className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${
              currentActiveTab === "overview"
                ? "border-primary/60 text-foreground font-semibold shadow-md"
                : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 border ${
                  currentActiveTab === "overview"
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-muted/40 border-border/60 text-muted-foreground"
                }`}
              >
                <Building2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">Overview</span>
            </div>
          </Link>

          {/* Roles Link */}
          {hasOrgs && (
            <Link
              href="/organization/roles"
              onClick={() => handleTabClick("roles")}
              style={{
                backgroundColor:
                  currentActiveTab === "roles"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.03)",
              }}
              className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${
                currentActiveTab === "roles"
                  ? "border-primary/60 text-foreground font-semibold shadow-md"
                  : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 border ${
                    currentActiveTab === "roles"
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">Roles</span>
              </div>
              {roles && (
                <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted/40 border border-border/40">
                  {roles.length}
                </span>
              )}
            </Link>
          )}

          {/* Invites Link */}
          {hasOrgs && canViewInvites && (
            <Link
              href="/organization/invites"
              onClick={() => handleTabClick("invites")}
              style={{
                backgroundColor:
                  currentActiveTab === "invites"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.03)",
              }}
              className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${
                currentActiveTab === "invites"
                  ? "border-primary/60 text-foreground font-semibold shadow-md"
                  : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 border ${
                    currentActiveTab === "invites"
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
                >
                  <LinkIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">Invites</span>
              </div>
              {canManageInvites && invites && invites.length > 0 && (
                <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted/40 border border-border/40">
                  {invites.length}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* User Management Category */}
      {hasOrgs && (
        <div className="pt-4 border-t border-border/60 space-y-2">
          <div className="text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
            USER MANAGEMENT
          </div>

          <div className="space-y-2">
            {/* Members Link */}
            <Link
              href="/organization/members"
              onClick={() => handleTabClick("members")}
              style={{
                backgroundColor:
                  currentActiveTab === "members"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(255, 255, 255, 0.03)",
              }}
              className={`w-full p-3 flex items-center justify-between border transition-all text-left cursor-pointer ${
                currentActiveTab === "members"
                  ? "border-primary/60 text-foreground font-semibold shadow-md"
                  : "border-border/70 text-muted-foreground hover:text-foreground hover:border-border hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 border ${
                    currentActiveTab === "members"
                      ? "bg-primary/20 border-primary/40 text-primary"
                      : "bg-muted/40 border-border/60 text-muted-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">Members</span>
              </div>
              {members && (
                <span className="font-mono text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted/40 border border-border/40">
                  {members.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Workspace Switcher & Actions Section at the bottom */}
      <div className="pt-4 border-t border-border/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono tracking-wider text-muted-foreground uppercase px-1">
          <span>WORKSPACE</span>
          {activeOrg?.isOwner && (
            <Badge
              variant="secondary"
              className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono flex items-center gap-0.5"
            >
              <Crown className="w-2.5 h-2.5" /> OWNER
            </Badge>
          )}
        </div>

        <div
          style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
          className="p-3 border border-border/70 space-y-3"
        >
          {orgs && orgs.length > 0 ? (
            <div className="relative">
              <select
                value={activeOrgId ?? ""}
                onChange={(e) => {
                  onSelectOrg(e.target.value as Id<"organizations">);
                  onAfterSelect?.();
                }}
                className="w-full h-8 px-2.5 pr-8 bg-background border border-border text-xs text-foreground font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
              >
                {orgs.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name} {org.isOwner ? "👑" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none text-muted-foreground" />
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic py-1">
              No workspaces found
            </div>
          )}

          {/* Quick Workspace Buttons */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="dual"
              onClick={() => {
                onOpenJoinOrg();
                onAfterSelect?.();
              }}
              className="flex-1 h-7 text-[11px] px-2 flex items-center justify-center gap-1 cursor-pointer"
            >
              <LogIn className="w-3 h-3" />
              <span>Join</span>
            </Button>

            <Button
              type="button"
              variant={isOrgCreationDisabled ? "outline" : "cyber"}
              size="sm"
              chamfer="dual"
              onClick={() => {
                onOpenCreateOrg();
                onAfterSelect?.();
              }}
              title={
                isOrgCreationDisabled
                  ? "Organization creation is disabled by system policy"
                  : "Create a new organization"
              }
              className={`flex-1 h-7 text-[11px] px-2 flex items-center justify-center gap-1 cursor-pointer ${
                isOrgCreationDisabled
                  ? "opacity-60 text-muted-foreground hover:bg-white/5"
                  : ""
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>New Org</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
