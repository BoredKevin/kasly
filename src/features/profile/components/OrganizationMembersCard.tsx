import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@boredkevin/ui";
import {
  Users,
  Crown,
  Calendar,
  UserCheck,
  ShieldAlert,
  UserCog,
  Copy,
  Check,
  Mail,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { MemberActionModal, TargetMemberData } from "./MemberActionModal";
import { BannedMembersModal } from "./BannedMembersModal";

interface OrganizationMembersCardProps {
  organizationId: Id<"organizations">;
  currentUserId?: Id<"users">;
}

export function OrganizationMembersCard({
  organizationId,
  currentUserId,
}: OrganizationMembersCardProps) {
  const members = useQuery(api.members.list, { organizationId });
  const myMembership = useQuery(api.members.getMyMembership, { organizationId });

  const [selectedMember, setSelectedMember] = useState<TargetMemberData | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isBansModalOpen, setIsBansModalOpen] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const isOwner = myMembership?.isOwner ?? false;
  const permissions = myMembership?.permissions ?? [];
  const actorHighestPos = myMembership?.highestRolePosition ?? 0;

  const canBanMembers =
    isOwner ||
    permissions.includes("ADMINISTRATOR") ||
    permissions.includes("BAN_MEMBERS");

  if (members === undefined) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
        Loading organization members...
      </div>
    );
  }

  const handleCopyId = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleCopyEmail = async (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleOpenManage = (member: (typeof members)[0]) => {
    const highestPos =
      member.roles.length > 0
        ? Math.max(...member.roles.map((r) => r.position))
        : 0;

    setSelectedMember({
      memberId: member._id,
      userId: member.userId,
      displayName: member.name || member.email || "Member",
      email: member.email,
      nickname: member.nickname,
      roleIds: member.roles.map((r) => r._id),
      isOwner: member.isOwner,
      highestRolePosition: member.isOwner ? 999999 : highestPos,
    });
    setIsManageModalOpen(true);
  };

  return (
    <>
      <Card telemetry="ORG.MEMBERS" cornerLines className="w-full bg-card/60 backdrop-blur-sm border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Organization Members
                </CardTitle>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                {members.length} {members.length === 1 ? "MEMBER" : "MEMBERS"}
              </Badge>

              {canBanMembers && (
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsBansModalOpen(true)}
                  className="text-xs flex items-center gap-1.5 h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Banned Users</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {members.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No members found in this organization.
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/80 bg-background/50">
              {members.map((member) => {
                const displayName = member.name || member.email || "Unnamed Member";
                const initials = displayName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                const isCurrentViewer = currentUserId === member.userId;
                const formattedJoinDate = new Date(member.joinedAt).toLocaleDateString(
                  undefined,
                  { year: "numeric", month: "short", day: "numeric" },
                );

                const memberHighestPos =
                  member.roles.length > 0
                    ? Math.max(...member.roles.map((r) => r.position))
                    : 0;

                const canManageThisMember =
                  isCurrentViewer ||
                  (!member.isOwner &&
                    (isOwner ||
                      permissions.includes("ADMINISTRATOR") ||
                      permissions.includes("MANAGE_MEMBERS") ||
                      permissions.includes("MANAGE_ROLES") ||
                      permissions.includes("KICK_MEMBERS") ||
                      permissions.includes("BAN_MEMBERS")) &&
                    (isOwner || actorHighestPos > memberHighestPos));

                const truncatedUserId = `${member.userId.substring(0, 10)}...`;

                return (
                  <div
                    key={member._id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    {/* Member identity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="w-9 h-9 rounded-none border border-border bg-muted/40 flex items-center justify-center shrink-0">
                        <AvatarFallback className="rounded-none bg-muted/50 text-foreground font-mono text-xs font-bold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {displayName}
                          </span>
                          {member.nickname && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              ({member.nickname})
                            </span>
                          )}
                          {member.isOwner && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-400 border-amber-500/30 font-mono flex items-center gap-1"
                            >
                              <Crown className="w-2.5 h-2.5" /> OWNER
                            </Badge>
                          )}
                          {isCurrentViewer && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 text-primary border-primary/30 bg-primary/5 font-mono flex items-center gap-0.5"
                            >
                              <UserCheck className="w-2.5 h-2.5" /> YOU
                            </Badge>
                          )}
                        </div>

                        {/* ID + Tooltip Email + Joined Date */}
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <div className="inline-flex items-center gap-1">
                            {member.email ? (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="font-mono text-[10px] text-muted-foreground/80 cursor-pointer hover:text-foreground transition-colors border-b border-dashed border-border/80">
                                      ID: {truncatedUserId}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="p-2 bg-popover/95 backdrop-blur-md border border-border shadow-xl space-y-1.5"
                                  >
                                    <div className="flex items-center gap-1.5 font-mono text-xs">
                                      <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                                      <span className="text-foreground font-medium select-all">
                                        {member.email}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          void handleCopyEmail(member.email!, e);
                                        }}
                                        className="ml-1 p-0.5 hover:text-foreground text-muted-foreground transition-colors cursor-pointer"
                                        title="Copy Email"
                                      >
                                        {copiedEmail === member.email ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="font-mono text-[10px] text-muted-foreground/80">
                                ID: {truncatedUserId}
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                void handleCopyId(member.userId, e);
                              }}
                              className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5 cursor-pointer"
                              title="Copy User ID"
                            >
                              {copiedId === member.userId ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>

                          <span className="text-muted-foreground/40">•</span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Calendar className="w-3 h-3" /> {formattedJoinDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Roles & Management actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-12 sm:pl-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        {member.roles.length > 0 ? (
                          member.roles.map((role) => (
                            <span
                              key={role._id}
                              className="px-2 py-0.5 text-[10px] font-medium border font-mono rounded-none"
                              style={{
                                borderColor: role.color ? `${role.color}50` : "var(--border)",
                                backgroundColor: role.color ? `${role.color}15` : "rgba(255,255,255,0.05)",
                                color: role.color || "inherit",
                              }}
                            >
                              {role.name}
                            </span>
                          ))
                        ) : (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground border border-border/50 bg-muted/20">
                            @everyone
                          </span>
                        )}
                      </div>

                      {canManageThisMember && (
                        <Button
                          variant="outline"
                          size="sm"
                          chamfer="dual"
                          onClick={() => handleOpenManage(member)}
                          className="h-7 px-2 text-xs flex items-center gap-1 shrink-0 hover:text-foreground"
                          title="Manage Member"
                        >
                          <UserCog className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Manage</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <MemberActionModal
        isOpen={isManageModalOpen}
        onClose={() => {
          setIsManageModalOpen(false);
          setSelectedMember(null);
        }}
        organizationId={organizationId}
        targetMember={selectedMember}
        viewerUserId={currentUserId}
      />

      <BannedMembersModal
        isOpen={isBansModalOpen}
        onClose={() => setIsBansModalOpen(false)}
        organizationId={organizationId}
      />
    </>
  );
}
