import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  ShieldCheck,
  KeyRound,
  Landmark,
  Plus,
  Check,
  X,
  Ban,
  Archive,
  ArchiveRestore,
  User,
  Clock,
  Laptop,
} from "lucide-react";

interface AdminPaneProps {
  organizationId: Id<"organizations">;
  onOpenCreateFund: () => void;
}

export function AdminPane({ organizationId, onOpenCreateFund }: AdminPaneProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingKeys = useQuery(api.treasury.keys.listPendingKeys, { organizationId });
  const activeKeys = useQuery(api.treasury.keys.listActiveKeys, { organizationId });
  const funds = useQuery(api.treasury.funds.list, { organizationId });

  const approveKey = useMutation(api.treasury.keys.approveKey);
  const rejectKey = useMutation(api.treasury.keys.rejectKey);
  const revokeKey = useMutation(api.treasury.keys.revokeKey);
  const archiveFund = useMutation(api.treasury.funds.archive);
  const unarchiveFund = useMutation(api.treasury.funds.unarchive);

  const handleApproveKey = async (pendingKeyId: Id<"pendingKeys">) => {
    setProcessingId(pendingKeyId);
    setError(null);
    try {
      await approveKey({ pendingKeyId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to approve key.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectKey = async (pendingKeyId: Id<"pendingKeys">) => {
    setProcessingId(pendingKeyId);
    setError(null);
    try {
      await rejectKey({ pendingKeyId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reject key.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevokeKey = async (treasurerKeyId: Id<"treasurerKeys">) => {
    setProcessingId(treasurerKeyId);
    setError(null);
    try {
      await revokeKey({ treasurerKeyId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke key.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleArchiveFund = async (fundId: Id<"funds">) => {
    setProcessingId(fundId);
    setError(null);
    try {
      await archiveFund({ fundId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to archive fund.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnarchiveFund = async (fundId: Id<"funds">) => {
    setProcessingId(fundId);
    setError(null);
    try {
      await unarchiveFund({ fundId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to unarchive fund.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
          {error}
        </div>
      )}

      {/* Section 1: Pending Key Approvals */}
      <Card telemetry="TREASURY.PENDING_KEYS" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Pending Key Approvals
                </CardTitle>
                <CardDescription className="text-xs">
                  Zero-trust authorization: Review and verify treasurer signing keys
                </CardDescription>
              </div>
            </div>

            {pendingKeys && pendingKeys.length > 0 && (
              <Badge
                variant="secondary"
                className="font-mono text-xs px-2 py-0.5 border-amber-500/40 text-amber-300 bg-amber-500/15 font-bold animate-pulse"
              >
                {pendingKeys.length} PENDING
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6">
          {pendingKeys === undefined ? (
            <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
              Loading pending requests...
            </div>
          ) : pendingKeys.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <Check className="w-6 h-6 text-emerald-400 mx-auto opacity-70" />
              <p className="text-xs font-mono text-muted-foreground">
                No pending key registration requests. All keys are up to date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingKeys.map((item) => (
                <div
                  key={item._id}
                  className="p-4 bg-background border border-amber-500/30 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-muted/40 border border-border/60 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {item.userName || item.userEmail || "Treasurer User"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(item.requestedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Laptop className="w-3 h-3" />
                      <span>Device Label: <strong className="text-foreground">{item.label || "Unnamed Device"}</strong></span>
                    </div>

                    <div className="p-2 bg-muted/30 border border-border/60 space-y-0.5">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground">
                        Requested Key Fingerprint
                      </span>
                      <div className="font-mono text-xs font-bold text-amber-300 truncate select-all">
                        {item.keyId}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="dual"
                      disabled={processingId === item._id}
                      onClick={() => {
                        void handleRejectKey(item._id);
                      }}
                      className="h-7 text-xs px-2.5 text-destructive hover:bg-destructive/15 hover:border-destructive cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      <span>Reject</span>
                    </Button>

                    <Button
                      type="button"
                      variant="cyber"
                      size="sm"
                      chamfer="dual"
                      disabled={processingId === item._id}
                      onClick={() => {
                        void handleApproveKey(item._id);
                      }}
                      className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      <span>Approve Key</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Active Trusted Keys */}
      <Card telemetry="TREASURY.ACTIVE_KEYS" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Trusted Signing Keys
              </CardTitle>
              <CardDescription className="text-xs">
                Public keys currently authorized to commit signed ledger transactions
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6">
          {activeKeys === undefined ? (
            <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
              Loading active keys...
            </div>
          ) : activeKeys.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <Clock className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">
                No active treasurer keys registered for this organization.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeKeys.map((key) => {
                const isRevoked = Boolean(key.revokedAt);
                return (
                  <div
                    key={key._id}
                    className={`p-4 border transition-all space-y-3 ${
                      isRevoked
                        ? "bg-muted/10 border-border/40 opacity-70"
                        : "bg-background border-border/80 hover:border-border shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-muted/40 border border-border/60 text-muted-foreground">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {key.userName || key.userEmail || "Treasurer User"}
                        </span>
                      </div>

                      {isRevoked ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono px-1.5 py-0.5 bg-destructive/15 text-destructive-foreground border-destructive/30 font-bold"
                        >
                          REVOKED
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold"
                        >
                          ACTIVE
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Laptop className="w-3 h-3" />
                        <span>Device: <strong className="text-foreground">{key.label || "Unnamed Device"}</strong></span>
                      </div>

                      <div className="p-2 bg-muted/30 border border-border/60 space-y-0.5">
                        <span className="text-[9px] font-mono uppercase text-muted-foreground">
                          Fingerprint (keyId)
                        </span>
                        <div className="font-mono text-xs font-bold text-primary truncate select-all">
                          {key.keyId}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-border/40 text-[10px] font-mono text-muted-foreground">
                      <span>Registered: {new Date(key.registeredAt).toLocaleDateString()}</span>

                      {!isRevoked && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="dual"
                          disabled={processingId === key._id}
                          onClick={() => {
                            void handleRevokeKey(key._id);
                          }}
                          className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/15 hover:border-destructive cursor-pointer"
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          <span>Revoke Key</span>
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

      {/* Section 3: Fund Management */}
      <Card telemetry="TREASURY.FUNDS" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Fund Management
                </CardTitle>
                <CardDescription className="text-xs">
                  Create, configure, and archive organization treasury fund accounts
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="dual"
              onClick={onOpenCreateFund}
              className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Fund</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6">
          {funds === undefined ? (
            <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
              Loading funds...
            </div>
          ) : funds.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <Landmark className="w-6 h-6 text-muted-foreground mx-auto opacity-60" />
              <p className="text-xs font-mono text-muted-foreground">
                No treasury funds found. Click &quot;Create New Fund&quot; to establish the first fund.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {funds.map((fund) => {
                return (
                  <div
                    key={fund._id}
                    className={`p-4 border transition-all space-y-3 ${
                      fund.isArchived
                        ? "bg-muted/10 border-border/40 opacity-70"
                        : "bg-background border-border/80 hover:border-border shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-primary/10 border border-primary/20 text-primary">
                          <Landmark className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {fund.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono px-1.5 py-0.5 border-primary/40 text-primary bg-primary/10 font-bold"
                        >
                          {fund.currency}
                        </Badge>
                        {fund.isArchived && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono px-1.5 py-0.5 border-amber-500/40 text-amber-400 bg-amber-500/10 font-bold"
                          >
                            ARCHIVED
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {fund.description || "No description provided."}
                    </p>

                    <div className="pt-2 flex items-center justify-between border-t border-border/40 text-[10px] font-mono text-muted-foreground">
                      <span>Created: {new Date(fund._creationTime).toLocaleDateString()}</span>

                      {fund.isArchived ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="dual"
                          disabled={processingId === fund._id}
                          onClick={() => {
                            void handleUnarchiveFund(fund._id);
                          }}
                          className="h-6 text-[10px] px-2 text-primary hover:bg-primary/15 cursor-pointer"
                        >
                          <ArchiveRestore className="w-3 h-3 mr-1" />
                          <span>Unarchive</span>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="dual"
                          disabled={processingId === fund._id}
                          onClick={() => {
                            void handleArchiveFund(fund._id);
                          }}
                          className="h-6 text-[10px] px-2 text-amber-400 hover:bg-amber-500/15 hover:border-amber-500/40 cursor-pointer"
                        >
                          <Archive className="w-3 h-3 mr-1" />
                          <span>Archive</span>
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
    </div>
  );
}
