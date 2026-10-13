import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useConvex } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveDialog } from "../../../ui";
import { Button } from "@boredkevin/ui";
import {
  PenLine,
  KeyRound,
  ShieldAlert,
  CalendarDays,
} from "lucide-react";
import { loadKeypair, listStoredKeys, signLedgerPayload, SigningPayload } from "../../../lib/treasury-crypto";
import { ManualPaymentForm } from "./payment/ManualPaymentForm";
import { DuesPaymentForm } from "./payment/DuesPaymentForm";
import { AdvancedSigningOptions } from "./payment/AdvancedSigningOptions";
import { HoldToSignButton } from "./payment/HoldToSignButton";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  defaultFundId: Id<"funds"> | null;
  initialMode?: "manual" | "dues";
  prefillUserId?: Id<"users"> | null;
  prefillDuesEventId?: Id<"duesEvents"> | null;
  prefillPeriodCount?: number;
  onSuccess?: () => void;
  onOpenKeyGen?: () => void;
}

const HOLD_DURATION_MS = 3000;

function formatPeriodsRange(periods: Array<{ periodLabel: string }>): string {
  if (periods.length === 0) return "";
  if (periods.length === 1) return periods[0].periodLabel;
  const first = periods[0].periodLabel;
  const last = periods[periods.length - 1].periodLabel;
  if (first === last) return first;
  return `${first} – ${last}`;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  organizationId,
  defaultFundId,
  initialMode = "manual",
  prefillUserId = null,
  prefillDuesEventId: _prefillDuesEventId = null,
  prefillPeriodCount = 1,
  onSuccess,
  onOpenKeyGen,
}: RecordPaymentModalProps) {
  const { t } = useTranslation();
  const convex = useConvex();
  const funds = useQuery(api.treasury.funds.list, { organizationId });
  const myKeys = useQuery(api.treasury.keys.getMyKeys, { organizationId });
  const members = useQuery(api.members.list, { organizationId });

  const [paymentMode, setPaymentMode] = useState<"manual" | "dues">(initialMode);
  const [selectedFundIdState, setSelectedFundIdState] = useState<Id<"funds"> | null>(
    defaultFundId ?? null
  );

  // Local keys present in IndexedDB on this browser/device
  const [localKeyIds, setLocalKeyIds] = useState<string[]>([]);
  const [isLoadingLocalKeys, setIsLoadingLocalKeys] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setSelectedFundIdState(defaultFundId ?? null);
      listStoredKeys()
        .then((stored) => {
          if (isMounted) {
            setLocalKeyIds(stored.map((s) => s.keyId));
            setIsLoadingLocalKeys(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setLocalKeyIds([]);
            setIsLoadingLocalKeys(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, defaultFundId]);

  // Active (non-revoked) keys belonging to current user
  const activeKeys = useMemo(
    () =>
      myKeys?.filter(
        (k: { keyId: string; label?: string; revokedAt?: number }) => !k.revokedAt
      ) ?? [],
    [myKeys]
  );
  const availableKeysOnDevice = useMemo(
    () => activeKeys.filter((k) => localKeyIds.includes(k.keyId)),
    [activeKeys, localKeyIds]
  );
  const otherDeviceKeys = useMemo(
    () => activeKeys.filter((k) => !localKeyIds.includes(k.keyId)),
    [activeKeys, localKeyIds]
  );

  // Derived effective fund and key IDs
  const selectedFundId = selectedFundIdState ?? defaultFundId ?? funds?.[0]?._id ?? null;

  // Manual payment state
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amountInput, setAmountInput] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  // Dues payment state
  const [manualDuesUserId, setManualDuesUserId] = useState<string>("");
  const duesUserId = prefillUserId ?? manualDuesUserId;

  const [duesPeriodCount, setDuesPeriodCount] = useState<number>(prefillPeriodCount);
  const [showDuesBreakdown, setShowDuesBreakdown] = useState<boolean>(false);
  const [customDuesMemo, setCustomDuesMemo] = useState<string>("");

  const [selectedKeyIdState, setSelectedKeyIdState] = useState<string>("");
  const selectedKeyId =
    (selectedKeyIdState && localKeyIds.includes(selectedKeyIdState) ? selectedKeyIdState : null) ||
    availableKeysOnDevice[0]?.keyId ||
    activeKeys[0]?.keyId ||
    "";

  const isKeyAvailableOnDevice = Boolean(selectedKeyId && localKeyIds.includes(selectedKeyId));

  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3-second hold to commit state
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdStartTimeRef = useRef<number | null>(null);

  const commitEntry = useMutation(api.treasury.ledger.commitEntry);
  const markDuesPaid = useMutation(api.treasury.dues.markDuesPaid);

  // Query unpaid periods for selected dues user in selected fund
  const unpaidPeriods = useQuery(
    api.treasury.dues.getMemberUnpaidPeriods,
    duesUserId && selectedFundId
      ? { organizationId, fundId: selectedFundId, userId: duesUserId as Id<"users"> }
      : "skip"
  );

  // Auto-update dues memo when user or periods change
  const selectedMember = members?.find((m) => m.userId === duesUserId);
  const selectedPeriodsToPay = unpaidPeriods?.slice(0, duesPeriodCount) ?? [];
  const duesCalculatedAmount = selectedPeriodsToPay.reduce((sum, p) => sum + p.amount, 0);

  const periodRangeLabel = formatPeriodsRange(selectedPeriodsToPay);
  const defaultDuesMemo =
    selectedMember && selectedPeriodsToPay.length > 0
      ? `Dues Payment (${selectedPeriodsToPay.length} cycle${selectedPeriodsToPay.length > 1 ? "s" : ""}: ${periodRangeLabel}) - ${selectedMember.nickname || selectedMember.name || "Member"}`
      : "";

  const effectiveDuesMemo = customDuesMemo || defaultDuesMemo;

  // Clean up animation frame timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) {
        cancelAnimationFrame(holdTimerRef.current);
      }
    };
  }, []);

  const isSubmitDisabled = Boolean(
    isSigning ||
    !selectedFundId ||
    !selectedKeyId ||
    !isKeyAvailableOnDevice ||
    (paymentMode === "manual" ? !amountInput || !memo.trim() : !duesUserId || duesCalculatedAmount <= 0)
  );

  const stopHold = () => {
    setIsHolding(false);
    setHoldProgress(0);
    holdStartTimeRef.current = null;
    if (holdTimerRef.current !== null) {
      cancelAnimationFrame(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const executeCommit = async () => {
    if (!selectedFundId || !selectedKeyId || isSubmitDisabled) return;

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
        fundId: selectedFundId,
      });

      const sequenceNumber = latestEntry.nextSequenceNumber;
      const previousHash = latestEntry.nextPreviousHash;

      if (paymentMode === "manual") {
        const parsedAmount = parseInt(amountInput.replace(/[^0-9]/g, ""), 10);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          setError("Amount must be a positive integer in smallest currency units.");
          setIsSigning(false);
          return;
        }

        if (!memo.trim()) {
          setError("Memo cannot be empty.");
          setIsSigning(false);
          return;
        }

        // 3. Construct signing payload and digitally sign via Web Crypto
        const payload: SigningPayload = {
          fundId: selectedFundId,
          sequenceNumber,
          previousHash,
          direction,
          amount: parsedAmount,
          memo: memo.trim(),
          keyId: selectedKeyId,
        };

        const { signature } = await signLedgerPayload(storedKey.privateKey, payload);

        // 4. Submit signed entry to Convex backend
        await commitEntry({
          fundId: selectedFundId,
          previousHash,
          direction,
          amount: parsedAmount,
          memo: memo.trim(),
          keyId: selectedKeyId,
          signature,
        });

        setAmountInput("");
        setMemo("");
      } else {
        // DUES PAYMENT MODE
        if (!duesUserId) {
          setError("Please select a member.");
          setIsSigning(false);
          return;
        }

        if (duesCalculatedAmount <= 0 || selectedPeriodsToPay.length === 0) {
          setError("Selected member has no outstanding periods to pay.");
          setIsSigning(false);
          return;
        }

        const finalDuesMemo = effectiveDuesMemo.trim() || `Dues Payment - ${selectedMember?.nickname || selectedMember?.name || "Member"}`;

        const payload: SigningPayload = {
          fundId: selectedFundId,
          sequenceNumber,
          previousHash,
          direction: "credit",
          amount: duesCalculatedAmount,
          memo: finalDuesMemo,
          keyId: selectedKeyId,
        };

        const { signature } = await signLedgerPayload(storedKey.privateKey, payload);

        await markDuesPaid({
          organizationId,
          userId: duesUserId as Id<"users">,
          fundId: selectedFundId,
          periodCount: duesPeriodCount,
          keyId: selectedKeyId,
          previousHash,
          signature,
          memo: finalDuesMemo,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to sign or commit ledger entry."
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
        void executeCommit();
      } else {
        holdTimerRef.current = requestAnimationFrame(update);
      }
    };

    holdTimerRef.current = requestAnimationFrame(update);
  };

  const currentFund = funds?.find((f) => f._id === selectedFundId);
  const currency = currentFund?.currency ?? "IDR";

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={paymentMode === "dues" ? t("treasury.dues.recordPayment", "Record Dues Payment") : t("treasury.ledger.recordEntry", "Record Ledger Entry")}
      description={
        paymentMode === "dues"
          ? "Cryptographically sign and credit member dues payment into the treasury."
          : "Digitally sign and commit an immutable treasury transaction."
      }
      maxWidth="lg"
    >
      <div className="pt-2 space-y-4">
        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/40 border border-border/70 rounded-[var(--fintech-radius-sm)]">
          <Button
            type="button"
            variant={paymentMode === "manual" ? "cyber" : "ghost"}
            chamfer="none"
            size="sm"
            onClick={() => {
              setPaymentMode("manual");
              setError(null);
            }}
            className={`text-xs flex items-center justify-center gap-2 cursor-pointer ${
              paymentMode === "manual" ? "" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            <span>Manual Entry</span>
          </Button>

          <Button
            type="button"
            variant={paymentMode === "dues" ? "cyber" : "ghost"}
            chamfer="none"
            size="sm"
            onClick={() => {
              setPaymentMode("dues");
              setError(null);
            }}
            className={`text-xs flex items-center justify-center gap-2 cursor-pointer ${
              paymentMode === "dues" ? "" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Dues Payment</span>
          </Button>
        </div>

        {activeKeys.length === 0 ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  No Approved Signing Key Available
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  You must generate a keypair on this device and have it approved by an administrator before you can sign ledger entries.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="none"
                onClick={onClose}
                size="sm"
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              {onOpenKeyGen && (
                <Button
                  type="button"
                  variant="cyber"
                  chamfer="none"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenKeyGen();
                  }}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Generate Keypair</span>
                </Button>
              )}
            </div>
          </div>
        ) : availableKeysOnDevice.length === 0 && !isLoadingLocalKeys ? (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">
                  No Signing Key Found on This Device
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  You have {activeKeys.length} approved key(s) registered in this organization, but their private keys are stored on another device or browser. Because private keys are non-extractable, you need to generate a keypair on this device to sign transactions here.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="none"
                onClick={onClose}
                size="sm"
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              {onOpenKeyGen && (
                <Button
                  type="button"
                  variant="cyber"
                  chamfer="none"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenKeyGen();
                  }}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Generate Keypair on This Device</span>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="space-y-4"
          >
            {paymentMode === "manual" ? (
              <ManualPaymentForm
                direction={direction}
                amountInput={amountInput}
                memo={memo}
                currency={currentFund?.currency ?? "Units"}
                isSigning={isSigning}
                onDirectionChange={setDirection}
                onAmountChange={setAmountInput}
                onMemoChange={setMemo}
              />
            ) : (
              <DuesPaymentForm
                members={members}
                duesUserId={duesUserId}
                unpaidPeriods={unpaidPeriods}
                duesPeriodCount={duesPeriodCount}
                showDuesBreakdown={showDuesBreakdown}
                effectiveDuesMemo={effectiveDuesMemo}
                defaultDuesMemo={defaultDuesMemo}
                currency={currency}
                duesCalculatedAmount={duesCalculatedAmount}
                selectedPeriodsToPay={selectedPeriodsToPay}
                periodRangeLabel={periodRangeLabel}
                isSigning={isSigning}
                onUserSelect={(userId) => {
                  setManualDuesUserId(userId);
                  setDuesPeriodCount(1);
                }}
                onPeriodCountChange={setDuesPeriodCount}
                onToggleBreakdown={() => setShowDuesBreakdown((prev) => !prev)}
                onCustomMemoChange={setCustomDuesMemo}
              />
            )}

            {/* Advanced Options Toggle */}
            <AdvancedSigningOptions
              funds={funds}
              selectedFundId={selectedFundId}
              defaultFundId={defaultFundId}
              currentFundName={currentFund?.name}
              selectedKeyId={selectedKeyId}
              availableKeysOnDevice={availableKeysOnDevice}
              otherDeviceKeys={otherDeviceKeys}
              isKeyAvailableOnDevice={isKeyAvailableOnDevice}
              isSigning={isSigning}
              showAdvanced={showAdvanced}
              onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
              onFundChange={setSelectedFundIdState}
              onKeyChange={setSelectedKeyIdState}
            />

            {error && (
              <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                {error}
              </div>
            )}

            <HoldToSignButton
              paymentMode={paymentMode}
              currency={currency}
              duesCalculatedAmount={duesCalculatedAmount}
              isSigning={isSigning}
              isHolding={isHolding}
              holdProgress={holdProgress}
              holdDurationMs={HOLD_DURATION_MS}
              isSubmitDisabled={isSubmitDisabled}
              cancelLabel={t("common.cancel")}
              onClose={onClose}
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              onPointerCancel={stopHold}
            />
          </form>
        )}
      </div>
    </ResponsiveDialog>
  );
}
