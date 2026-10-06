import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@boredkevin/ui";
import { StatusPill, EmptyState } from "../../../ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ScrollText,
} from "lucide-react";
import { RevertEntryModal, TargetLedgerEntry } from "../components/RevertEntryModal";
import { LedgerEntryItem } from "../types/ledger";
import { parseRevertMemo, findReversalForEntry } from "../lib/revertUtils";
import { EntryDetailsModal } from "./EntryDetailsModal";
import { useFormat } from "../../../hooks/useFormat";

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
  const intlLocale = locale.startsWith("id") ? "id-ID" : "en-US";
  for (const entry of entries) {
    const d = new Date(entry.timestamp);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dateLabel = d.toLocaleDateString(intlLocale, {
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
  const { t } = useTranslation();
  const { money: formatMoney, time: formatTime, locale } = useFormat();
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<LedgerEntryItem | null>(null);
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

  const dateGroups = groupEntriesByDate(paginatedEntries, locale);

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
      <div className="space-y-5">
        {dateGroups.map((group) => (
          <div key={group.dateKey} className="space-y-2">
            {/* Date Group Heading */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">
                {group.dateLabel}
              </span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            {/* Transaction Rows */}
            <div
              className={`divide-y divide-border/25 overflow-hidden ${
                isCompact
                  ? ""
                  : "rounded-[var(--fintech-radius-md)] border border-border/40 bg-card/40"
              }`}
            >
              {group.entries.map((entry) => {
                const isCredit = entry.direction === "credit";
                const revertInfo = parseRevertMemo(entry.memo);
                const reversalForThisEntry = findReversalForEntry(entry.sequenceNumber, entriesList);

                // Formulate clear, non-cryptic title
                let displayTitle = entry.memo;
                if (revertInfo.isRevert && revertInfo.targetSequenceNumber) {
                  displayTitle = revertInfo.reason
                    ? `${t("treasury.ledger.reversal", "Pembatalan")} #${revertInfo.targetSequenceNumber}: ${revertInfo.reason}`
                    : `${t("treasury.ledger.reversal", "Pembatalan")} #${revertInfo.targetSequenceNumber}`;
                }

                return (
                  <div
                    key={entry._id}
                    onClick={() => setSelectedEntryForDetails(entry)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedEntryForDetails(entry);
                      }
                    }}
                    className="p-3 sm:p-3.5 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {/* Left: Direction Icon + Title + Subtext */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isCredit
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border/60"
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                            {displayTitle}
                          </span>

                          {/* At most ONE status tag if applicable */}
                          {reversalForThisEntry ? (
                            <StatusPill tone="warning" className="text-[10px] py-0 px-1.5 shrink-0">
                              {t("treasury.ledger.reverted", "Dibatalkan")}
                            </StatusPill>
                          ) : revertInfo.isRevert ? (
                            <StatusPill tone="info" className="text-[10px] py-0 px-1.5 shrink-0">
                              {t("treasury.ledger.reversal", "Pembatalan")}
                            </StatusPill>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="text-foreground/80 font-medium">
                            {entry.signerName || t("treasury.ledger.treasurer", "Bendahara")}
                          </span>
                          <span className="opacity-40">•</span>
                          <span>{formatTime(entry.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Clean Formatted Amount */}
                    <div className="shrink-0 text-right pl-2">
                      <div
                        className={`text-sm sm:text-base font-sans font-bold tabular-nums tracking-tight ${
                          isCredit ? "text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {isCredit ? "+" : "−"}{formatMoney(entry.amount, fund?.currency ?? "IDR")}
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
        canRevert={canSign && !fund?.isArchived}
        onRevert={(entryToRevert) => {
          setSelectedEntryForRevert({
            _id: entryToRevert._id,
            fundId: entryToRevert.fundId,
            sequenceNumber: entryToRevert.sequenceNumber,
            direction: entryToRevert.direction,
            amount: entryToRevert.amount,
            memo: entryToRevert.memo,
            keyId: entryToRevert.keyId,
            duesEventId: entryToRevert.duesEventId,
          });
        }}
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
