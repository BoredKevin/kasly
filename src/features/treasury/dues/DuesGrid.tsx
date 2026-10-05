import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import { DuesMemberItem, DuesEventItem, DuesCellItem } from "../types/dues";
import { Panel } from "../../../ui/Panel";
import { Button } from "@boredkevin/ui";
import {
  Users,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Receipt,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  Download,
  CalendarPlus,
} from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";

interface DuesGridProps {
  members: DuesMemberItem[];
  events: DuesEventItem[];
  cellMap: Map<string, DuesCellItem>;
  currency?: string;
  canManage?: boolean;
  canSign?: boolean;
  fundName?: string;
  onOpenRecordPayment: (prefill: {
    userId: Id<"users">;
    duesEventId?: Id<"duesEvents">;
    periodCount: number;
    fundId?: Id<"funds">;
  }) => void;
  onOpenEntryDetails?: (entryId: Id<"ledgerEntries">) => void;
  onOpenInvoiceDetails?: (invoiceId: Id<"invoices">) => void;
  onOpenCreateInvoice?: (prefill: { userId: Id<"users">; periodCount: number }) => void;
  onOpenUnpaidAction?: (target: {
    member: DuesMemberItem;
    event: DuesEventItem;
  }) => void;
  onOpenCreateDues?: () => void;
  onOpenBulkDues?: () => void;
  onOpenExport?: () => void;
  onSelectMember?: (member: DuesMemberItem) => void;
}

const WEEKS_PER_PAGE = 4;

export function DuesGrid({
  members,
  events,
  cellMap,
  currency = "IDR",
  canManage = false,
  canSign = false,
  fundName,
  onOpenRecordPayment,
  onOpenEntryDetails,
  onOpenInvoiceDetails,
  onOpenCreateInvoice,
  onOpenUnpaidAction,
  onOpenCreateDues,
  onOpenBulkDues,
  onOpenExport,
  onSelectMember,
}: DuesGridProps) {
  const { t } = useTranslation();
  const { money: formatMoney, date: formatDate } = useFormat();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "has_unpaid" | "fully_paid">("all");
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [isMemberColMinimized, setIsMemberColMinimized] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (containerRef.current?.requestFullscreen && !document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
    } else {
      setIsFullscreen(false);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Filter members
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        member.name.toLowerCase().includes(q) ||
        (member.nickname && member.nickname.toLowerCase().includes(q)) ||
        (member.email && member.email.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === "has_unpaid") return member.unpaidPeriodsCount > 0;
      if (statusFilter === "fully_paid") return member.unpaidPeriodsCount === 0;
      return true;
    });
  }, [members, searchQuery, statusFilter]);

  // Pagination for period columns
  const totalPages = Math.max(1, Math.ceil(events.length / WEEKS_PER_PAGE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const displayedEvents = events.slice(
    safePageIndex * WEEKS_PER_PAGE,
    (safePageIndex + 1) * WEEKS_PER_PAGE
  );

  const pagePeriodRangeLabel = displayedEvents.length > 0
    ? (() => {
        const firstEvent = displayedEvents[0];
        const lastEvent = displayedEvents[displayedEvents.length - 1];
        const firstMonth = new Date(firstEvent.dueDate).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        });
        const lastMonth = new Date(lastEvent.dueDate).toLocaleDateString(undefined, {
          month: "short",
          year: "numeric",
        });
        return firstMonth === lastMonth ? firstMonth : `${firstMonth} – ${lastMonth}`;
      })()
    : "";

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-50 bg-background flex flex-col h-screen w-screen p-3 sm:p-5 overflow-hidden"
          : "space-y-4"
      }
    >
      <Panel className={isFullscreen ? "flex-1 min-h-0 flex flex-col p-0 overflow-hidden" : "p-0 overflow-hidden"}>
        {/* Controls Toolbar */}
        <div className="p-3 sm:p-4 border-b border-border/80 flex flex-wrap items-center justify-between gap-3 bg-muted/10">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex items-center min-w-[140px] sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={t("common.search", "Search...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-background border border-border rounded-[var(--fintech-radius-sm)] text-xs text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "has_unpaid" | "fully_paid")}
              className="h-8 px-2 bg-background border border-border rounded-[var(--fintech-radius-sm)] text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">{t("common.all", "All")} ({members.length})</option>
              <option value="has_unpaid">{t("treasury.dues.unpaid", "With Unpaid")}</option>
              <option value="fully_paid">{t("treasury.dues.paid", "Fully Paid")}</option>
            </select>

            {/* Density Toggle */}
            <div className="flex items-center border border-border rounded-[var(--fintech-radius-sm)] overflow-hidden bg-background h-8">
              <button
                type="button"
                onClick={() => setDensity("comfortable")}
                className={`px-2 text-[11px] font-medium transition-colors h-full cursor-pointer ${
                  density === "comfortable"
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Comfortable row density"
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={`px-2 text-[11px] font-medium transition-colors h-full cursor-pointer border-l border-border ${
                  density === "compact"
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Compact row density"
              >
                Compact
              </button>
            </div>

            {/* Member Column Toggle */}
            <button
              type="button"
              onClick={() => setIsMemberColMinimized((prev) => !prev)}
              className="h-8 px-2.5 border border-border rounded-[var(--fintech-radius-sm)] bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={isMemberColMinimized ? "Expand member column" : "Minimize member column"}
            >
              {isMemberColMinimized ? (
                <>
                  <PanelLeftOpen className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden sm:inline">Expand Column</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Compact Column</span>
                </>
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {onOpenExport && (
              <Button
                type="button"
                variant="outline"
                chamfer="none"
                size="sm"
                onClick={onOpenExport}
                disabled={events.length === 0}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                title="Export dues to PDF or JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("treasury.dues.export", "Export")}</span>
              </Button>
            )}

            {canSign && onOpenBulkDues && (
              <Button
                type="button"
                variant="cyber"
                chamfer="none"
                size="sm"
                onClick={onOpenBulkDues}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
                title="Record dues payments for multiple members in batch"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bulk Entry</span>
              </Button>
            )}

            {canManage && onOpenCreateDues && (
              <Button
                type="button"
                variant="outline"
                chamfer="none"
                size="sm"
                onClick={onOpenCreateDues}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                title={t("treasury.dues.manualCreateCycle", "Create Cycle")}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t("treasury.dues.manualCreateCycle", "Create Cycle")}</span>
              </Button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-[var(--fintech-radius-sm)] border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
              title={isFullscreen ? t("common.exitFullscreen", "Exit Fullscreen") : t("common.fullscreen", "Fullscreen")}
              aria-label={isFullscreen ? t("common.exitFullscreen", "Exit Fullscreen") : t("common.fullscreen", "Fullscreen")}
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Table Body Container */}
        {events.length === 0 ? (
          <div className="py-16 text-center space-y-4 px-4">
            <div className="inline-flex p-3.5 bg-muted/30 border border-border text-muted-foreground rounded-full">
              <Clock className="w-8 h-8 opacity-70" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="font-semibold text-sm text-foreground">No Dues Cycles Recorded</h3>
              <p className="text-xs text-muted-foreground">
                No dues cycles have been created for {fundName || "this fund"} yet.
              </p>
            </div>
            {canManage && onOpenCreateDues && (
              <Button
                type="button"
                variant="cyber"
                chamfer="none"
                size="sm"
                onClick={onOpenCreateDues}
                className="text-xs cursor-pointer"
              >
                <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
                <span>{t("treasury.dues.manualCreateCycle", "Create Cycle")}</span>
              </Button>
            )}
          </div>
        ) : (
          <div className={`relative overflow-x-auto ${isFullscreen ? "flex-1 min-h-0 overflow-y-auto" : ""}`}>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border/80 sticky top-0 z-20">
                  {/* Sticky left header: Member */}
                  {isMemberColMinimized ? (
                    <th className="sticky left-0 top-0 z-30 w-[54px] min-w-[54px] max-w-[54px] p-2 bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] text-center">
                      <button
                        type="button"
                        onClick={() => setIsMemberColMinimized(false)}
                        className="w-full flex items-center justify-center p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Expand member column"
                        aria-label="Expand member column"
                      >
                        <PanelLeftOpen className="w-4 h-4 text-primary" />
                      </button>
                    </th>
                  ) : (
                    <th className="sticky left-0 top-0 z-30 w-[190px] sm:w-[220px] min-w-[190px] sm:min-w-[220px] max-w-[190px] sm:max-w-[220px] p-3 bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] font-semibold text-foreground">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{t("organization.member", "Member")}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {filteredMembers.length}
                        </span>
                      </div>
                    </th>
                  )}

                  {/* Period Columns */}
                  {displayedEvents.map((event) => {
                    const paidRatio = `${event.paidCount}/${event.totalMembers}`;
                    const isComplete = event.totalMembers > 0 && event.paidCount >= event.totalMembers;

                    return (
                      <th
                        key={event._id}
                        className="min-w-[110px] sm:min-w-[125px] p-2.5 sm:p-3 border-r border-border/60 font-medium text-foreground bg-muted/20"
                      >
                        <div className="space-y-1 text-center">
                          <p className="font-semibold text-xs text-foreground truncate">
                            {event.periodLabel}
                          </p>
                          <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                            <span>{formatMoney(event.amount, currency)}</span>
                            <span>·</span>
                            <span className={isComplete ? "text-emerald-400 font-bold" : "text-amber-400 font-semibold"}>
                              {paidRatio}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/80">
                            {formatDate(event.dueDate)}
                          </p>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-border/60">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={displayedEvents.length + 1} className="py-12 text-center text-xs text-muted-foreground">
                      {t("organization.noMembersMatching", "No members match current search criteria.")}
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member._id} className="hover:bg-muted/15 transition-colors group">
                      {/* Sticky Left Column: Member */}
                      {isMemberColMinimized ? (
                        <td
                          className={`sticky left-0 z-10 w-[54px] min-w-[54px] max-w-[54px] bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] text-center cursor-pointer ${
                            density === "compact" ? "p-1.5" : "p-2"
                          }`}
                          onClick={() => onSelectMember?.(member)}
                        >
                          <div className="relative inline-flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
                              {member.image ? (
                                <img src={member.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{(member.nickname || member.name).charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${
                                member.unpaidPeriodsCount > 0 ? "bg-amber-400" : "bg-emerald-400"
                              }`}
                            />
                          </div>
                        </td>
                      ) : (
                        <td
                          className={`sticky left-0 z-10 w-[190px] sm:w-[220px] min-w-[190px] sm:min-w-[220px] max-w-[190px] sm:max-w-[220px] bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] overflow-hidden cursor-pointer ${
                            density === "compact" ? "p-2" : "p-2.5 sm:p-3"
                          }`}
                          onClick={() => onSelectMember?.(member)}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden">
                              {member.image ? (
                                <img src={member.image} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span>{(member.nickname || member.name).charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <p
                                className="font-semibold text-xs text-foreground truncate block group-hover:text-primary transition-colors"
                                title={member.nickname ? `${member.nickname} (${member.name})` : member.name}
                              >
                                {member.nickname || member.name}
                              </p>
                              <div className="flex items-center justify-between gap-1 mt-0.5">
                                <div className="text-[10px] min-w-0">
                                  {member.unpaidPeriodsCount > 0 ? (
                                    <span className="text-amber-400 font-semibold truncate">
                                      {member.unpaidPeriodsCount} {t("treasury.dues.unpaid", "unpaid").toLowerCase()}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 font-semibold truncate">
                                      ✓ {t("treasury.dues.paid", "Paid up")}
                                    </span>
                                  )}
                                </div>
                                {canManage && member.unpaidPeriodsCount > 0 && onOpenCreateInvoice && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenCreateInvoice({
                                        userId: member.userId,
                                        periodCount: member.unpaidPeriodsCount,
                                      });
                                    }}
                                    title={t("treasury.invoices.createDuesBtn", "Create Dues Invoice")}
                                    aria-label={t("treasury.invoices.createDuesBtn", "Create Dues Invoice")}
                                    className="p-1 rounded-[var(--fintech-radius-sm)] text-amber-300 hover:text-amber-200 hover:bg-amber-500/15 border border-amber-500/30 transition-colors cursor-pointer shrink-0"
                                  >
                                    <Receipt className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}

                      {/* Period Cells */}
                      {displayedEvents.map((event) => {
                        const cell = cellMap.get(`${member._id}_${event._id}`);
                        const hasPaid = cell?.hasPaid ?? false;
                        const isWaived = cell?.isWaived ?? false;

                        if (hasPaid) {
                          if (isWaived) {
                            return (
                              <td key={event._id} className="p-1.5 sm:p-2 border-r border-border/40 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (cell?.ledgerEntryId && onOpenEntryDetails) {
                                      onOpenEntryDetails(cell.ledgerEntryId);
                                    }
                                  }}
                                  className="w-full py-1 px-1.5 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 rounded-[var(--fintech-radius-sm)] transition-all text-center cursor-pointer"
                                >
                                  <div className="inline-flex items-center justify-center gap-1 text-[11px] font-medium">
                                    <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                                    <span className="truncate">{t("treasury.dues.waived", "Waived")}</span>
                                  </div>
                                </button>
                              </td>
                            );
                          }

                          return (
                            <td key={event._id} className="p-1.5 sm:p-2 border-r border-border/40 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (cell?.ledgerEntryId && onOpenEntryDetails) {
                                    onOpenEntryDetails(cell.ledgerEntryId);
                                  }
                                }}
                                className="w-full py-1 px-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 rounded-[var(--fintech-radius-sm)] transition-all text-center cursor-pointer"
                              >
                                <div className="inline-flex items-center justify-center gap-1 text-[11px] font-medium">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="truncate">{t("treasury.dues.paid", "Paid")}</span>
                                </div>
                              </button>
                            </td>
                          );
                        }

                        // Invoiced cell
                        if (cell?.invoiceId) {
                          return (
                            <td key={event._id} className="p-1.5 sm:p-2 border-r border-border/40 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (cell?.invoiceId && onOpenInvoiceDetails) {
                                    onOpenInvoiceDetails(cell.invoiceId);
                                  }
                                }}
                                className="w-full py-1 px-1.5 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/25 text-amber-300 rounded-[var(--fintech-radius-sm)] transition-all text-center cursor-pointer"
                                title="View Existing Invoice"
                              >
                                <div className="inline-flex items-center justify-center gap-1 text-[11px] font-medium">
                                  <Receipt className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="truncate">{t("treasury.invoices.cellInvoiced", "Invoiced")}</span>
                                </div>
                              </button>
                            </td>
                          );
                        }

                        // Unpaid / Due cell
                        return (
                          <td key={event._id} className="p-1.5 sm:p-2 border-r border-border/40 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenUnpaidAction) {
                                  onOpenUnpaidAction({ member, event });
                                } else if (canSign) {
                                  onOpenRecordPayment({
                                    userId: member.userId,
                                    duesEventId: event._id,
                                    periodCount: 1,
                                    fundId: event.fundId,
                                  });
                                }
                              }}
                              disabled={!canSign && !canManage}
                              className={`w-full py-1 px-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-[var(--fintech-radius-sm)] transition-all text-center ${
                                canSign || canManage
                                  ? "hover:bg-rose-500/25 cursor-pointer"
                                  : "opacity-80 cursor-default"
                              }`}
                            >
                              <div className="inline-flex items-center justify-center gap-1 text-[11px] font-medium">
                                <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                                <span className="truncate">{t("treasury.dues.unpaid", "Unpaid")}</span>
                              </div>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer & Legend & Period Pagination */}
        <div className="p-3 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground shrink-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-foreground">{t("treasury.dues.paid", "Paid")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-foreground">{t("treasury.invoices.cellInvoiced", "Invoiced")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="text-foreground">{t("treasury.dues.unpaid", "Unpaid")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
              <span className="text-foreground">{t("treasury.dues.waived", "Waived")}</span>
            </div>
          </div>

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-semibold text-foreground text-xs">
                {pagePeriodRangeLabel || `Page ${safePageIndex + 1}`}
              </span>
              <span className="text-muted-foreground text-[11px]">
                (Weeks {safePageIndex * WEEKS_PER_PAGE + 1}–{Math.min(events.length, (safePageIndex + 1) * WEEKS_PER_PAGE)} of {events.length})
              </span>

              <div className="flex items-center gap-1 ml-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  disabled={safePageIndex === 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer disabled:opacity-40"
                  aria-label="Previous periods"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  disabled={safePageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer disabled:opacity-40"
                  aria-label="Next periods"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs font-semibold text-foreground">
              {pagePeriodRangeLabel}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
