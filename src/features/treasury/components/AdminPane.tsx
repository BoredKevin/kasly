import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
} from "@boredkevin/ui";
import { Panel } from "../../../ui";
import {
  Check,
  Users,
  Globe,
  Lock,
} from "lucide-react";
import { PreRegistrationAdminModal } from "./PreRegistrationAdminModal";
import { PaymentGatewayCard } from "./PaymentGatewayCard";
import { PendingKeyApprovalsSection } from "./admin/PendingKeyApprovalsSection";
import { ActiveTrustedKeysSection } from "./admin/ActiveTrustedKeysSection";
import { FundManagementSection } from "./admin/FundManagementSection";
import { DuesScheduleSection } from "./admin/DuesScheduleSection";

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

      {/* Payment Gateway Configuration */}
      <PaymentGatewayCard organizationId={organizationId} />

      {/* Section 1: Pending Key Approvals */}
      <PendingKeyApprovalsSection
        pendingKeys={pendingKeys}
        processingId={processingId}
        onApproveKey={handleApproveKey}
        onRejectKey={handleRejectKey}
      />

      {/* Section 2: Active Trusted Keys */}
      <ActiveTrustedKeysSection
        activeKeys={activeKeys}
        processingId={processingId}
        onRevokeKey={handleRevokeKey}
      />

      {/* Section 3: Fund Management */}
      <FundManagementSection
        funds={funds}
        processingId={processingId}
        onOpenCreateFund={onOpenCreateFund}
        onArchiveFund={handleArchiveFund}
        onUnarchiveFund={handleUnarchiveFund}
      />

      {/* Section 4: Automated Dues Schedule Configuration */}
      <DuesScheduleSection
        organizationId={organizationId}
        funds={funds}
        initialFundId={activeFundId}
      />

      {/* Section 5: Public Transaction Proof Links Setting */}
      <Panel className="shadow-lg">
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
              chamfer="none"
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
      </Panel>

      {/* Section 6: Pre-Registered Student Roster & Settings */}
      <Panel className="shadow-lg">
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
              chamfer="none"
              onClick={() => setIsPreRegModalOpen(true)}
              className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t("treasury.preReg.openModalBtn")}</span>
            </Button>
          </div>
        </CardHeader>
      </Panel>

      {/* Pre-Registration Admin Modal */}
      <PreRegistrationAdminModal
        organizationId={organizationId}
        isOpen={isPreRegModalOpen}
        onClose={() => setIsPreRegModalOpen(false)}
        initialFundId={activeFundId}
      />
    </div>
  );
}
