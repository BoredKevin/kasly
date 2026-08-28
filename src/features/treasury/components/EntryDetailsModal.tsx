import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
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
  X,
  Copy,
  Check,
  ShieldCheck,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  GitCommit,
  User,
  Clock,
  KeyRound,
} from "lucide-react";
import {
  parseRevertMemo,
  findReversalForEntry,
  findTargetEntry,
} from "../utils/revertUtils";

export interface LedgerEntryItem {
  _id: Id<"ledgerEntries">;
  _creationTime: number;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  sequenceNumber: number;
  previousHash: string;
  entryHash: string;
  timestamp: number;
  direction: string;
  amount: number;
  memo: string;
  keyId: string;
  signerId: Id<"users">;
  signerName?: string;
  signature: string;
  transferId?: string;
  entryType?: string;
  duesEventId?: Id<"duesEvents">;
}

interface EntryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntryItem | null;
  currency?: string;
  fundName?: string;
}

export function EntryDetailsModal({
  isOpen,
  onClose,
  entry,
  currency = "---",
  fundName = "Fund",
}: EntryDetailsModalProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fundEntries = useQuery(
    api.treasury.ledger.listEntries,
    isOpen && entry?.fundId ? { fundId: entry.fundId, limit: 200 } : "skip"
  );

  if (!isOpen || !entry || typeof document === "undefined") return null;

  const isCredit = entry.direction === "credit";
  const currentRevertInfo = parseRevertMemo(entry.memo);
  const targetEntry =
    currentRevertInfo.isRevert && currentRevertInfo.targetSequenceNumber
      ? findTargetEntry(currentRevertInfo.targetSequenceNumber, fundEntries)
      : null;
  const compensatingEntry = findReversalForEntry(entry.sequenceNumber, fundEntries);

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleNavigateToEntry = (hash: string) => {
    setLocation(`/tx/${hash}`);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl">
        <Card telemetry="TREASURY.ENTRY_DETAILS" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-3 border-b border-border/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <GitCommit className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <span>{t("treasury.ledger.entryNumber", { seq: entry.sequenceNumber })}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 ${isCredit
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-red-500/15 text-red-300 border-red-500/30"
                        }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-3 h-3" />
                      ) : (
                        <ArrowUpRight className="w-3 h-3" />
                      )}
                      <span>{isCredit ? t("treasury.ledger.credit") : t("treasury.ledger.debit")}</span>
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("treasury.ledger.proofInFund", { fundName })}
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

          <CardContent className="pt-4 max-h-[75vh] overflow-y-auto space-y-4 text-xs font-mono">
            {/* Quick Switcher: Compensating Reversal View */}
            {currentRevertInfo.isRevert && currentRevertInfo.targetSequenceNumber && (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2">
                    <div className="p-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0 mt-0.5 sm:mt-0">
                      <RotateCcw className="w-3 h-3" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300">
                          {t("treasury.ledger.reversalEntryBadge")}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono border-purple-500/40 text-purple-200">
                          #{entry.sequenceNumber} ➔ #{currentRevertInfo.targetSequenceNumber}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                        {t("treasury.ledger.reversalNotice", { seq: currentRevertInfo.targetSequenceNumber })}
                      </p>
                    </div>
                  </div>

                  {targetEntry && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="dual"
                      onClick={() => handleNavigateToEntry(targetEntry.entryHash)}
                      className="h-6 px-2 text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer bg-purple-500/15 border-purple-500/40 text-purple-200 hover:bg-purple-500/25 shrink-0"
                    >
                      <span>{t("treasury.ledger.goToRevertedEntry", { seq: currentRevertInfo.targetSequenceNumber })}</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </Button>
                  )}
                </div>

                {currentRevertInfo.reason && (
                  <div className="p-2 bg-background/50 border border-purple-500/20 text-[11px]">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground block">
                      {t("treasury.ledger.revertReasonLabel")}
                    </span>
                    <p className="text-foreground font-sans break-words">{currentRevertInfo.reason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Notice: Reverted Entry View */}
            {compensatingEntry && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/40 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start sm:items-center gap-2">
                    <div className="p-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 mt-0.5 sm:mt-0">
                      <AlertCircle className="w-3 h-3" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px] font-mono border-amber-500/40 text-amber-300">
                          {t("treasury.ledger.revertedByEntry", { seq: compensatingEntry.sequenceNumber })}
                        </Badge>
                      </div>` `
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => handleNavigateToEntry(compensatingEntry.entryHash)}
                    className="h-6 px-2 text-[11px] font-mono flex items-center justify-center gap-1 cursor-pointer bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 shrink-0"
                  >
                    <span>{t("treasury.ledger.goToReversalEntry", { seq: compensatingEntry.sequenceNumber })}</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Amount & Memo */}
            <div className="p-3.5 bg-background/60 border border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("treasury.ledger.transactionAmount")}
                </span>
                <span className="text-base font-bold text-foreground">
                  {currency} {entry.amount.toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-border/40 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("treasury.ledger.memo")}
                </span>
                <p className="text-foreground font-sans font-medium text-xs leading-relaxed break-words [overflow-wrap:anywhere]">
                  {entry.memo}
                </p>
              </div>
            </div>

            {/* Cryptographic SHA-256 Hashes */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {t("treasury.ledger.hashes")}
              </span>

              {/* Entry Hash */}
              <div className="p-3 bg-muted/20 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" /> {t("treasury.ledger.entryHash")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => handleCopy(entry.entryHash, "entryHash")}
                    className="h-6 px-2 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "entryHash" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{t("treasury.ledger.copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t("treasury.ledger.copyHash")}</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-primary break-all bg-black/30 p-2 border border-border/40">
                  {entry.entryHash}
                </p>
              </div>

              {/* Previous Hash */}
              <div className="p-3 bg-muted/20 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-semibold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" /> {t("treasury.ledger.prevHash")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => handleCopy(entry.previousHash, "prevHash")}
                    className="h-6 px-2 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "prevHash" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{t("treasury.ledger.copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t("treasury.ledger.copyHash")}</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground break-all bg-black/30 p-2 border border-border/40">
                  {entry.previousHash}
                </p>
              </div>
            </div>

            {/* Signer & Non-Repudiation Metadata */}
            <div className="space-y-2.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {t("treasury.keys.title")}
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" /> {t("treasury.ledger.signer")}
                  </span>
                  <p className="text-foreground font-semibold">
                    {entry.signerName || "Authorized Treasurer"}
                  </p>
                </div>

                <div className="p-2.5 bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-primary" /> {t("treasury.ledger.keyFingerprint")}
                  </span>
                  <p className="text-foreground font-semibold truncate" title={entry.keyId}>
                    {entry.keyId}
                  </p>
                </div>

                <div className="p-2.5 bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {t("treasury.ledger.timestamp")}
                  </span>
                  <p className="text-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="p-2.5 bg-muted/20 border border-border/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground">
                    {t("treasury.ledger.algorithm")}
                  </span>
                  <p className="text-foreground">
                    ECDSA P-256 SHA-256
                  </p>
                </div>
              </div>

              {/* Digital Signature */}
              <div className="p-3 bg-muted/20 border border-border/60 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-foreground font-semibold">
                    {t("treasury.ledger.signature")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => handleCopy(entry.signature, "sig")}
                    className="h-6 px-2 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "sig" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>{t("treasury.ledger.copied")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{t("treasury.ledger.copySig")}</span>
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground break-all bg-black/30 p-2 border border-border/40">
                  {entry.signature}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
