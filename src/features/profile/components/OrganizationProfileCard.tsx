import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  Building2,
  Crown,
  Plus,
  Calendar,
  Shield,
  CheckCircle2,
  UserPlus,
  LogIn,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { CreateOrgModal } from "./CreateOrgModal";
import { CreateInviteModal } from "./CreateInviteModal";
import { JoinOrgModal } from "./JoinOrgModal";

interface OrganizationProfileCardProps {
  activeOrgId: Id<"organizations"> | null;
  onSelectOrg: (id: Id<"organizations">) => void;
}

export function OrganizationProfileCard({
  activeOrgId,
  onSelectOrg,
}: OrganizationProfileCardProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const orgs = useQuery(api.organizations.listMine);
  const appSettings = useQuery(api.appSettings.get);
  const isOrgCreationDisabled = appSettings?.allowOrganizationCreation === false;

  const activeOrg = useQuery(
    api.organizations.get,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );
  const myMembership = useQuery(
    api.members.getMyMembership,
    activeOrgId ? { organizationId: activeOrgId } : "skip",
  );

  // If user has orgs but activeOrgId is not set, select the first one
  if (orgs && orgs.length > 0 && !activeOrgId) {
    onSelectOrg(orgs[0]._id);
  }

  const canCreateInvites =
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("CREATE_INVITES");

  const formattedCreationDate = activeOrg
    ? new Date(activeOrg._creationTime).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : null;

  return (
    <>
      <Card telemetry="ORG.PROFILE" cornerLines className="w-full bg-card/60 backdrop-blur-sm border-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-none bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Organization Profile
                </CardTitle>
              </div>
            </div>

            {activeOrg && canCreateInvites && (
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setIsInviteModalOpen(true)}
                className="text-xs flex items-center gap-1.5 h-8 text-primary hover:bg-primary/10 border-primary/40"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Invite Members</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {orgs === undefined || (activeOrgId && activeOrg === undefined) ? (
            <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
              Loading organization details...
            </div>
          ) : !activeOrg || orgs.length === 0 ? (
            <div className="p-6 sm:p-8 text-center bg-background/40 border border-dashed border-border flex flex-col items-center gap-3">
              <div className="p-3 bg-muted/40 text-muted-foreground">
                <Building2 className="w-8 h-8 opacity-60" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-sm font-semibold text-foreground">
                  No Organizations Found
                </h4>
                <p className="text-xs text-muted-foreground">
                  {isOrgCreationDisabled
                    ? "You are not a member of any organization yet. Join an existing workspace using an invitation code."
                    : "You are not a member of any organization yet. Create your first workspace or join one using an invitation code."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 mt-2 w-full max-w-xs sm:max-w-none sm:w-auto">
                <Button
                  variant="outline"
                  chamfer="dual"
                  size="sm"
                  onClick={() => setIsJoinModalOpen(true)}
                  className="text-xs w-full sm:w-auto cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 mr-1.5" />
                  Join via Code
                </Button>
                {!isOrgCreationDisabled ? (
                  <Button
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="text-xs w-full sm:w-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Create First Organization
                  </Button>
                ) : (
                  <span className="text-[11px] font-mono text-muted-foreground px-2.5 py-1.5 bg-muted/20 border border-border/40 text-center">
                    Creation restricted
                  </span>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Organization Header Banner */}
              <div className="p-4 bg-background/50 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-foreground tracking-tight truncate">
                      {activeOrg.name}
                    </h3>
                    {activeOrg.isOwner && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30 flex items-center gap-1 font-mono"
                      >
                        <Crown className="w-3 h-3" /> OWNER
                      </Badge>
                    )}
                    {activeOrg.slug && (
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                        /{activeOrg.slug}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeOrg.description || "No description provided for this organization."}
                  </p>
                </div>

                <div className="flex sm:flex-col items-start sm:items-end gap-1 shrink-0 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Created {formattedCreationDate}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/80">
                    ID: {activeOrg._id.substring(0, 12)}...
                  </span>
                </div>
              </div>

              {/* Your Membership & Authority in this Organization */}
              {myMembership && (
                <div className="p-3.5 bg-muted/20 border border-border/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-primary" /> Your Organization Membership
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      RANK LVL {myMembership.highestRolePosition}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Your Roles:</span>
                    {myMembership.roles.length > 0 ? (
                      myMembership.roles.map((r) => (
                        <span
                          key={r._id}
                          className="px-2 py-0.5 text-[11px] font-medium border font-mono rounded-none"
                          style={{
                            borderColor: r.color ? `${r.color}60` : "var(--border)",
                            backgroundColor: r.color ? `${r.color}15` : "rgba(255,255,255,0.05)",
                            color: r.color || "inherit",
                          }}
                        >
                          {r.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        @everyone (Default)
                      </span>
                    )}
                  </div>

                  {myMembership.permissions.length > 0 && (
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        {myMembership.permissions.includes("ADMINISTRATOR")
                          ? "Full Administrator Rights"
                          : `${myMembership.permissions.length} Active Permissions`}
                      </span>
                      <span className="font-mono text-[10px]">
                        Joined {new Date(myMembership.joinedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateOrgModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(newOrgId) => onSelectOrg(newOrgId)}
      />

      {activeOrg && (
        <CreateInviteModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          organizationId={activeOrg._id}
          organizationName={activeOrg.name}
        />
      )}

      <JoinOrgModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={(joinedOrgId) => onSelectOrg(joinedOrgId)}
      />
    </>
  );
}
