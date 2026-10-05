import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@boredkevin/ui";
import { StatusPill, EmptyState } from "../../../ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { RevertEntryModal, TargetLedgerEntry } from "../components/RevertEntryModal";
import { LedgerEntryItem } from "../types/ledger";
import { parseRevertMemo, findTargetEntry, findReversalForEntry } from "../lib/revertUtils";
import { EntryDetailsModal } from "./EntryDetailsModal";
import { ProofSheet } from "./ProofSheet";

export interface LedgerTimelineProps {
  fundId: Id<"funds"> | null;
  organizationId?: Id<"organizations">;
  limit?: number;
  pageSize?: number;
  showPagination?: boolean;
  onOpenRecordPayment?: () => void;
  onOpenKeyGen?: () => void;
  emptyMessage?: string;
  variant?: "standard" | "compact";
}

interface DateGroup {
  dateLabel: string;
  dateKey: string;
  entries: LedgerEntryItem[];
}

function groupEntriesByDate(entries: LedgerEntryItem[], locale: string): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dateLabel = d.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      group = { dateKey, dateLabel, entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

export function LedgerTimeline({
  fundId,
  organizationId,
  limit,
  pageSize = 20,
  showPagination,
  onOpenKeyGen,
  emptyMessage = "No ledger entries recorded for this fund yet.",
  variant = "standard",
}: LedgerTimelineProps) {
  const { i18n } = useTranslation();
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<LedgerEntryItem | null>(null);
  const [selectedEntryForProof, setSelectedEntryForProof] = useState<LedgerEntryItem | null>(null);
  const [selectedEntryForRevert, setSelectedEntryForRevert] = useState<TargetLedgerEntry | null>(null);

  const rawEntries = useQuery(
    api.treasury.ledger.listEntries,
    fundId ? { fundId, limit: limit ?? 200 } : "skip"
  );

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

  const entriesList: LedgerEntryItem[] = rawEntries ?? [];

  const isCompact = variant === "compact";
  const shouldPaginate = showPagination ?? (!isCompact && !limit);

  const totalPages = Math.ceil(entriesList.length / pageSize) || 1;
  const paginatedEntries = shouldPaginate
    ? entriesList.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : entriesList;

  const dateGroups = groupEntriesByDate(paginatedEntries, i18n.language);

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    } catch {
      // Ignore
    }
  };

  if (rawEntries === undefined) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
        Loading ledger transactions...
      </div>
    );
  }

  if (entriesList.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="w-6 h-6 text-muted-foreground" />}
        title="No Transactions Recorded"
        description={emptyMessage}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Groups Feed */}
      <div className="space-y-6">
        {dateGroups.map((group) => (
          <div key={group.dateKey} className="space-y-2.5">
            {/* Date Group Heading */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground/80 shrink-0">
                {group.dateLabel}
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            {/* Transaction Rows */}
            <div className="space-y-2">
              {group.entries.map((entry) => {
                const isCredit = entry.direction === "credit";
                const revertInfo = parseRevertMemo(entry.memo);
                const targetRevertedEntry =
                  revertInfo.isRevert && revertInfo.targetSequenceNumber
                    ? findTargetEntry(revertInfo.targetSequenceNumber, entriesList)
                    : null;
                const reversalForThisEntry = findReversalForEntry(entry.sequenceNumber, entriesList);

                return (
                  <div
                    key={entry._id}
                    className="p-3.5 sm:p-4 bg-muted/10 hover:bg-muted/25 border border-border/60 hover:border-border/90 rounded-[var(--fintech-radius-md)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    {/* Left Side: Direction, Sequence, Memo, Signer */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill
                          tone={isCredit ? "success" : "danger"}
                          className="text-[10px] py-0 px-1.5 font-medium"
                        >
                          {isCredit ? (
                            <ArrowDownLeft className="w-3 h-3 mr-1" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                          )}
                          <span>{isCredit ? "Credit" : "Debit"}</span>
                        </StatusPill>

                        <span className="font-mono text-xs font-semibold text-primary">
                          #{entry.sequenceNumber}
                        </span>

                        {revertInfo.isRevert && revertInfo.targetSequenceNumber && (
                          <StatusPill
                            tone="info"
                            className={`text-[10px] py-0 px-1.5 ${targetRevertedEntry ? "cursor-pointer hover:opacity-80" : ""}`}
                            onClick={(e) => {
                              if (targetRevertedEntry) {
                                e.stopPropagation();
                                setLocation(`/tx/${targetRevertedEntry.entryHash}`);
                              }
                            }}
                          >
                            <RotateCcw className="w-2.5 h-2.5 mr-1" />
                            <span>Reverts #{revertInfo.targetSequenceNumber}</span>
                          </StatusPill>
                        )}

                        {reversalForThisEntry && (
                          <StatusPill tone="warning" className="text-[10px] py-0 px-1.5">
                            <RotateCcw className="w-2.5 h-2.5 mr-1" />
                            <span>Reverted by #{reversalForThisEntry.sequenceNumber}</span>
                          </StatusPill>
                        )}

                        {/* Truncated Hash with copy */}
                        <button
                          type="button"
                          onClick={() => void handleCopyHash(entry.entryHash)}
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground bg-muted/30 px-1.5 py-0.5 rounded-[var(--fintech-radius-xs)] border border-border/60 transition-colors cursor-pointer shrink-0"
                          title="Copy transaction hash"
                        >
                          <span>{entry.entryHash.slice(0, 7)}</span>
                          {copiedHash === entry.entryHash ? (
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                          )}
                        </button>
                      </div>

                      {/* Memo Title */}
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedEntryForDetails(entry)}
                          className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors block truncate text-left w-full cursor-pointer"
                          title={entry.memo}
                        >
                          {entry.memo}
                        </button>
                      </div>

                      {/* Signer Info */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="text-foreground/90 font-medium">
                          {entry.signerName || "Treasurer"}
                        </span>
                        <span className="opacity-40">•</span>
                        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Right Side: Amount & Proof Drawer Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border/40 sm:flex-col sm:items-end sm:gap-2">
                      <div
                        className={`font-mono text-base font-bold tabular-nums text-right ${
                          isCredit ? "text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {isCredit ? "+" : "-"}{fund?.currency} {entry.amount.toLocaleString()}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntryForProof(entry)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer"
                          title="View cryptographic verification proof"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                          <span>Audit Proof</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedEntryForDetails(entry)}
                          className="h-7 px-2.5 text-xs cursor-pointer"
                        >
                          Details
                        </Button>

                        {canSign && !fund?.isArchived && !reversalForThisEntry && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
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
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-amber-400 cursor-pointer"
                            title="Issue compensating reversal"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {shouldPaginate && totalPages > 1 && (
        <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Entry Details Modal */}
      <EntryDetailsModal
        isOpen={selectedEntryForDetails !== null}
        onClose={() => setSelectedEntryForDetails(null)}
        entry={selectedEntryForDetails}
        currency={fund?.currency}
        fundName={fund?.name}
        entriesList={entriesList}
      />

      {/* Cryptographic Proof Slide-over */}
      <ProofSheet
        isOpen={selectedEntryForProof !== null}
        onClose={() => setSelectedEntryForProof(null)}
        entry={selectedEntryForProof}
        currency={fund?.currency}
      />

      {/* Compensating Reversal Modal */}
      {selectedEntryForRevert && organizationId && (
        <RevertEntryModal
          isOpen={selectedEntryForRevert !== null}
          onClose={() => setSelectedEntryForRevert(null)}
          organizationId={organizationId}
          entry={selectedEntryForRevert}
          currency={fund?.currency}
          onOpenKeyGen={onOpenKeyGen}
          onSuccess={() => {
            setSelectedEntryForRevert(null);
          }}
        />
      )}
    </div>
  );
}
