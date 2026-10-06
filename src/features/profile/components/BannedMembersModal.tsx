import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Button,
  Badge,
} from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { Check, Calendar, AlertCircle } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface BannedMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
}

export function BannedMembersModal({
  isOpen,
  onClose,
  organizationId,
}: BannedMembersModalProps) {
  const bans = useQuery(
    api.members.listBans,
    isOpen ? { organizationId } : "skip",
  );
  const unban = useMutation(api.members.unban);

  const [unbanningUserId, setUnbanningUserId] = useState<Id<"users"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUnban = async (userId: Id<"users">) => {
    setUnbanningUserId(userId);
    setError(null);

    try {
      await unban({ organizationId, targetUserId: userId });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to unban user.",
      );
    } finally {
      setUnbanningUserId(null);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Banned Users Directory"
      description="Users restricted from entering this organization"
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
            {error && (
              <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive text-xs font-mono flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {bans === undefined ? (
              <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
                Loading bans list...
              </div>
            ) : bans.length === 0 ? (
              <div className="p-8 text-center bg-background/40 border border-dashed border-border/80 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">No Banned Users</p>
                <p>There are currently no users on the organization ban list.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60 border border-border/80 bg-background/50">
                {bans.map((b) => {
                  const formattedDate = new Date(b.bannedAt).toLocaleDateString(
                    undefined,
                    { year: "numeric", month: "short", day: "numeric" },
                  );

                  return (
                    <div
                      key={b._id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs text-foreground">
                            {b.userName || b.userEmail || "Banned User"}
                          </span>
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 font-mono">
                            BANNED
                          </Badge>
                        </div>

                        {b.userEmail && (
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {b.userEmail}
                          </p>
                        )}

                        {b.reason && (
                          <p className="text-xs text-destructive/90 italic">
                            "{b.reason}"
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {formattedDate}
                          </span>
                          {b.bannedBy && <span>• Banned by Admin</span>}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="dual"
                        disabled={unbanningUserId === b.userId}
                        onClick={() => {
                          void handleUnban(b.userId);
                        }}
                        className="text-xs shrink-0 self-end sm:self-auto h-8 px-3 cursor-pointer"
                      >
                        {unbanningUserId === b.userId ? (
                          <span>Unbanning...</span>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                            <span>Unban User</span>
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="dual"
                size="sm"
                onClick={onClose}
                className="text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>
      </div>
    </ResponsiveDialog>
  );
}
