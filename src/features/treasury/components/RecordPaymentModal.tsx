import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useConvex } from "convex/react";
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
} from "@boredkevin/ui";
import {
  PenLine,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  KeyRound,
  ShieldAlert,
  Lock,
  CalendarDays,
  CheckCircle2,
  Minus,
  Plus,
  Sparkles,
} from "lucide-react";
import { loadKeypair, signLedgerPayload, SigningPayload } from "../../../lib/treasury-crypto";
import { MemberSearchSelect } from "./MemberSearchSelect";

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

const HOLD_DURATION_MS = 5000;

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

  // Active (non-revoked) keys belonging to current user
  const activeKeys = myKeys?.filter((k) => !k.revokedAt) ?? [];

  // Derived effective fund and key IDs
  const selectedFundId = selectedFundIdState ?? defaultFundId ?? funds?.[0]?._id ?? null;

  // Manual payment state
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amountInput, setAmountInput] = useState<string>("");
  const [memo, setMemo] = useState<string>("");

  // Dues payment state
  const [duesUserId, setDuesUserId] = useState<string>(prefillUserId ?? "");
  const [duesPeriodCount, setDuesPeriodCount] = useState<number>(prefillPeriodCount);
  const [customDuesMemo, setCustomDuesMemo] = useState<string>("");

  const [selectedKeyIdState, setSelectedKeyIdState] = useState<string>("");
  const selectedKeyId = selectedKeyIdState || activeKeys[0]?.keyId || "";

  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 5-second hold to commit state
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

  // Sync prefilled state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (prefillUserId) {
        setDuesUserId(prefillUserId);
        setPaymentMode("dues");
      }
      if (prefillPeriodCount) {
        setDuesPeriodCount(prefillPeriodCount);
      }
    }
  }, [isOpen, prefillUserId, prefillPeriodCount]);

  const isSubmitDisabled = Boolean(
    isSigning ||
    !selectedFundId ||
    !selectedKeyId ||
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

  if (!isOpen || typeof document === "undefined") return null;

  const currentFund = funds?.find((f) => f._id === selectedFundId);

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg">
        <Card telemetry="TREASURY.RECORD" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  {paymentMode === "dues" ? (
                    <CalendarDays className="w-5 h-5" />
                  ) : (
                    <PenLine className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {paymentMode === "dues" ? t("treasury.dues.recordPayment") : t("treasury.ledger.recordEntry")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {paymentMode === "dues"
                      ? "Cryptographically sign and credit member dues payment into the treasury"
                      : "Digitally sign and commit an immutable treasury transaction"}
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
          </CardHeader>

          <CardContent className="pt-5">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-muted/40 border border-border/80">
              <Button
                type="button"
                variant={paymentMode === "manual" ? "cyber" : "ghost"}
                chamfer="dual"
                size="sm"
                onClick={() => {
                  setPaymentMode("manual");
                  setError(null);
                }}
                className={`text-xs flex items-center justify-center gap-2 cursor-pointer ${paymentMode === "manual"
                  ? ""
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Manual Entry</span>
              </Button>

              <Button
                type="button"
                variant={paymentMode === "dues" ? "cyber" : "ghost"}
                chamfer="dual"
                size="sm"
                onClick={() => {
                  setPaymentMode("dues");
                  setError(null);
                }}
                className={`text-xs flex items-center justify-center gap-2 cursor-pointer ${paymentMode === "dues"
                  ? ""
                  : "text-muted-foreground hover:text-foreground"
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
                    chamfer="dual"
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
                      chamfer="dual"
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
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                }}
                className="space-y-4"
              >
                {paymentMode === "manual" ? (
                  <>
                    {/* Transaction Direction Selector Tab */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Transaction Direction *
                      </label>
                      <div className="grid grid-cols-2 gap-1 p-1 bg-muted/40 border border-border/80">
                        <Button
                          type="button"
                          variant={direction === "credit" ? "cyber" : "ghost"}
                          chamfer="dual"
                          size="sm"
                          onClick={() => setDirection("credit")}
                          className={`h-8 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${direction === "credit"
                            ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/70 shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                            }`}
                        >
                          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                          <span>Credit (Income)</span>
                        </Button>
                        <Button
                          type="button"
                          variant={direction === "debit" ? "cyber" : "ghost"}
                          chamfer="dual"
                          size="sm"
                          onClick={() => setDirection("debit")}
                          className={`h-8 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${direction === "debit"
                            ? "bg-red-500/25 text-red-300 border border-red-500/70 shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                            }`}
                        >
                          <ArrowUpRight className="w-4 h-4 text-red-400" />
                          <span>Debit (Expense)</span>
                        </Button>
                      </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">
                          Amount ({currentFund?.currency ?? "Units"}) *
                        </label>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Smallest Integer Units
                        </span>
                      </div>
                      <Input
                        type="text"
                        placeholder="e.g. 500000"
                        value={amountInput}
                        disabled={isSigning}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setAmountInput(val);
                        }}
                        chamfer="dual"
                        required
                      />
                      {amountInput && (
                        <p className="text-[11px] font-mono text-primary">
                          Formatted: {currentFund?.currency} {parseInt(amountInput, 10).toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* Memo */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Memo / Description *
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Operating expense / grant receipt"
                        value={memo}
                        disabled={isSigning}
                        onChange={(e) => setMemo(e.target.value)}
                        chamfer="dual"
                        required
                      />
                    </div>
                  </>
                ) : (
                  /* DUES PAYMENT MODE FORM */
                  <>
                    {/* Member Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Select Member *
                      </label>
                      <MemberSearchSelect
                        members={members}
                        value={duesUserId}
                        onChange={(userId) => {
                          setDuesUserId(userId);
                          setDuesPeriodCount(1);
                        }}
                        disabled={isSigning}
                        placeholder="Search member by nickname, name, or email..."
                      />
                    </div>

                    {/* Dues Periods & Amount Calculation */}
                    {duesUserId && (
                      <div className="space-y-3 p-3 bg-muted/20 border border-border/80 rounded">
                        {unpaidPeriods === undefined ? (
                          <div className="py-2 text-xs font-mono text-muted-foreground animate-pulse">
                            Loading unpaid dues cycles...
                          </div>
                        ) : unpaidPeriods.length === 0 ? (
                          <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono py-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>This member has no outstanding dues! All periods are paid.</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium text-foreground">
                                Number of Periods to Pay
                              </label>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                Max available: {unpaidPeriods.length} cycle(s)
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1">
                              <span className="text-xs text-muted-foreground">
                                Cycles to pay:
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  chamfer="dual"
                                  disabled={isSigning || duesPeriodCount <= 1}
                                  onClick={() => setDuesPeriodCount((prev) => Math.max(1, prev - 1))}
                                  className="h-8 w-8 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40"
                                  title="Decrease periods"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </Button>

                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={duesPeriodCount}
                                  disabled={isSigning}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    if (!raw) {
                                      setDuesPeriodCount(1);
                                      return;
                                    }
                                    const val = parseInt(raw, 10);
                                    setDuesPeriodCount(Math.min(unpaidPeriods.length, Math.max(1, val)));
                                  }}
                                  className="h-8 w-8 p-0 text-center font-mono font-bold text-sm bg-background border border-border text-primary focus:outline-none focus:border-primary shrink-0"
                                />

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  chamfer="dual"
                                  disabled={isSigning || duesPeriodCount >= unpaidPeriods.length}
                                  onClick={() => setDuesPeriodCount((prev) => Math.min(unpaidPeriods.length, prev + 1))}
                                  className="h-8 w-8 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-40"
                                  title="Increase periods"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Covered cycles preview */}
                            <div className="pt-2 border-t border-border/60 space-y-1 text-xs font-mono">
                              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                                <span>Covered Cycle(s):</span>
                                <span className="text-foreground font-semibold">
                                  {formatPeriodsRange(selectedPeriodsToPay)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-muted-foreground text-[11px] pt-1">
                                <span>Calculated Total Credit:</span>
                                <span className="text-emerald-400 font-bold text-sm">
                                  {currentFund?.currency ?? "IDR"} {duesCalculatedAmount.toLocaleString("id-ID")}
                                </span>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Dues Memo Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Ledger Memo *
                      </label>
                      <Input
                        type="text"
                        value={effectiveDuesMemo}
                        placeholder={defaultDuesMemo || "e.g. Member Dues Payment"}
                        disabled={isSigning}
                        onChange={(e) => setCustomDuesMemo(e.target.value)}
                        chamfer="dual"
                        required
                      />
                    </div>
                  </>
                )}

                {/* Target Destination Fund Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Destination Fund *
                  </label>
                  {funds && funds.length > 0 ? (
                    <select
                      value={selectedFundId ?? ""}
                      onChange={(e) => setSelectedFundIdState(e.target.value as Id<"funds">)}
                      disabled={isSigning}
                      className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                      required
                    >
                      {funds.map((fund) => (
                        <option key={fund._id} value={fund._id}>
                          {fund.name} ({fund.currency})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-1">
                      No active funds available.
                    </div>
                  )}
                </div>

                {/* Signing Key Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Treasurer Signing Key *</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Browser ECDSA P-256
                    </span>
                  </label>
                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyIdState(e.target.value)}
                    disabled={isSigning}
                    className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    required
                  >
                    {activeKeys.map((k) => (
                      <option key={k.keyId} value={k.keyId}>
                        {k.label ? `${k.label} (${k.keyId.slice(0, 10)}...)` : `Key (${k.keyId.slice(0, 10)}...)`}
                      </option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                    {error}
                  </div>
                )}

                <div className="pt-3 border-t border-border space-y-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      chamfer="dual"
                      onClick={onClose}
                      disabled={isSigning || isHolding}
                      size="sm"
                      className="text-xs cursor-pointer"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="cyber"
                      chamfer="dual"
                      size="sm"
                      disabled={isSubmitDisabled}
                      onPointerDown={startHold}
                      onPointerUp={stopHold}
                      onPointerLeave={stopHold}
                      onPointerCancel={stopHold}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`relative overflow-hidden text-xs flex items-center justify-center gap-1.5 cursor-pointer select-none px-4 py-2 min-w-[220px] transition-all ${isHolding ? "border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.3)]" : ""
                        }`}
                    >
                      {/* 5-second Hold Progress Fill */}
                      {isHolding && (
                        <div
                          className="absolute inset-0 bg-emerald-500/35 pointer-events-none transition-none"
                          style={{
                            width: `${Math.min(100, holdProgress * 100)}%`,
                          }}
                        />
                      )}

                      <span className="relative z-10 flex items-center gap-1.5 font-mono">
                        {isSigning ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            <span>Signing & Committing...</span>
                          </>
                        ) : isHolding ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span>
                              Hold to Sign: {((HOLD_DURATION_MS * (1 - holdProgress)) / 1000).toFixed(1)}s
                            </span>
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            <span>
                              {paymentMode === "dues"
                                ? `Hold 5s to Sign (${currentFund?.currency ?? "IDR"} ${duesCalculatedAmount.toLocaleString("id-ID")})`
                                : "Hold 5s to Sign & Commit"}
                            </span>
                          </>
                        )}
                      </span>
                    </Button>
                  </div>
                  {!isSubmitDisabled && !isSigning && (
                    <p className="text-[10px] font-mono text-muted-foreground text-right">
                      ⚠️You cannot undo this action!
                    </p>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
