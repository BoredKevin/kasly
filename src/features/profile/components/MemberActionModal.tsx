import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  UserCog,
  X,
  Shield,
  Tag,
  UserMinus,
  Ban,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

export interface TargetMemberData {
  memberId: Id<"members">;
  userId: Id<"users">;
  displayName: string;
  email?: string;
  nickname?: string;
  roleIds: Id<"roles">[];
  isOwner: boolean;
  highestRolePosition: number;
}

interface MemberActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  targetMember: TargetMemberData | null;
  viewerUserId?: Id<"users">;
}

function MemberActionModalInner({
  onClose,
  organizationId,
  targetMember,
  viewerUserId,
}: {
  onClose: () => void;
  organizationId: Id<"organizations">;
  targetMember: TargetMemberData;
  viewerUserId?: Id<"users">;
}) {
  const roles = useQuery(api.roles.list, { organizationId });
  const myMembership = useQuery(api.members.getMyMembership, { organizationId });

  // Mutations
  const assignRoles = useMutation(api.members.assignRoles);
  const updateNickname = useMutation(api.members.updateNickname);
  const kickMember = useMutation(api.members.kick);
  const banMember = useMutation(api.members.ban);

  // Form states initialized directly from props
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id<"roles">[]>(
    targetMember.roleIds || [],
  );
  const [nickname, setNickname] = useState(targetMember.nickname || "");
  const [kickReason, setKickReason] = useState("");
  const [banReason, setBanReason] = useState("");

  const [activeTab, setActiveTab] = useState<"roles" | "nickname" | "kick" | "ban">("roles");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isSelf = viewerUserId === targetMember.userId;
  const isOwner = myMembership?.isOwner ?? false;
  const permissions = myMembership?.permissions ?? [];
  const actorHighestPos = myMembership?.highestRolePosition ?? 0;

  const canManageRoles =
    (isOwner || permissions.includes("ADMINISTRATOR") || permissions.includes("MANAGE_ROLES")) &&
    !targetMember.isOwner &&
    !isSelf &&
    (isOwner || actorHighestPos > targetMember.highestRolePosition);

  const canManageNickname =
    isSelf ||
    ((isOwner || permissions.includes("ADMINISTRATOR") || permissions.includes("MANAGE_MEMBERS")) &&
      !targetMember.isOwner &&
      (isOwner || actorHighestPos > targetMember.highestRolePosition));

  const canKick =
    !isSelf &&
    !targetMember.isOwner &&
    (isOwner || permissions.includes("ADMINISTRATOR") || permissions.includes("KICK_MEMBERS")) &&
    (isOwner || actorHighestPos > targetMember.highestRolePosition);

  const canBan =
    !isSelf &&
    !targetMember.isOwner &&
    (isOwner || permissions.includes("ADMINISTRATOR") || permissions.includes("BAN_MEMBERS")) &&
    (isOwner || actorHighestPos > targetMember.highestRolePosition);

  // Handle Save Roles
  const handleSaveRoles = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await assignRoles({
        organizationId,
        targetUserId: targetMember.userId,
        roleIds: selectedRoleIds,
      });
      setStatusMessage({ type: "success", text: "Roles updated successfully." });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update roles.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save Nickname
  const handleSaveNickname = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await updateNickname({
        organizationId,
        targetUserId: targetMember.userId,
        nickname: nickname.trim() ? nickname.trim() : undefined,
      });
      setStatusMessage({ type: "success", text: "Nickname updated successfully." });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to update nickname.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Kick
  const handleKick = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await kickMember({
        organizationId,
        targetUserId: targetMember.userId,
        reason: kickReason.trim() ? kickReason.trim() : undefined,
      });
      setStatusMessage({ type: "success", text: `${targetMember.displayName} was kicked.` });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to kick member.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Ban
  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await banMember({
        organizationId,
        targetUserId: targetMember.userId,
        reason: banReason.trim() ? banReason.trim() : undefined,
      });
      setStatusMessage({ type: "success", text: `${targetMember.displayName} was banned.` });
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: unknown) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to ban member.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignableRoles = roles?.filter((r) => !r.isDefault) ?? [];

  return (
    <Card telemetry="ORG.MEMBER.MGMT" cornerLines className="bg-card border-border shadow-2xl">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Manage {targetMember.displayName}
              </CardTitle>
              <CardDescription className="text-xs">
                {targetMember.email || "Workspace Member Management"}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            chamfer="dual"
            onClick={onClose}
            className="h-7 w-7 p-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-border/40 mt-3">
          <button
            type="button"
            onClick={() => setActiveTab("roles")}
            className={`px-3 py-1 text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "roles"
                ? "bg-primary/20 border-primary text-foreground font-semibold"
                : "bg-muted/20 border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Roles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("nickname")}
            className={`px-3 py-1 text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "nickname"
                ? "bg-primary/20 border-primary text-foreground font-semibold"
                : "bg-muted/20 border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Nickname</span>
          </button>

          {canKick && (
            <button
              type="button"
              onClick={() => setActiveTab("kick")}
              className={`px-3 py-1 text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "kick"
                  ? "bg-amber-500/20 border-amber-500 text-amber-300 font-semibold"
                  : "bg-muted/20 border-border/60 text-muted-foreground hover:text-amber-400"
              }`}
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Kick</span>
            </button>
          )}

          {canBan && (
            <button
              type="button"
              onClick={() => setActiveTab("ban")}
              className={`px-3 py-1 text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === "ban"
                  ? "bg-destructive/20 border-destructive text-destructive font-semibold"
                  : "bg-muted/20 border-border/60 text-muted-foreground hover:text-destructive"
              }`}
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Ban</span>
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Status Alert Banner */}
        {statusMessage && (
          <div
            className={`p-3 text-xs font-mono flex items-center gap-2 border ${
              statusMessage.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                : "bg-destructive/15 border-destructive/40 text-destructive"
            }`}
          >
            {statusMessage.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* TAB: ROLES */}
        {activeTab === "roles" && (
          <form
            onSubmit={(e) => {
              void handleSaveRoles(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground">
                  Assign Organization Roles
                </label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {selectedRoleIds.length} assigned
                </span>
              </div>

              {!canManageRoles ? (
                <div className="p-3 bg-muted/20 border border-border/60 text-xs text-muted-foreground">
                  You do not have permission or sufficient hierarchy rank to modify this member's roles.
                </div>
              ) : assignableRoles.length === 0 ? (
                <div className="p-3 bg-muted/20 border border-border/60 text-xs text-muted-foreground">
                  No custom roles available in this organization.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-1">
                  {assignableRoles.map((role) => {
                    const isChecked = selectedRoleIds.includes(role._id);
                    const isAboveActorRank = !isOwner && role.position >= actorHighestPos;

                    return (
                      <label
                        key={role._id}
                        className={`flex items-center justify-between p-2.5 border transition-colors ${
                          isAboveActorRank
                            ? "opacity-50 cursor-not-allowed bg-muted/20 border-border/40"
                            : isChecked
                              ? "bg-primary/10 border-primary/40 cursor-pointer"
                              : "bg-background/50 border-border/60 hover:bg-muted/30 cursor-pointer"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isAboveActorRank}
                            onChange={() => {
                              if (isAboveActorRank) return;
                              setSelectedRoleIds((prev) =>
                                isChecked
                                  ? prev.filter((id) => id !== role._id)
                                  : [...prev, role._id],
                              );
                            }}
                            className="rounded-none text-primary focus:ring-0"
                          />
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: role.color || "#818cf8" }}
                          />
                          <span className="text-xs font-semibold text-foreground truncate">
                            {role.name}
                          </span>
                        </div>

                        <Badge variant="secondary" className="text-[9px] font-mono">
                          LVL {role.position}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {canManageRoles && (
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  onClick={onClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Saving..." : "Save Roles"}</span>
                </Button>
              </div>
            )}
          </form>
        )}

        {/* TAB: NICKNAME */}
        {activeTab === "nickname" && (
          <form
            onSubmit={(e) => {
              void handleSaveNickname(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Organization Nickname
              </label>
              <Input
                type="text"
                placeholder="Enter nickname (or leave empty to reset)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                chamfer="dual"
                disabled={!canManageNickname}
                className="text-xs h-8"
              />
              <p className="text-[11px] text-muted-foreground">
                Custom display name specific to this organization
              </p>
            </div>

            {canManageNickname && (
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  onClick={onClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-xs cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Update Nickname"}
                </Button>
              </div>
            )}
          </form>
        )}

        {/* TAB: KICK */}
        {activeTab === "kick" && canKick && (
          <form
            onSubmit={(e) => {
              void handleKick(e);
            }}
            className="space-y-4"
          >
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
              Kicking <strong>{targetMember.displayName}</strong> will remove them from the workspace. They can rejoin with a valid invite code.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Reason for Kick (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Inactivity, policy violation"
                value={kickReason}
                onChange={(e) => setKickReason(e.target.value)}
                chamfer="dual"
                className="text-xs h-8"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="dual"
                onClick={onClose}
                disabled={isSubmitting}
                size="sm"
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                chamfer="dual"
                size="sm"
                disabled={isSubmitting}
                className="text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Kicking..." : "Kick Member"}</span>
              </Button>
            </div>
          </form>
        )}

        {/* TAB: BAN */}
        {activeTab === "ban" && canBan && (
          <form
            onSubmit={(e) => {
              void handleBan(e);
            }}
            className="space-y-4"
          >
            <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive text-xs">
              Banning <strong>{targetMember.displayName}</strong> will immediately remove them from the organization and prevent them from joining via any invite link.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Reason for Ban (Optional)
              </label>
              <Input
                type="text"
                placeholder="e.g. Terms violation, spam"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                chamfer="dual"
                className="text-xs h-8"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="dual"
                onClick={onClose}
                disabled={isSubmitting}
                size="sm"
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                chamfer="dual"
                size="sm"
                disabled={isSubmitting}
                className="text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Banning..." : "Ban User"}</span>
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function MemberActionModal(props: MemberActionModalProps) {
  if (!props.isOpen || !props.targetMember) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg">
        <MemberActionModalInner
          key={props.targetMember.userId}
          onClose={props.onClose}
          organizationId={props.organizationId}
          targetMember={props.targetMember}
          viewerUserId={props.viewerUserId}
        />
      </div>
    </div>
  );
}
