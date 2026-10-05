import { useState } from "react";
import { useQuery, useConvex } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@boredkevin/ui";
import { Panel, EmptyState } from "../../../ui";
import {
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { LedgerTimeline } from "./LedgerTimeline";

export interface LedgerPaneProps {
  fundId: Id<"funds"> | null;
  organizationId: Id<"organizations">;
  onOpenRecordPayment: () => void;
  onOpenKeyGen?: () => void;
}

export function LedgerPane({
  fundId,
  organizationId,
  onOpenRecordPayment,
  onOpenKeyGen,
}: LedgerPaneProps) {
  const { t } = useTranslation();
  const convex = useConvex();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    totalEntries: number;
    error?: string;
    failedAtSequence?: number;
    verifiedAt: number;
  } | null>(null);

  const fund = useQuery(
    api.treasury.funds.get,
    fundId ? { fundId } : "skip"
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    organizationId ? { organizationId } : "skip"
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  if (!fundId) {
    return (
      <EmptyState
        icon={<ScrollText className="w-8 h-8 text-muted-foreground" />}
        title={t("treasury.sidebar.noFundsFound", "No Fund Selected")}
        description={t("treasury.ledger.description", "Please select an active fund to view ledger transactions.")}
      />
    );
  }

  const handleVerifyChain = async () => {
    if (!fundId) return;
    setIsVerifying(true);
    try {
      const result = await convex.query(api.treasury.ledger.verifyChain, {
        fundId,
      });
      setVerificationResult(result);
    } catch (err: unknown) {
      setVerificationResult({
        isValid: false,
        totalEntries: 0,
        error: err instanceof Error ? err.message : "Verification action failed.",
        verifiedAt: Date.now(),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const isFrozen = Boolean(fund?.isFrozen);

  return (
    <div className="space-y-6">
      {/* Integrity Alert if Frozen */}
      {isFrozen && (
        <div className="p-4 rounded-[var(--fintech-radius-md)] bg-destructive/10 border border-destructive/40 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-[var(--fintech-radius-sm)] bg-destructive/20 border border-destructive/40 text-destructive">
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-destructive">
                Ledger Tamper Detected
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cryptographic verification failed during ledger replay. Access to commit new transactions is locked.
              </p>
            </div>
          </div>
          <div className="p-2.5 bg-black/40 border border-destructive/30 rounded-[var(--fintech-radius-sm)] font-mono text-xs text-destructive/90">
            {fund?.integrityError || "Hash mismatch or chain linkage broken in ledger history."}
          </div>
        </div>
      )}

      {/* Main Ledger Panel */}
      <Panel className="p-0 overflow-hidden bg-card border-border/80 shadow-sm">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 text-primary">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t("treasury.ledger.title", "Ledger Activity")} — {fund?.name ?? "Fund"}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("treasury.ledger.description", "Tamper-evident chained transaction history")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isVerifying || !fundId}
              onClick={() => {
                void handleVerifyChain();
              }}
              className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Verifying Chain...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Verify Chain</span>
                </>
              )}
            </Button>

            {canSign && !fund?.isArchived && (
              <Button
                type="button"
                variant={isFrozen ? "destructive" : "default"}
                size="sm"
                disabled={isFrozen}
                onClick={onOpenRecordPayment}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isFrozen ? "Ledger Frozen" : t("nav.recordPayment", "Record Entry")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Verification Feedback Banner */}
        {verificationResult && (
          <div className="p-3.5 border-b border-border/60 bg-muted/10 animate-in fade-in duration-200">
            {verificationResult.isValid ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-[var(--fintech-radius-sm)] text-xs flex items-center justify-between gap-3 text-emerald-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>Chain Integrity Verified:</strong> All {verificationResult.totalEntries} entries valid. Genesis to HEAD hash continuity and signatures intact.
                  </span>
                </div>
                <span className="text-[10px] font-mono opacity-80 shrink-0">
                  {new Date(verificationResult.verifiedAt).toLocaleTimeString()}
                </span>
              </div>
            ) : (
              <div className="p-3 bg-destructive/15 border border-destructive/40 rounded-[var(--fintech-radius-sm)] text-xs flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Verification Failed:</strong> {verificationResult.error || "Hash mismatch or broken signature detected."}
                  {verificationResult.failedAtSequence && ` (Sequence #${verificationResult.failedAtSequence})`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 sm:p-5">
          <LedgerTimeline
            fundId={fundId}
            organizationId={organizationId}
            pageSize={20}
            onOpenRecordPayment={onOpenRecordPayment}
            onOpenKeyGen={onOpenKeyGen}
            emptyMessage="No transactions have been signed for this fund yet. Use the Record Entry action to commit the first transaction."
          />
        </div>
      </Panel>
    </div>
  );
}
