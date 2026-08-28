import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  RotateCcw,
  Copy,
  Check,
  Code2,
  MoreHorizontal,
  User,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { RevertEntryModal, TargetLedgerEntry } from "./RevertEntryModal";
import { LedgerEntryItem } from "./EntryDetailsModal";
import {
  parseRevertMemo,
  findReversalForEntry,
  findTargetEntry,
} from "../utils/revertUtils";
export type { LedgerEntryItem };

export interface LedgerTimelineProps {
  fundId: Id<"funds"> | null;
  organizationId?: Id<"organizations">;
  limit?: number;
  pageSize?: number;
  showPagination?: boolean;
  onOpenRecordPayment?: () => void;
  onOpenKeyGen?: () => void;
  emptyMessage?: string;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

interface DateGroup {
  dateLabel: string;
  dateKey: string;
  entries: LedgerEntryItem[];
}

function groupEntriesByDate(entries: LedgerEntryItem[]): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dateLabel = d.toLocaleDateString("en-US", {
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
}: LedgerTimelineProps) {
  const [, setLocation] = useLocation();
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeMobileMenuId, setActiveMobileMenuId] = useState<string | null>(null);
  const [selectedEntryForRevert, setSelectedEntryForRevert] = useState<TargetLedgerEntry | null>(null);

  const fund = useQuery(
    api.treasury.funds.get,
    fundId ? { fundId } : "skip"
  );

  const effectiveOrgId = organizationId ?? fund?.organizationId;

  const myMembership = useQuery(
    api.members.getMyMembership,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  useEffect(() => {
    if (!activeMobileMenuId) return;
    const handleOutsideClick = () => setActiveMobileMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [activeMobileMenuId]);

  // Fetch entries with optional limit
  const entriesData = useQuery(
    api.treasury.ledger.listEntries,
    fundId ? { fundId, limit: limit ?? 100 } : "skip"
  );

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isFrozen = Boolean(fund?.isFrozen);
  const entriesList = (entriesData as LedgerEntryItem[] | undefined) ?? [];
  const totalEntries = entriesList.length;

  const shouldPaginate = showPagination ?? (!limit && totalEntries > pageSize);
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const displayedEntries = shouldPaginate
    ? entriesList.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : entriesList;

  const dateGroups = groupEntriesByDate(displayedEntries);

  if (entriesData === undefined) {
    return (
      <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
        Loading ledger entries...
      </div>
    );
  }

  if (entriesList.length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <Clock className="w-6 h-6 text-muted-foreground mx-auto opacity-50" />
        <p className="text-xs text-muted-foreground font-mono">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" onClick={() => setActiveMobileMenuId(null)}>
      {/* GitHub Commits Style Timeline */}
      <div className="relative pl-6 space-y-6 border-l border-border/80 ml-2">
        {dateGroups.map((group) => (
          <div key={group.dateKey} className="space-y-2.5 relative">
            {/* Date Group Header with Commit Node */}
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-background -ml-[31px] shrink-0" />
              <span className="font-semibold text-foreground/50">
                Entries on {group.dateLabel}
              </span>
            </div>

            {/* Commit Rows Container Box */}
            <div className="border border-border/80 bg-card/60 divide-y divide-border/60 overflow-hidden shadow-sm">
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
                    className="p-3.5 hover:bg-muted/15 transition-colors flex items-center justify-between gap-3 group"
                  >
                    {/* Left Side: Memo, Amount, Direction & Signer Info */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Top Line: Direction Badge + Amount + Memo Title */}
                      <div className="flex flex-wrap items-center gap-2">
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
                          <span>{isCredit ? "CREDIT" : "DEBIT"}</span>
                        </Badge>

                        <span className="font-mono text-xs font-bold text-foreground shrink-0">
                          {fund?.currency} {entry.amount.toLocaleString()}
                        </span>

                        {entry.transferId && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] font-mono px-1 py-0 bg-blue-500/15 text-blue-300 border-blue-500/30 shrink-0"
                          >
                            Transfer
                          </Badge>
                        )}

                        {revertInfo.isRevert && revertInfo.targetSequenceNumber && (
                          <Badge
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (targetRevertedEntry) {
                                setLocation(`/tx/${targetRevertedEntry.entryHash}`);
                              }
                            }}
                            className={`text-[9px] font-mono px-1.5 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 shrink-0 ${
                              targetRevertedEntry ? "cursor-pointer hover:bg-purple-500/25 hover:text-purple-200" : ""
                            }`}
                            title={`Reverts Entry #${revertInfo.targetSequenceNumber}`}
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Reverts #{revertInfo.targetSequenceNumber}</span>
                          </Badge>
                        )}

                        {reversalForThisEntry && (
                          <Badge
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/tx/${reversalForThisEntry.entryHash}`);
                            }}
                            className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0 cursor-pointer hover:bg-amber-500/25 hover:text-amber-200"
                            title={`Reverted by Entry #${reversalForThisEntry.sequenceNumber}`}
                          >
                            <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                            <span>Reverted by #{reversalForThisEntry.sequenceNumber}</span>
                          </Badge>
                        )}

                        <button
                          type="button"
                          onClick={() => setLocation(`/tx/${entry.entryHash}`)}
                          className="text-xs font-semibold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg hover:text-primary hover:underline transition-colors text-left cursor-pointer"
                          title={entry.memo}
                        >
                          {entry.memo}
                        </button>
                      </div>

                      {/* Bottom Sub-line: Signer, Time, Sequence #, Key */}
                      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] font-mono text-muted-foreground">
                        <span className="text-primary font-bold">#{entry.sequenceNumber}</span>
                        <div className="flex items-center gap-1 text-foreground">
                          <div className="p-0.5 rounded-full border border-border/60 bg-muted/40">
                            <User className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          <span className="font-medium">
                            {entry.signerName || "Authorized Treasurer"}
                          </span>
                        </div>
                        <span>signed {formatRelativeTime(entry.timestamp)}</span>

                      </div>
                    </div>

                    {/* Right Side - Desktop: 7-Char Hash with Copy & Code Details */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0 font-mono text-xs">
                      {/* 7-character Short Hash with Copy Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        chamfer="dual"
                        onClick={() => copyToClipboard(entry.entryHash, `hash-${entry._id}`)}
                        title="Copy full SHA-256"
                        className="h-7 px-2 font-mono text-[11px] flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <span>{entry.entryHash.slice(0, 7)}</span>
                        {copiedId === `hash-${entry._id}` ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60" />
                        )}
                      </Button>

                      {/* View Details < > */}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="dual"
                        onClick={() => setLocation(`/tx/${entry.entryHash}`)}
                        title="View cryptographic details"
                        className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                      </Button>

                      {/* Revert Action */}
                      {canSign && !fund?.isArchived && !isFrozen && !reversalForThisEntry && (
                        <Button
                          type="button"
                          variant="destructive"
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
                          title={`Revert Entry #${entry.sequenceNumber}`}
                          className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer text-foreground hover:text-amber-300 hover:border-amber-500/40"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Right Side - Mobile: [...] Dropdown Menu Button */}
                    <div className="sm:hidden relative shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        chamfer="dual"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMobileMenuId(
                            activeMobileMenuId === entry._id ? null : entry._id
                          );
                        }}
                        className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>

                      {/* Mobile Popover Menu */}
                      {activeMobileMenuId === entry._id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-40 w-56 p-1 bg-popover/95 backdrop-blur-md border border-border shadow-2xl font-mono text-xs space-y-0.5 animate-in fade-in zoom-in-95"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setLocation(`/tx/${entry.entryHash}`);
                              setActiveMobileMenuId(null);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-muted/40 text-foreground text-left cursor-pointer transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>View entry details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              copyToClipboard(entry.entryHash, `hash-${entry._id}`);
                              setActiveMobileMenuId(null);
                            }}
                            className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-muted/40 text-foreground text-left cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span>Copy full SHA for {entry.entryHash.slice(0, 7)}</span>
                          </button>

                          {canSign && !fund?.isArchived && !isFrozen && !reversalForThisEntry && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEntryForRevert({
                                  _id: entry._id,
                                  fundId: entry.fundId,
                                  sequenceNumber: entry.sequenceNumber,
                                  direction: entry.direction,
                                  amount: entry.amount,
                                  memo: entry.memo,
                                  keyId: entry.keyId,
                                  duesEventId: entry.duesEventId,
                                });
                                setActiveMobileMenuId(null);
                              }}
                              className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-amber-500/20 text-amber-300 text-left cursor-pointer transition-colors border-t border-border/40"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>Revert entry</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls (when enabled) */}
      {shouldPaginate && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/80">
          <div className="text-xs font-mono text-muted-foreground">
            Page {currentPage} of {totalPages} ({totalEntries} entries total)
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="dual"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-2 text-xs flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="dual"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-2 text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Revert Entry Modal */}
      {canSign && effectiveOrgId && (
        <RevertEntryModal
          isOpen={Boolean(selectedEntryForRevert)}
          onClose={() => setSelectedEntryForRevert(null)}
          organizationId={effectiveOrgId}
          entry={selectedEntryForRevert}
          currency={fund?.currency}
          onOpenKeyGen={onOpenKeyGen}
        />
      )}
    </div>
  );
}
