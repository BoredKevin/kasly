import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
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
  Link,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  Users,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { CreateInviteModal } from "./CreateInviteModal";

interface OrganizationInvitesCardProps {
  organizationId: Id<"organizations">;
  organizationName: string;
}

export function OrganizationInvitesCard({
  organizationId,
  organizationName,
}: OrganizationInvitesCardProps) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const myMembership = useQuery(api.members.getMyMembership, { organizationId });

  const canManageInvites = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_INVITES")
  );

  const canCreateInvites = Boolean(
    canManageInvites || myMembership?.permissions.includes("CREATE_INVITES")
  );

  // Only query invites list if user has MANAGE_INVITES permission, otherwise skip to prevent Convex 403 error
  const invites = useQuery(
    api.invites.list,
    canManageInvites ? { organizationId } : "skip",
  );

  const revokeInvite = useMutation(api.invites.revoke);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<Id<"invites"> | null>(null);

  // Don't render invites card if user has no invite permissions
  if (!myMembership || (!canManageInvites && !canCreateInvites)) {
    return null;
  }

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleRevoke = async (inviteId: Id<"invites">) => {
    setRevokingId(inviteId);
    try {
      await revokeInvite({ inviteId });
    } catch (err) {
      console.error("Failed to revoke invite", err);
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <>
      <Card telemetry="ORG.INVITES" cornerLines className="w-full bg-card/60 backdrop-blur-sm border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-none bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Link className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {t("organization.invites")}
                </CardTitle>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canManageInvites && invites && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  {invites.length} {invites.length === 1 ? "INVITE" : "INVITES"}
                </Badge>
              )}

              {canCreateInvites && (
                <Button
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsCreateOpen(true)}
                  className="text-xs flex items-center gap-1.5 h-8 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("organization.createInvite")}</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!canManageInvites ? (
            <div className="p-4 text-center text-xs text-muted-foreground bg-background/40 border border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span>You have permission to generate new invite codes for this workspace.</span>
              <Button
                variant="cyber"
                size="sm"
                chamfer="dual"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                {t("organization.createInvite")}
              </Button>
            </div>
          ) : invites === undefined ? (
            <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
              {t("common.loading")}
            </div>
          ) : invites.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground bg-background/40 border border-dashed border-border/80">
              No active invite codes generated yet.
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/80 bg-background/50">
              {invites.map((inv) => {
                const isExpired = inv.expiresAt ? now > inv.expiresAt : false;
                const formattedExpiry = inv.expiresAt
                  ? new Date(inv.expiresAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                  : "Never expires";

                return (
                  <div
                    key={inv._id}
                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-muted/40 border border-border font-mono text-sm font-bold tracking-wider text-primary select-all">
                        {inv.code}
                      </div>

                      <div className="space-y-0.5 min-w-0 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            Created by {inv.inviterName || "Member"}
                          </span>
                          {isExpired && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 font-mono">
                              EXPIRED
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Users className="w-3 h-3" />
                            {inv.uses} {inv.maxUses ? `/ ${inv.maxUses}` : ""} uses
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {formattedExpiry}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="dual"
                        onClick={() => {
                          void handleCopy(inv.code);
                        }}
                        className="h-7 text-xs flex items-center gap-1 px-2 cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedCode === inv.code ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-[11px]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[11px]">Copy</span>
                          </>
                        )}
                      </Button>

                      {canManageInvites && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="dual"
                          disabled={revokingId === inv._id}
                          onClick={() => {
                            void handleRevoke(inv._id);
                          }}
                          className="h-7 w-7 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Revoke Invite"
                        >
                          <Trash2 className="w-3 h-3" />
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

      <CreateInviteModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        organizationId={organizationId}
        organizationName={organizationName}
      />
    </>
  );
}
