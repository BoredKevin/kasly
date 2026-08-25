import { useState } from "react";
import { useQuery, useConvex } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@boredkevin/ui";
import {
  ScrollText,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { LedgerTimeline } from "./LedgerTimeline";

interface LedgerPaneProps {
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
      <Card telemetry="TREASURY.NO_FUND" cornerLines className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <div className="inline-flex p-3 bg-muted/40 border border-border/60 text-muted-foreground rounded-full">
            <ScrollText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground">No Fund Selected</p>
            <p className="text-xs text-muted-foreground">
              Please select a fund from the sidebar to inspect its cryptographic ledger.
            </p>
          </div>
        </CardContent>
      </Card>
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
      {/* Critical Tamper Alert Banner */}
      {isFrozen && (
        <Card telemetry="TREASURY.INTEGRITY_ALERT" cornerLines className="bg-destructive/10 border-destructive/50 shadow-xl animate-in fade-in duration-200">
          <CardHeader className="pb-3 border-b border-destructive/30">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-destructive/20 border border-destructive/40 text-destructive-foreground">
                <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-red-400">
                  Ledger Tamper Detected
                </CardTitle>
                <CardDescription className="text-xs text-red-300/80">
                  Cryptographic verification failed during ledger replay. Access to commit new transactions is locked.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 font-mono text-xs text-red-300 break-words space-y-2">
            <p className="font-bold uppercase tracking-wider text-[10px] text-red-400">
              Integrity Diagnostic Log
            </p>
            <p className="p-2.5 bg-black/40 border border-destructive/30 leading-relaxed">
              {fund?.integrityError || "Hash mismatch or chain linkage broken in ledger history."}
            </p>
          </CardContent>
        </Card>
      )}

      <Card telemetry="TREASURY.LEDGER" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <ScrollText className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Ledger Chain {fund?.name ?? "Fund"}
                </CardTitle>
                <CardDescription className="text-xs">
                  Secure chained cryptographically signed ledger entries
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                disabled={isVerifying || !fundId}
                onClick={() => {
                  void handleVerifyChain();
                }}
                className="text-xs flex items-center gap-1.5 cursor-pointer"
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
                  variant={isFrozen ? "destructive" : "cyber"}
                  size="sm"
                  chamfer="dual"
                  disabled={isFrozen}
                  onClick={onOpenRecordPayment}
                  className="text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isFrozen ? "Ledger Frozen" : "Record Entry"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Verification Status Banner */}
          {verificationResult && (
            <div className="mt-4 pt-3 border-t border-border/60 animate-in fade-in duration-200">
              {verificationResult.isValid ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-xs flex items-center justify-between gap-3 text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-mono">
                      <strong>Chain Integrity Verified:</strong> All {verificationResult.totalEntries} entries valid. Genesis to HEAD hash continuity and signatures intact.
                    </span>
                  </div>
                  <span className="text-[10px] font-mono opacity-80 shrink-0">
                    {new Date(verificationResult.verifiedAt).toLocaleTimeString()}
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-destructive/15 border border-destructive/40 text-xs flex items-center gap-2 text-destructive-foreground">
                  <ShieldAlert className="w-4 h-4 text-destructive shrink-0" />
                  <span className="font-mono">
                    <strong>Verification Failed:</strong> {verificationResult.error || "Hash mismatch or broken signature detected."}
                    {verificationResult.failedAtSequence && ` (Sequence #${verificationResult.failedAtSequence})`}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-6 pb-6 space-y-6">
          <LedgerTimeline
            fundId={fundId}
            organizationId={organizationId}
            pageSize={20}
            onOpenRecordPayment={onOpenRecordPayment}
            onOpenKeyGen={onOpenKeyGen}
            emptyMessage="No transactions have been signed for this fund yet. Use the Record Entry action to commit the first transaction."
          />
        </CardContent>
      </Card>
    </div>
  );
}
