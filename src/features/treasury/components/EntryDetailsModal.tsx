import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
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
  GitCommit,
  User,
  Clock,
  KeyRound,
} from "lucide-react";

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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen || !entry || typeof document === "undefined") return null;

  const isCredit = entry.direction === "credit";

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
