import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
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
  CalendarPlus,
  Users,
  Globe,
  Lock,
} from "lucide-react";
import { CreateManualDuesModal } from "./CreateManualDuesModal";
import { PreRegistrationAdminModal } from "./PreRegistrationAdminModal";

interface AdminPaneProps {
  organizationId: Id<"organizations">;
  activeFundId: Id<"funds"> | null;
  onOpenCreateFund: () => void;
}

export function AdminPane({ organizationId, activeFundId, onOpenCreateFund }: AdminPaneProps) {
  const { t } = useTranslation();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPreRegModalOpen, setIsPreRegModalOpen] = useState(false);

  const appSettings = useQuery(api.appSettings.get);
  const togglePublicReceipts = useMutation(api.appSettings.togglePublicLedgerReceipts);

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
                  {t("treasury.admin.pendingKeyReviews")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("treasury.admin.description")}
                </CardDescription>
              </div>
            </div>

            {pendingKeys && pendingKeys.length > 0 && (
              <Badge
                variant="secondary"
                className="font-mono text-xs px-2 py-0.5 border-amber-500/40 text-amber-300 bg-amber-500/15 font-bold animate-pulse"
              >
                {pendingKeys.length} {t("treasury.keys.pending").toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6">
          {pendingKeys === undefined ? (
            <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
              {t("common.loading")}
            </div>
          ) : pendingKeys.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              <Check className="w-6 h-6 text-emerald-400 mx-auto opacity-70" />
              <p className="text-xs font-mono text-muted-foreground">
                {t("treasury.keys.pendingApproval")}: 0
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
                    className={`p-4 border transition-all space-y-3 ${isRevoked
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
                    className={`p-4 border transition-all space-y-3 ${fund.isArchived
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

      {/* Section 4: Automated Dues Schedule Configuration */}
      <DuesScheduleSection
        organizationId={organizationId}
        funds={funds}
        initialFundId={activeFundId}
      />

      {/* Section 5: Public Transaction Proof Links Setting */}
      <Card telemetry="TREASURY.PUBLIC_RECEIPTS" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("treasury.admin.enablePublicReceipts")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("treasury.admin.enablePublicReceiptsDesc")}
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant={appSettings?.enablePublicLedgerReceipts !== false ? "default" : "outline"}
              size="sm"
              chamfer="dual"
              onClick={async () => {
                const current = appSettings?.enablePublicLedgerReceipts !== false;
                await togglePublicReceipts({ enabled: !current });
              }}
              className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0 font-mono"
            >
              {appSettings?.enablePublicLedgerReceipts !== false ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Enabled (Public)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Disabled (Restricted)</span>
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Section 6: Pre-Registered Student Roster & Settings */}
      <Card telemetry="TREASURY.PRE_REG" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("treasury.preReg.title")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("treasury.preReg.description")}
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="dual"
              onClick={() => setIsPreRegModalOpen(true)}
              className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t("treasury.preReg.openModalBtn")}</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Pre-Registration Admin Modal */}
      <PreRegistrationAdminModal
        organizationId={organizationId}
        isOpen={isPreRegModalOpen}
        onClose={() => setIsPreRegModalOpen(false)}
      />
    </div>
  );
}

interface DuesScheduleSectionProps {
  organizationId: Id<"organizations">;
  funds?: Array<{ _id: Id<"funds">; name: string; currency: string; isArchived: boolean }>;
  initialFundId: Id<"funds"> | null;
}

function DuesScheduleSection({
  organizationId,
  funds,
  initialFundId,
}: DuesScheduleSectionProps) {
  const [selectedFundIdState, setSelectedFundIdState] = useState<Id<"funds"> | null>(null);

  const activeFunds = funds?.filter((f) => !f.isArchived) ?? [];
  const selectedFundId =
    selectedFundIdState ??
    initialFundId ??
    activeFunds[0]?._id ??
    funds?.[0]?._id ??
    null;

  const currentFund = funds?.find((f) => f._id === selectedFundId);

  const duesConfig = useQuery(
    api.treasury.dues.getDuesConfig,
    organizationId && selectedFundId
      ? { organizationId, fundId: selectedFundId }
      : "skip"
  );
  const upsertDuesConfig = useMutation(api.treasury.dues.upsertDuesConfig);
  const disableDues = useMutation(api.treasury.dues.disableDues);

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateDuesModalOpen, setIsCreateDuesModalOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [intervalType, setIntervalType] = useState<"weekly" | "monthly" | "custom_days">("monthly");
  const [intervalValue, setIntervalValue] = useState<number>(1);
  const [amount, setAmount] = useState<string>("20000");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when config loads or selected fund changes
  const [lastFundId, setLastFundId] = useState<Id<"funds"> | null>(null);
  if (selectedFundId !== lastFundId) {
    setLastFundId(selectedFundId);
    setIsEditing(false);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  const handleStartEdit = () => {
    if (duesConfig) {
      setIsEnabled(duesConfig.isEnabled);
      setIntervalType(duesConfig.intervalType);
      setIntervalValue(duesConfig.intervalValue);
      setAmount(duesConfig.amount.toString());
    } else {
      setIsEnabled(true);
      setIntervalType("monthly");
      setIntervalValue(1);
      setAmount("20000");
    }
    setIsEditing(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId) {
      setErrorMessage("No fund selected.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid positive integer amount.");
      setIsSaving(false);
      return;
    }

    try {
      await upsertDuesConfig({
        organizationId,
        fundId: selectedFundId,
        isEnabled,
        intervalType,
        intervalValue: Number(intervalValue),
        amount: parsedAmount,
      });
      setStatusMessage(`Dues schedule for ${currentFund?.name || "fund"} saved successfully!`);
      setIsEditing(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedFundId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    if (duesConfig?.isEnabled) {
      try {
        await disableDues({ organizationId, fundId: selectedFundId });
        setIsEnabled(false);
        setStatusMessage(`Dues schedule for ${currentFund?.name || "fund"} has been disabled.`);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to disable schedule.");
      }
    } else {
      handleStartEdit();
      setIsEnabled(true);
    }
  };

  const dayOfWeekNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Card telemetry="TREASURY.DUES_CONFIG" cornerLines className="bg-card border-border shadow-lg">
      <CardHeader className="pb-4 border-b border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Automated Member Dues Schedule
              </CardTitle>
              <CardDescription className="text-xs">
                Configure scheduled dues cron jobs to automatically create dues cycles and track member obligations
              </CardDescription>
            </div>
          </div>

          {/* Target Fund Selector */}
          {funds && funds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Target Fund:</span>
              <select
                value={selectedFundId ?? ""}
                onChange={(e) => setSelectedFundIdState(e.target.value as Id<"funds">)}
                className="h-8 px-2.5 bg-background border border-border text-xs font-semibold font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                {funds.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.currency}){f.isArchived ? " [Archived]" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6 space-y-5">
        {statusMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {!selectedFundId ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground">
            Please create or select a fund to configure its dues schedule.
          </div>
        ) : duesConfig === undefined ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
            Loading dues configuration...
          </div>
        ) : !isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                Configuring: <strong className="text-foreground">{currentFund?.name} ({currentFund?.currency})</strong>
              </span>
              {duesConfig?.isEnabled ? (
                <Badge
                  variant="secondary"
                  className="font-mono text-xs px-2.5 py-0.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold"
                >
                  ACTIVE
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="font-mono text-xs px-2.5 py-0.5 border-muted-foreground/30 text-muted-foreground bg-muted/20"
                >
                  DISABLED
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-background/50 border border-border/60 space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Cycle Frequency
                </span>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {duesConfig?.intervalType === "weekly"
                    ? `Weekly on ${dayOfWeekNames[duesConfig.intervalValue] ?? "Day"}`
                    : duesConfig?.intervalType === "monthly"
                      ? `Monthly on Day ${duesConfig.intervalValue}`
                      : duesConfig?.intervalType === "custom_days"
                        ? `Every ${duesConfig.intervalValue} days`
                        : "Not configured"}
                </p>
              </div>

              <div className="p-3 bg-background/50 border border-border/60 space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Amount per Member
                </span>
                <p className="text-sm font-bold text-foreground font-mono">
                  {duesConfig
                    ? currentFund?.currency === "IDR"
                      ? `Rp ${duesConfig.amount.toLocaleString("id-ID")}`
                      : `${currentFund?.currency || "IDR"} ${duesConfig.amount.toLocaleString()}`
                    : "---"}
                </p>
              </div>

              <div className="p-3 bg-background/50 border border-border/60 space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Next Scheduled Trigger
                </span>
                <p className="text-xs font-mono text-foreground">
                  {duesConfig?.nextScheduledAt
                    ? new Date(duesConfig.nextScheduledAt).toLocaleString()
                    : duesConfig?.isEnabled
                      ? "Pending calculation..."
                      : "Schedule paused"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={handleStartEdit}
                  className="text-xs cursor-pointer"
                >
                  Configure Schedule
                </Button>

                <Button
                  type="button"
                  variant={duesConfig?.isEnabled ? "destructive" : "cyber"}
                  size="sm"
                  chamfer="dual"
                  onClick={() => {
                    void handleToggleActive();
                  }}
                  className="text-xs cursor-pointer"
                >
                  {duesConfig?.isEnabled ? "Disable Schedule" : "Enable Schedule"}
                </Button>
              </div>

              <Button
                type="button"
                variant="cyber"
                size="sm"
                chamfer="dual"
                onClick={() => setIsCreateDuesModalOpen(true)}
                className="text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Create Dues Cycle (Manual / Past)</span>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              void handleSaveConfig(e);
            }}
            className="space-y-4"
          >
            <div className="p-2.5 bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
              Editing dues schedule for: <strong>{currentFund?.name} ({currentFund?.currency})</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Interval Frequency
                </label>
                <select
                  value={intervalType}
                  onChange={(e) => {
                    const val = e.target.value as "weekly" | "monthly" | "custom_days";
                    setIntervalType(val);
                    if (val === "weekly") setIntervalValue(0);
                    else if (val === "monthly") setIntervalValue(1);
                    else if (val === "custom_days") setIntervalValue(7);
                  }}
                  className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="monthly">Monthly (Day of Month)</option>
                  <option value="weekly">Weekly (Day of Week)</option>
                  <option value="custom_days">Custom Days (Every N days)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {intervalType === "weekly"
                    ? "Day of Week"
                    : intervalType === "monthly"
                      ? "Day of Month (1 - 28)"
                      : "Interval (Days)"}
                </label>
                {intervalType === "weekly" ? (
                  <select
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {dayOfWeekNames.map((day, idx) => (
                      <option key={idx} value={idx}>
                        {day}
                      </option>
                    ))}
                  </select>
                ) : intervalType === "monthly" ? (
                  <select
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        Day {day} of month
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full h-9 px-3 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Amount per Member ({currentFund?.currency || "Smallest Unit"})
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 20000"
                  className="w-full h-9 px-3 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <span>Enable automated cron job scheduling for {currentFund?.name || "this fund"}</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setIsEditing(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="cyber"
                size="sm"
                chamfer="dual"
                disabled={isSaving}
                className="text-xs cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Schedule"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      <CreateManualDuesModal
        isOpen={isCreateDuesModalOpen}
        onClose={() => setIsCreateDuesModalOpen(false)}
        organizationId={organizationId}
        defaultFundId={selectedFundId}
        onSuccess={() => {
          setStatusMessage(`New dues cycle created for ${currentFund?.name || "fund"}! Check the Dues & Payments view.`);
        }}
      />
    </Card>
  );
}

