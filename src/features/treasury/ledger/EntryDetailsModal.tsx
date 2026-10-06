import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { LedgerEntryItem } from "../types/ledger";
import { parseRevertMemo, findTargetEntry, findReversalForEntry } from "../lib/revertUtils";
import { Button } from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { useFormat } from "../../../hooks/useFormat";
import { ProofSheet } from "./ProofSheet";
import {
  ShieldCheck,
  RotateCcw,
  User,
  ArrowRight,
  Calendar,
  Layers,
} from "lucide-react";

export interface EntryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntryItem | null;
  currency?: string;
  fundName?: string;
  entriesList?: LedgerEntryItem[];
  canRevert?: boolean;
  onRevert?: (entry: LedgerEntryItem) => void;
}

export function EntryDetailsModal({
  isOpen,
  onClose,
  entry,
  currency = "IDR",
  fundName = "Fund",
  entriesList = [],
  canRevert = false,
  onRevert,
}: EntryDetailsModalProps) {
  const { t } = useTranslation();
  const { money: formatMoney } = useFormat();
  const [, setLocation] = useLocation();
  const [isProofOpen, setIsProofOpen] = useState(false);

  if (!isOpen || !entry) return null;

  const isCredit = entry.direction === "credit";
  const currentRevertInfo = parseRevertMemo(entry.memo);
  const targetRevertedEntry =
    currentRevertInfo.isRevert && currentRevertInfo.targetSequenceNumber
      ? findTargetEntry(currentRevertInfo.targetSequenceNumber, entriesList)
      : null;
  const compensatingEntry = findReversalForEntry(entry.sequenceNumber, entriesList);

  const handleNavigateToEntry = (hash: string) => {
    setLocation(`/tx/${hash}`);
    onClose();
  };

  return (
    <>
      <ResponsiveDialog
        isOpen={isOpen}
        onClose={onClose}
        title={t("treasury.ledger.entryNumber", "Entri #{{seq}}", { seq: entry.sequenceNumber })}
        description={`${fundName} • ${isCredit ? t("treasury.ledger.credit", "Kredit") : t("treasury.ledger.debit", "Debit")}`}
        maxWidth="md"
      >
        <div className="space-y-4 pt-1">
          {/* Financial Amount Banner */}
          <div className="p-4 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-md)] space-y-1 text-center">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              {t("treasury.ledger.amount", "Jumlah")}
            </span>
            <div
              className={`text-2xl sm:text-3xl font-bold font-sans tabular-nums tracking-tight ${
                isCredit ? "text-emerald-400" : "text-foreground"
              }`}
            >
              {isCredit ? "+" : "−"}{formatMoney(entry.amount, currency)}
            </div>
          </div>

          {/* Memo & Purpose */}
          <div className="p-3.5 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-md)] space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
              Memo / Note
            </span>
            <p className="text-xs font-medium text-foreground leading-relaxed">
              {entry.memo}
            </p>
          </div>

          {/* Reversal Notifications if applicable */}
          {currentRevertInfo.isRevert && currentRevertInfo.targetSequenceNumber && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/25 rounded-[var(--fintech-radius-md)] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-purple-300">
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Reverses Entry #{currentRevertInfo.targetSequenceNumber}</span>
              </div>
              {targetRevertedEntry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  onClick={() => handleNavigateToEntry(targetRevertedEntry.entryHash)}
                  className="h-7 text-xs px-2 flex items-center gap-1 cursor-pointer"
                >
                  <span>View Target</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          )}

          {compensatingEntry && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-[var(--fintech-radius-md)] flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-amber-300">
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>Reverted by Entry #{compensatingEntry.sequenceNumber}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                onClick={() => handleNavigateToEntry(compensatingEntry.entryHash)}
                className="h-7 text-xs px-2 flex items-center gap-1 cursor-pointer"
              >
                <span>View Reversal</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Transaction Context */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-sm)] space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Timestamp</span>
              </span>
              <p className="font-mono text-[11px] text-foreground">
                {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </div>

            <div className="p-2.5 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-sm)] space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                <span>Signer</span>
              </span>
              <p className="text-xs font-semibold text-foreground truncate">
                {entry.signerName || "Authorized Signer"}
              </p>
            </div>
          </div>

          {/* Cryptographic Proof Trigger Card */}
          <div className="p-3.5 bg-muted/20 border border-border/70 rounded-[var(--fintech-radius-md)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 text-primary shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block">
                  Cryptographic Audit Details
                </span>
                <span className="text-[11px] text-muted-foreground font-mono truncate block">
                  SHA-256 Hash • Chain • Signature
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={() => setIsProofOpen(true)}
              className="h-8 text-xs shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Inspect Proof</span>
            </Button>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                chamfer="none"
                className="h-8 text-xs cursor-pointer"
              >
                <Link href={`/tx/${entry.entryHash}`}>
                  <span>Direct URL</span>
                </Link>
              </Button>

              {canRevert && onRevert && !compensatingEntry && !currentRevertInfo.isRevert && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  onClick={() => {
                    onClose();
                    onRevert(entry);
                  }}
                  className="h-8 text-xs text-amber-400 hover:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t("treasury.ledger.reversal", "Batalkan")}</span>
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              chamfer="none"
              onClick={onClose}
              className="h-8 text-xs cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t("common.done", "Selesai")}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Proof Slide-over */}
      <ProofSheet
        isOpen={isProofOpen}
        onClose={() => setIsProofOpen(false)}
        entry={entry}
        currency={currency}
      />
    </>
  );
}
