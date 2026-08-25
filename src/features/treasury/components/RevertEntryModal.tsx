import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useConvex } from "convex/react";
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
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  RotateCcw,
  X,
  Lock,
  Sparkles,
  KeyRound,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import {
  loadKeypair,
  signLedgerPayload,
  SigningPayload,
} from "../../../lib/treasury-crypto";

export interface TargetLedgerEntry {
  _id: Id<"ledgerEntries">;
  fundId: Id<"funds">;
  sequenceNumber: number;
  direction: string;
  amount: number;
  memo: string;
  keyId: string;
}

interface RevertEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  entry: TargetLedgerEntry | null;
  currency?: string;
  onSuccess?: () => void;
  onOpenKeyGen?: () => void;
}

export function RevertEntryModal({
  isOpen,
  onClose,
  organizationId,
  entry,
  currency = "---",
  onSuccess,
  onOpenKeyGen,
}: RevertEntryModalProps) {
  const { t } = useTranslation();
  const convex = useConvex();
  const myKeys = useQuery(api.treasury.keys.getMyKeys, { organizationId });

  const [reason, setReason] = useState<string>("");
  const [selectedKeyIdState, setSelectedKeyIdState] = useState<string>("");
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 5-second hold to commit state
  const HOLD_DURATION_MS = 5000;
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);

  const revertEntryMutation = useMutation(api.treasury.ledger.revertEntry);

  // Active (non-revoked) keys belonging to current user
  const activeKeys = myKeys?.filter((k) => !k.revokedAt) ?? [];
  const selectedKeyId = selectedKeyIdState || activeKeys[0]?.keyId || "";

  // Clean up animation frame timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        cancelAnimationFrame(holdTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || !entry || typeof document === "undefined") return null;

  const compensatingDirection = entry.direction === "credit" ? "debit" : "credit";
  const isTargetCredit = entry.direction === "credit";

  const isSubmitDisabled = Boolean(isSigning || activeKeys.length === 0 || !reason.trim() || !selectedKeyId);

  const stopHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    holdStartTimeRef.current = null;
    if (holdTimerRef.current !== null) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const executeRevert = async () => {
    if (!reason.trim() || !selectedKeyId || isSubmitDisabled) return;

    setIsSigning(true);
    setError(null);

    try {
      // 1. Retrieve local non-extractable private key from IndexedDB
      const storedKey = await loadKeypair(selectedKeyId);
      if (!storedKey) {
        throw new Error(
          `Private key for (${selectedKeyId.slice(0, 8)}...) not found in this browser's IndexedDB. Did you generate this key on another device?`
        );
      }

      // 2. Query chain HEAD to determine sequence and previousHash
      const latestEntry = await convex.query(api.treasury.ledger.getLatestEntry, {
        fundId: entry.fundId,
      });

      const sequenceNumber = latestEntry.nextSequenceNumber;
      const previousHash = latestEntry.nextPreviousHash;
      const memo = `Revert #${entry.sequenceNumber}: ${reason.trim()}`;

      // 3. Construct signing payload for compensating transaction and digitally sign via Web Crypto
      const payload: SigningPayload = {
        fundId: entry.fundId,
        sequenceNumber,
        previousHash,
        direction: compensatingDirection,
        amount: entry.amount,
        memo,
        keyId: selectedKeyId,
      };

      const { signature } = await signLedgerPayload(storedKey.privateKey, payload);

      // 4. Submit revert mutation to Convex backend
      await revertEntryMutation({
        targetEntryId: entry._id,
        reason: reason.trim(),
        keyId: selectedKeyId,
        previousHash,
        signature,
      });

      setReason("");
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      console.error("Revert failure:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to sign and commit compensating entry."
      );
    } finally {
      setIsSigning(false);
    }
  };

  const startHold = (e: React.SyntheticEvent) => {
    if (isSubmitDisabled) return;
    e.preventDefault();

    setIsHolding(true);
    holdStartTimeRef.current = null;

    const update = (now: DOMHighResTimeStamp) => {
      if (holdStartTimeRef.current === null) {
        holdStartTimeRef.current = now;
      }
      const elapsed = now - holdStartTimeRef.current;
      const progress = Math.min(1, elapsed / HOLD_DURATION_MS);
      setHoldProgress(progress);

      if (progress >= 1) {
        stopHold();
        void executeRevert();
      } else {
        holdTimerRef.current = requestAnimationFrame(update);
      }
    };

    holdTimerRef.current = requestAnimationFrame(update);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg">
        <Card telemetry="TREASURY.REVERT_ENTRY" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("treasury.ledger.revertEntry")} #{entry.sequenceNumber}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Append an offsetting compensating transaction to HEAD
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                disabled={isSigning}
                onClick={onClose}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/40 text-xs font-mono text-destructive-foreground space-y-1">
                <p className="font-bold uppercase tracking-wider text-[10px]">
                  Revert Error
                </p>
                <p className="leading-snug">{error}</p>
              </div>
            )}

            {/* Target Entry Context Box */}
            <div className="p-3.5 bg-background/60 border border-border/70 space-y-2.5">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider font-semibold">
                Original Transaction Details
              </span>
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono px-1.5 py-0.5 ${isTargetCredit
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/15 text-red-300 border-red-500/30"
                      }`}
                  >
                    {isTargetCredit ? "CREDIT" : "DEBIT"}
                  </Badge>
                  <span className="font-bold text-foreground">
                    {currency} {entry.amount.toLocaleString()}
                  </span>
                </div>
                <span className="text-muted-foreground text-[11px]">
                  Entry #{entry.sequenceNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/20 p-2 border border-border/40 font-sans italic break-words [overflow-wrap:anywhere]">
                "{entry.memo}"
              </p>
            </div>

            {/* Compensating Action Notice */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-xs space-y-1 text-amber-300">
              <div className="flex items-center gap-1.5 font-bold font-mono text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Compensating Action:</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                This will append a new <strong>{compensatingDirection.toUpperCase()}</strong> entry of <strong>{currency} {entry.amount.toLocaleString()}</strong> to the chain HEAD, offsetting the balance while preserving the complete append-only history.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              className="space-y-4 pt-1"
            >
              {/* Revert Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Reason for Reversal *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Duplicate transaction, Client refund, Entry error"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isSigning}
                  required
                  chamfer="dual"
                />
              </div>

              {/* Signing Key Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    <span>Signing Key *</span>
                  </label>
                  {onOpenKeyGen && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      chamfer="dual"
                      onClick={onOpenKeyGen}
                      className="h-5 text-[10px] text-primary hover:underline font-mono cursor-pointer px-1"
                    >
                      + Generate Key
                    </Button>
                  )}
                </div>

                {activeKeys.length > 0 ? (
                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyIdState(e.target.value)}
                    disabled={isSigning}
                    className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    required
                  >
                    {activeKeys.map((k) => (
                      <option key={k._id} value={k.keyId}>
                        {k.label || "Unnamed Device"} ({k.keyId.slice(0, 8)}...)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-2">
                    <p>No active signing keys found for your account in this organization.</p>
                    {onOpenKeyGen && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="dual"
                        onClick={onOpenKeyGen}
                        className="text-xs h-7"
                      >
                        Generate Keypair Now
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Immutable Security Notice */}
              <div className="p-2.5 bg-muted/20 border border-border/50 text-[11px] text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  The reverse entry will be cryptographically signed by your browser private key and permanently linked to chain HEAD.
                </span>
              </div>

              {/* Form Action Buttons */}
              <div className="pt-3 border-t border-border space-y-1.5">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={isSigning || isHolding}
                    onClick={onClose}
                    className="cursor-pointer text-xs"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="dual"
                    disabled={isSubmitDisabled}
                    onPointerDown={startHold}
                    onPointerUp={stopHold}
                    onPointerLeave={stopHold}
                    onPointerCancel={stopHold}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`relative overflow-hidden text-xs flex items-center justify-center gap-1.5 cursor-pointer select-none px-4 py-2 min-w-[220px] transition-all ${
                      isHolding ? "border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]" : ""
                    }`}
                  >
                    {/* 5-second Hold Progress Fill */}
                    {isHolding && (
                      <div
                        className="absolute inset-0 bg-amber-500/35 pointer-events-none transition-none"
                        style={{
                          width: `${Math.min(100, holdProgress * 100)}%`,
                        }}
                      />
                    )}

                    <span className="relative z-10 flex items-center gap-1.5 font-mono">
                      {isSigning ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          <span>Signing & Committing...</span>
                        </>
                      ) : isHolding ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                          <span>
                            Hold to Sign: {((HOLD_DURATION_MS * (1 - holdProgress)) / 1000).toFixed(1)}s
                          </span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Hold 5s to Sign Reversal</span>
                        </>
                      )}
                    </span>
                  </Button>
                </div>
                {!isSubmitDisabled && !isSigning && (
                  <p className="text-[10px] font-mono text-muted-foreground text-right">
                    🔒 Hold button for 5 seconds to authorize reversal
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
