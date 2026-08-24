import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useActiveWorkspace } from "../../../contexts";
import { OrganizationSidebar, OrgTab } from "./OrganizationSidebar";
import { OrganizationProfileCard } from "./OrganizationProfileCard";
import { OrganizationRolesList } from "./OrganizationRolesList";
import { OrganizationMembersCard } from "./OrganizationMembersCard";
import { OrganizationInvitesCard } from "./OrganizationInvitesCard";
import { CreateOrgModal } from "./CreateOrgModal";
import { JoinOrgModal } from "./JoinOrgModal";
import {
  Building2,
  Crown,
  ChevronDown,
  Plus,
  LogIn,
} from "lucide-react";
import { Button } from "@boredkevin/ui";

interface OrganizationViewProps {
  activeTab?: OrgTab;
  onTabChange?: (tab: OrgTab) => void;
}

export function OrganizationView({
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
}: OrganizationViewProps = {}) {
  const [location, setLocation] = useLocation();
  const viewer = useQuery(api.users.viewer);
  const appSettings = useQuery(api.appSettings.get);
  const isOrgCreationDisabled = appSettings?.allowOrganizationCreation === false;
  const orgs = useQuery(api.organizations.listMine);
  const { activeOrgId, setActiveOrgId } = useActiveWorkspace();

  const getTabFromLocation = (loc: string): OrgTab => {
    if (loc === "/organization/roles") return "roles";
    if (loc === "/organization/invites") return "invites";
    if (loc === "/organization/members") return "members";
    return "overview";
  };

  const currentTab = controlledTab ?? getTabFromLocation(location);
  const handleSelectTab = (tab: OrgTab) => {
    if (controlledOnTabChange) {
      controlledOnTabChange(tab);
    }
  };

  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isJoinOrgOpen, setIsJoinOrgOpen] = useState(false);

  // If user has orgs but activeOrgId is not set, select the first one
  if (orgs && orgs.length > 0 && !activeOrgId) {
    setActiveOrgId(orgs[0]._id);
  }

  const activeOrg = useQuery(
    api.organizations.get,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );

  const canManageInvites = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_INVITES"),
  );

  const canCreateInvites = Boolean(
    canManageInvites || myMembership?.permissions.includes("CREATE_INVITES"),
  );

  const canViewInvites = canManageInvites || canCreateInvites;

  if (viewer === undefined || orgs === undefined) {
    return (
      <div className="w-full flex items-center justify-center py-20 text-muted-foreground text-sm font-mono animate-pulse">
        Loading organization workspace...
      </div>
    );
  }

  const hasOrgs = Boolean(orgs && orgs.length > 0 && activeOrgId);

  // If user has no orgs, force tab to overview; if current tab is invites but user has no invite permissions, fallback to overview
  const safeCurrentTab = !hasOrgs
    ? "overview"
    : currentTab === "invites" && !canViewInvites
      ? "overview"
      : currentTab;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Workspace Header & Mobile Workspace Switcher */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Organization Workspace
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage workspace profile, members, role hierarchy, and invitations
          </p>
        </div>

        {/* Mobile Workspace Switcher Bar */}
        <div className="md:hidden p-3 bg-card/80 backdrop-blur-md border border-border/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/20 border border-primary/40 text-primary">
                <Building2 className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
                Workspace
              </span>
            </div>
            {activeOrg?.isOwner && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Crown className="w-2.5 h-2.5" /> OWNER
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {orgs && orgs.length > 0 ? (
              <div className="relative flex-1 min-w-0">
                <select
                  value={activeOrgId ?? ""}
                  onChange={(e) => {
                    setActiveOrgId(e.target.value as Id<"organizations">);
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
              <div className="text-xs text-muted-foreground italic py-1 font-mono flex-1">
                No workspaces
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="dual"
              onClick={() => setIsJoinOrgOpen(true)}
              className="h-8 text-xs px-2.5 flex items-center gap-1 cursor-pointer shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Join</span>
            </Button>

            <Button
              type="button"
              variant={isOrgCreationDisabled ? "outline" : "cyber"}
              size="sm"
              chamfer="dual"
              onClick={() => setIsCreateOrgOpen(true)}
              title={
                isOrgCreationDisabled
                  ? "Organization creation is disabled by system policy"
                  : "Create workspace"
              }
              className={`h-8 text-xs px-2.5 flex items-center gap-1 cursor-pointer shrink-0 ${
                isOrgCreationDisabled
                  ? "opacity-60 text-muted-foreground hover:bg-white/5"
                  : ""
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Responsive Workspace Grid */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left Desktop Sidebar (Hidden on mobile) */}
        <div className="hidden md:block md:sticky md:top-24">
          <OrganizationSidebar
            activeTab={safeCurrentTab}
            onSelectTab={handleSelectTab}
            activeOrgId={activeOrgId}
            onSelectOrg={setActiveOrgId}
            onOpenCreateOrg={() => setIsCreateOrgOpen(true)}
            onOpenJoinOrg={() => setIsJoinOrgOpen(true)}
          />
        </div>

        {/* Active Container Pane (Takes full width on mobile) */}
        <div className="min-w-0 w-full space-y-6">
          {safeCurrentTab === "overview" && (
            <div className="animate-in fade-in duration-200">
              <OrganizationProfileCard
                activeOrgId={activeOrgId}
                onSelectOrg={setActiveOrgId}
              />
            </div>
          )}

          {safeCurrentTab === "roles" && activeOrgId && (
            <div className="animate-in fade-in duration-200">
              <OrganizationRolesList organizationId={activeOrgId} />
            </div>
          )}

          {safeCurrentTab === "invites" && activeOrgId && activeOrg && canViewInvites && (
            <div className="animate-in fade-in duration-200">
              <OrganizationInvitesCard
                organizationId={activeOrgId}
                organizationName={activeOrg.name}
              />
            </div>
          )}

          {safeCurrentTab === "members" && activeOrgId && (
            <div className="animate-in fade-in duration-200">
              <OrganizationMembersCard
                organizationId={activeOrgId}
                currentUserId={viewer?._id}
              />
            </div>
          )}
        </div>
      </div>

      {/* Global Modals for Workspace Action Buttons */}
      <CreateOrgModal
        isOpen={isCreateOrgOpen}
        onClose={() => setIsCreateOrgOpen(false)}
        onSuccess={(newOrgId) => {
          setActiveOrgId(newOrgId);
          setLocation("/organization");
        }}
      />

      <JoinOrgModal
        isOpen={isJoinOrgOpen}
        onClose={() => setIsJoinOrgOpen(false)}
        onSuccess={(joinedOrgId) => {
          setActiveOrgId(joinedOrgId);
          setLocation("/organization");
        }}
      />
    </div>
  );
}

