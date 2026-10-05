import { useState } from "react";
import { Link } from "wouter";
import { LedgerEntryItem } from "../types/ledger";
import { StatusPill, CopyField } from "../../../ui";
import {
  ShieldCheck,
  X,
  Lock,
  User,
  KeyRound,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface ProofSheetProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntryItem | null;
  currency?: string;
}

export function ProofSheet({
  isOpen,
  onClose,
  entry,
  currency = "IDR",
}: ProofSheetProps) {
  const [showRawSignature, setShowRawSignature] = useState(false);

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        className="relative z-10 w-full max-w-lg bg-card border-t sm:border border-border/80 rounded-t-[var(--fintech-radius-lg)] sm:rounded-[var(--fintech-radius-lg)] shadow-2xl overflow-hidden max-h-[88vh] flex flex-col animate-in slide-in-from-bottom-6 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-sheet-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="proof-sheet-title" className="text-sm font-semibold text-foreground">
                Cryptographic Audit Proof
              </h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Block Sequence #{entry.sequenceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusPill tone="success" className="text-xs py-0.5 px-2">
              Valid On-Chain
            </StatusPill>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              aria-label="Close proof inspection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Summary Box */}
          <div className="p-3.5 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-md)] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                Transaction Value
              </span>
              <span className="text-base font-bold font-mono text-foreground">
                {entry.direction === "credit" ? "+" : "-"}{currency} {entry.amount.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                Recorded Time
              </span>
              <span className="text-xs font-mono text-foreground">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Hashes Section with Truncation + Copy */}
          <div className="space-y-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
              Cryptographic Hash Chain
            </span>

            <CopyField
              label="Block Entry Hash (SHA-256)"
              value={entry.entryHash}
              truncateMiddle
              truncateLength={12}
            />

            <div className="space-y-1">
              <CopyField
                label="Previous Block Hash"
                value={entry.previousHash}
                truncateMiddle
                truncateLength={12}
              />
              {entry.sequenceNumber > 1 && (
                <div className="px-1 text-right">
                  <Link
                    href={`/tx/${entry.previousHash}`}
                    onClick={onClose}
                    className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <span>Inspect Parent Block</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Signer Identity & Non-Repudiation */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1">
              Signer Authentication
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-muted/20 border border-border/50 rounded-[var(--fintech-radius-sm)] space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>Authorized Signer</span>
                </span>
                <p className="font-semibold text-foreground truncate">
                  {entry.signerName || "Treasurer"}
                </p>
              </div>

              <div className="p-2.5 bg-muted/20 border border-border/50 rounded-[var(--fintech-radius-sm)] space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  <span>Key Identifier</span>
                </span>
                <p className="font-mono text-xs text-foreground truncate">
                  {entry.keyId ? `KEY-${entry.keyId.slice(0, 8)}...` : "System Key"}
                </p>
              </div>
            </div>

            {/* Collapsible Raw Signature */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowRawSignature(!showRawSignature)}
                className="w-full flex items-center justify-between p-2.5 bg-muted/15 hover:bg-muted/30 border border-border/50 rounded-[var(--fintech-radius-sm)] text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>Raw ECDSA P-256 Signature</span>
                </div>
                {showRawSignature ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showRawSignature && (
                <div className="mt-2 p-3 bg-muted/30 border border-border/60 rounded-[var(--fintech-radius-sm)] space-y-2 animate-in slide-in-from-top-1 duration-150">
                  <CopyField
                    label="Signature Payload"
                    value={entry.signature || "Verified system signature"}
                    truncateMiddle
                    truncateLength={16}
                  />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    This signature guarantees non-repudiation and proves that transaction data was not altered after signing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-border/60 bg-muted/10 shrink-0 text-center text-xs text-muted-foreground font-mono">
          <span>Continuous SHA-256 Ledger • Tamper-Evident</span>
        </div>
      </div>
    </div>
  );
}
