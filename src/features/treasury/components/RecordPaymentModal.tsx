import { useState } from "react";
import { useMutation, useQuery, useConvex } from "convex/react";
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
} from "lucide-react";
import { loadKeypair, signLedgerPayload, SigningPayload } from "../../../lib/treasury-crypto";

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  defaultFundId: Id<"funds"> | null;
  onSuccess?: () => void;
  onOpenKeyGen?: () => void;
}

export function RecordPaymentModal({
  isOpen,
  onClose,
  organizationId,
  defaultFundId,
  onSuccess,
  onOpenKeyGen,
}: RecordPaymentModalProps) {
  const convex = useConvex();
  const funds = useQuery(api.treasury.funds.list, { organizationId });
  const myKeys = useQuery(api.treasury.keys.getMyKeys, { organizationId });

  const [selectedFundId, setSelectedFundId] = useState<Id<"funds"> | null>(
    defaultFundId ?? null
  );
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amountInput, setAmountInput] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commitEntry = useMutation(api.treasury.ledger.commitEntry);

  // Active (non-revoked) keys belonging to current user
  const activeKeys = myKeys?.filter((k) => !k.revokedAt) ?? [];

  // Automatically select first active key if none is selected
  if (activeKeys.length > 0 && !selectedKeyId) {
    setSelectedKeyId(activeKeys[0].keyId);
  }

  // Automatically sync fund if defaultFundId changes and none selected
  if (!selectedFundId && defaultFundId) {
    setSelectedFundId(defaultFundId);
  } else if (!selectedFundId && funds && funds.length > 0) {
    setSelectedFundId(funds[0]._id);
  }

  if (!isOpen) return null;

  const currentFund = funds?.find((f) => f._id === selectedFundId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId || !amountInput || !memo.trim() || !selectedKeyId) return;

    const parsedAmount = parseInt(amountInput.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive integer in smallest currency units.");
      return;
    }

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg">
        <Card telemetry="TREASURY.RECORD" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <PenLine className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Record Ledger Payment
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Digitally sign and commit an immutable treasury transaction
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
                  void handleSubmit(e);
                }}
                className="space-y-4"
              >
                {/* Transaction Direction Toggle */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Transaction Direction *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection("credit")}
                      className={`p-2.5 border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${direction === "credit"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                        }`}
                    >
                      <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                      <span>Credit (Income)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("debit")}
                      className={`p-2.5 border text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${direction === "debit"
                          ? "bg-red-500/20 border-red-500 text-red-300 shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                        }`}
                    >
                      <ArrowUpRight className="w-4 h-4 text-red-400" />
                      <span>Debit (Expense)</span>
                    </button>
                  </div>
                </div>

                {/* Target Fund Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Target Fund *
                  </label>
                  {funds && funds.length > 0 ? (
                    <select
                      value={selectedFundId ?? ""}
                      onChange={(e) => setSelectedFundId(e.target.value as Id<"funds">)}
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
                      // Allow only numbers
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
                    placeholder="e.g. Monthly dues payment - Kevin"
                    value={memo}
                    disabled={isSigning}
                    onChange={(e) => setMemo(e.target.value)}
                    chamfer="dual"
                    required
                  />
                </div>

                {/* Signing Key Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground flex items-center justify-between">
                    <span>Signing Key *</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      Browser-bound P-256
                    </span>
                  </label>
                  <select
                    value={selectedKeyId}
                    onChange={(e) => setSelectedKeyId(e.target.value)}
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

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    chamfer="dual"
                    onClick={onClose}
                    disabled={isSigning}
                    size="sm"
                    className="text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    disabled={
                      isSigning ||
                      !selectedFundId ||
                      !amountInput ||
                      !memo.trim() ||
                      !selectedKeyId
                    }
                    className="text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSigning ? (
                      <span>Signing & Committing...</span>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Sign & Commit Entry</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
