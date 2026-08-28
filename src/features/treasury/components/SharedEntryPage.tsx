import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
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
  GitCommit,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Lock,
  User,
  Clock,
  KeyRound,
  Copy,
  Check,
  Share2,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  LogIn,
  AlertTriangle,
  AlertCircle,
  FileQuestion,
} from "lucide-react";
import { ShareEntryModal } from "./ShareEntryModal";
import { RevertEntryModal, TargetLedgerEntry } from "./RevertEntryModal";
import {
  parseRevertMemo,
  findReversalForEntry,
  findTargetEntry,
} from "../utils/revertUtils";

interface SharedEntryPageProps {
  identifier: string;
  isAuthenticated?: boolean;
}

export function SharedEntryPage({
  identifier,
  isAuthenticated = false,
}: SharedEntryPageProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedEntryForRevert, setSelectedEntryForRevert] = useState<TargetLedgerEntry | null>(null);

  const entryResult = useQuery(api.treasury.ledger.getPublicEntry, {
    identifier,
  });

  const entryOrgId =
    entryResult?.status === "success" ? entryResult.entry.organizationId : undefined;

  const fundEntries = useQuery(
    api.treasury.ledger.listEntries,
    entryResult?.status === "success" && isAuthenticated
      ? { fundId: entryResult.entry.fundId, limit: 200 }
      : "skip"
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    entryOrgId && isAuthenticated ? { organizationId: entryOrgId } : "skip"
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  const handleCopy = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Loading State
  if (entryResult === undefined) {
    return (
      <div className="w-full max-w-xl mx-auto py-12 flex flex-col items-center justify-center space-y-4">
        <div className="p-3 bg-primary/10 border border-primary/20 text-primary animate-pulse">
          <GitCommit className="w-6 h-6" />
        </div>
        <div className="text-xs font-mono text-muted-foreground animate-pulse">
          Loading cryptographic ledger proof...
        </div>
      </div>
    );
  }

  // Not Found State
  if (entryResult.status === "not_found") {
    return (
      <div className="w-full max-w-xl mx-auto py-8">
        <Card telemetry="TREASURY.ENTRY_NOT_FOUND" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-3 border-b border-border/80 text-center">
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 w-fit mx-auto mb-2">
              <FileQuestion className="w-6 h-6" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              {t("treasury.ledger.entryNotFound")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("treasury.ledger.entryNotFoundDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              chamfer="dual"
              onClick={() => setLocation(isAuthenticated ? "/treasury/ledger" : "/")}
              className="cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{isAuthenticated ? t("treasury.ledger.backToLedger") : t("treasury.ledger.backToWorkspace")}</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Unauthenticated / Restricted State (When public receipts setting is disabled)
  if (entryResult.status === "unauthenticated") {
    return (
      <div className="w-full max-w-xl mx-auto py-8">
        <Card telemetry="TREASURY.ENTRY_RESTRICTED" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-3 border-b border-border/80">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <span>{t("treasury.ledger.restrictedReceipt")}</span>
                  {entryResult.entrySnippet && (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      #{entryResult.entrySnippet.sequenceNumber}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {entryResult.entrySnippet?.fundName} • {entryResult.entrySnippet?.organizationName}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-xs font-mono">
            <p className="font-sans text-muted-foreground text-xs leading-relaxed">
              {t("treasury.ledger.restrictedReceiptDesc")}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <Button
                variant="default"
                size="sm"
                chamfer="dual"
                onClick={() => setLocation(`/profile`)}
                className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{t("treasury.ledger.signInToView")}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setLocation("/")}
                className="w-full sm:w-auto cursor-pointer"
              >
                <span>{t("treasury.ledger.backToWorkspace")}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Forbidden State (Logged in but lacks permissions)
  if (entryResult.status === "forbidden") {
    return (
      <div className="w-full max-w-xl mx-auto py-8">
        <Card telemetry="TREASURY.ENTRY_FORBIDDEN" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-3 border-b border-border/80 text-center">
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 w-fit mx-auto mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <CardTitle className="text-base font-semibold text-foreground">
              {t("treasury.ledger.accessDeniedTitle")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("treasury.ledger.accessDeniedDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              chamfer="dual"
              onClick={() => setLocation(isAuthenticated ? "/treasury" : "/")}
              className="cursor-pointer flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t("treasury.ledger.backToWorkspace")}</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (entryResult.status !== "success") {
    return null;
  }

  const entry = entryResult.entry;
  const isCredit = entry.direction === "credit";
  const currentRevertInfo = parseRevertMemo(entry.memo);
  const targetEntry =
    currentRevertInfo.isRevert && currentRevertInfo.targetSequenceNumber
      ? findTargetEntry(currentRevertInfo.targetSequenceNumber, fundEntries)
      : null;
  const compensatingEntry = findReversalForEntry(entry.sequenceNumber, fundEntries);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4 animate-in fade-in duration-200">
      {/* Optional Back to Ledger Button when authenticated */}
      {isAuthenticated && (
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            chamfer="dual"
            onClick={() => setLocation("/treasury/ledger")}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer font-mono"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("treasury.ledger.backToLedger")}</span>
          </Button>

          <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
            {entry.organizationName}
          </Badge>
        </div>
      )}

      {/* Main Cryptographic Ledger Entry Card */}
      <Card
        telemetry="TREASURY.ENTRY_DETAILS"
        cornerLines
        className="bg-card border-border shadow-2xl"
      >
        {/* Header with Title, Credit/Debit Badge, and Share Entry Button */}
        <CardHeader className="pb-3 border-b border-border/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary shrink-0">
                <GitCommit className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                  <span>{t("treasury.ledger.entryNumber", { seq: entry.sequenceNumber })}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 ${isCredit
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
                <CardDescription className="text-xs truncate">
                  {t("treasury.ledger.proofInFund", { fundName: entry.fundName })}
                </CardDescription>
              </div>
            </div>

            {/* Action Buttons: Revert (if permitted) & Share Entry */}
            <div className="flex items-center gap-2 shrink-0">
              {canSign && isAuthenticated && !compensatingEntry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() =>
                    setSelectedEntryForRevert({
                      _id: entry._id,
                      fundId: entry.fundId,
                      sequenceNumber: entry.sequenceNumber,
                      direction: entry.direction,
                      amount: entry.amount,
                      memo: entry.memo,
                      keyId: entry.keyId,
                      duesEventId: entry.duesEventId,
                    })
                  }
                  className="h-8 px-2.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer text-foreground hover:text-amber-300 hover:border-amber-500/40 transition-colors"
                  title={t("treasury.ledger.revertEntry")}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("treasury.ledger.revert")}</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setIsShareModalOpen(true)}
                className="h-8 px-2.5 text-xs font-mono flex items-center gap-1.5 cursor-pointer bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:text-primary transition-colors"
                title={t("treasury.ledger.shareEntry")}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("treasury.ledger.shareEntry")}</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Content Section */}
        <CardContent className="pt-4 space-y-4 text-xs font-mono">
          {/* Quick Switcher: Compensating Reversal View */}
          {currentRevertInfo.isRevert && currentRevertInfo.targetSequenceNumber && (
            <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2">
                  <div className="p-1 bg-purple-500/20 text-purple-300 border border-purple-500/40 shrink-0 mt-0.5 sm:mt-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-300">
                        {t("treasury.ledger.reversalEntryBadge")}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono border-purple-500/40 text-purple-200">
                        #{entry.sequenceNumber} ➔ #{currentRevertInfo.targetSequenceNumber}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-sans mt-0.5">
                      {t("treasury.ledger.reversalNotice", { seq: currentRevertInfo.targetSequenceNumber })}
                    </p>
                  </div>
                </div>

                {targetEntry ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => setLocation(`/tx/${targetEntry.entryHash}`)}
                    className="h-7 px-3 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer bg-purple-500/15 border-purple-500/40 text-purple-200 hover:bg-purple-500/25 hover:text-purple-100 shrink-0 self-start sm:self-auto"
                  >
                    <span>{t("treasury.ledger.goToRevertedEntry", { seq: currentRevertInfo.targetSequenceNumber })}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={!fundEntries}
                    onClick={() => {
                      if (targetEntry) {
                        setLocation(`/tx/${targetEntry.entryHash}`);
                      }
                    }}
                    className="h-7 px-3 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer bg-purple-500/10 border-purple-500/20 text-purple-300/70 shrink-0 self-start sm:self-auto"
                  >
                    <span>{t("treasury.ledger.goToRevertedEntry", { seq: currentRevertInfo.targetSequenceNumber })}</span>
                  </Button>
                )}
              </div>

              {/* Revert Reason & Target Entry Snippet */}
              <div className="pt-2 border-t border-purple-500/20 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {currentRevertInfo.reason && (
                  <div className="p-2 bg-background/50 border border-purple-500/20 space-y-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      {t("treasury.ledger.revertReasonLabel")}
                    </span>
                    <p className="text-foreground font-sans break-words text-xs">
                      {currentRevertInfo.reason}
                    </p>
                  </div>
                )}

                {targetEntry && (
                  <div className="p-2 bg-background/50 border border-purple-500/20 space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      <span>{t("treasury.ledger.originalTransaction")}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-mono px-1 py-0 ${targetEntry.direction === "credit"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : "bg-red-500/15 text-red-300 border-red-500/30"
                          }`}
                      >
                        {targetEntry.direction.toUpperCase()} {entry.currency} {targetEntry.amount.toLocaleString()}
                      </Badge>
                    </div>
                    <p className="text-foreground font-sans truncate text-xs" title={targetEntry.memo}>
                      {targetEntry.memo}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Notice: Reverted Entry View */}
          {compensatingEntry && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/40 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2">
                  <div className="p-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0 mt-0.5 sm:mt-0">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-300">
                        {t("treasury.ledger.revertedByEntry", { seq: compensatingEntry.sequenceNumber })}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setLocation(`/tx/${compensatingEntry.entryHash}`)}
                  className="h-7 px-3 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25 hover:text-amber-200 shrink-0 self-start sm:self-auto"
                >
                  <span>{t("treasury.ledger.goToReversalEntry", { seq: compensatingEntry.sequenceNumber })}</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>

              {compensatingEntry.revertReason && (
                <div className="p-2 bg-background/50 border border-amber-500/20 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    {t("treasury.ledger.revertReasonLabel")}
                  </span>
                  <p className="text-foreground font-sans break-words text-xs">
                    {compensatingEntry.revertReason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Amount & Memo */}
          <div className="p-3.5 bg-background/60 border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {t("treasury.ledger.transactionAmount")}
              </span>
              <span className="text-base font-bold text-foreground font-mono">
                {entry.currency} {entry.amount.toLocaleString()}
              </span>
            </div>
            <div className="pt-2 border-t border-border/40 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {t("treasury.ledger.memo")}
                </span>
                {entry.duesPeriodLabel && (
                  <Badge variant="secondary" className="text-[9px] font-mono">
                    {entry.duesPeriodLabel}
                  </Badge>
                )}
              </div>
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
              <p className="text-[11px] text-primary break-all bg-black/30 p-2 border border-border/40 select-all">
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
              <p className="text-[11px] text-muted-foreground break-all bg-black/30 p-2 border border-border/40 select-all">
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
                <p className="text-foreground font-semibold truncate font-mono" title={entry.keyId}>
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
                <p className="text-foreground font-mono">
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
              <p className="text-[10px] text-muted-foreground break-all bg-black/30 p-2 border border-border/40 select-all font-mono">
                {entry.signature}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Share Modal */}
      <ShareEntryModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        entryHash={entry.entryHash}
        sequenceNumber={entry.sequenceNumber}
        fundName={entry.fundName}
        currency={entry.currency}
        amount={entry.amount}
        isPublic={entryResult.isPublic}
      />

      {/* Revert Entry Modal */}
      {canSign && isAuthenticated && selectedEntryForRevert && (
        <RevertEntryModal
          isOpen={Boolean(selectedEntryForRevert)}
          onClose={() => setSelectedEntryForRevert(null)}
          organizationId={entry.organizationId}
          entry={selectedEntryForRevert}
          currency={entry.currency}
        />
      )}
    </div>
  );
}
