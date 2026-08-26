import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
} from "@boredkevin/ui";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Search,
  Receipt,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Landmark,
  CalendarPlus,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronDown,
} from "lucide-react";
import { ExportDuesModal } from "./ExportDuesModal";

interface DuesSpreadsheetPaneProps {
  organizationId: Id<"organizations">;
  organizationName?: string;
  fundId: Id<"funds"> | null;
  fundName?: string;
  currency?: string;
  onOpenRecordPayment: (prefill?: {
    userId?: Id<"users">;
    duesEventId?: Id<"duesEvents">;
    periodCount?: number;
  }) => void;
  onOpenEntryDetails?: (entryId: Id<"ledgerEntries">) => void;
  onOpenAdminTab?: () => void;
  onOpenCreateDues?: () => void;
}

const WEEKS_PER_PAGE = 4;

export function DuesSpreadsheetPane({
  organizationId,
  organizationName,
  fundId,
  fundName,
  currency = "IDR",
  onOpenRecordPayment,
  onOpenEntryDetails,
  onOpenAdminTab,
  onOpenCreateDues,
}: DuesSpreadsheetPaneProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "has_unpaid" | "fully_paid">("all");
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [isMemberColMinimized, setIsMemberColMinimized] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalInitialFormat, setExportModalInitialFormat] = useState<"pdf" | "excel">("pdf");
  const containerRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const spreadsheet = useQuery(
    api.treasury.dues.getDuesSpreadsheet,
    organizationId && fundId
      ? {
        organizationId,
        fundId,
        limitEvents: 60,
      }
      : "skip"
  );

  const duesSummary = useQuery(
    api.treasury.dues.getDuesSummary,
    organizationId && fundId
      ? {
        organizationId,
        fundId,
      }
      : "skip"
  );

  const myMembership = useQuery(api.members.getMyMembership, {
    organizationId,
  });

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  // Sync fullscreen change & Escape key listener
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

  // Click outside listener for export dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleZoomIn = () => {
    setZoomPercent((prev) => Math.min(130, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomPercent((prev) => Math.max(70, prev - 10));
  };

  const handleResetZoom = () => {
    setZoomPercent(100);
  };

  // Fast lookup map for cells: `${memberId}_${duesEventId}` -> cell
  const cellMap = useMemo(() => {
    const map = new Map<string, {
      _id: Id<"duesMemberships">;
      duesEventId: Id<"duesEvents">;
      fundId: Id<"funds">;
      memberId: Id<"members">;
      userId: Id<"users">;
      hasPaid: boolean;
      isWaived?: boolean;
      paidAt?: number;
      ledgerEntryId?: Id<"ledgerEntries">;
    }>();
    if (spreadsheet?.cells) {
      for (const cell of spreadsheet.cells) {
        map.set(`${cell.memberId}_${cell.duesEventId}`, cell);
      }
    }
    return map;
  }, [spreadsheet]);

  // Filter members based on search and status
  const filteredMembers = useMemo(() => {
    if (!spreadsheet?.members) return [];
    return spreadsheet.members.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.nickname && member.nickname.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (member.email && member.email.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (statusFilter === "has_unpaid") {
        return member.unpaidPeriodsCount > 0;
      }
      if (statusFilter === "fully_paid") {
        return member.unpaidPeriodsCount === 0;
      }
      return true;
    });
  }, [spreadsheet, searchQuery, statusFilter]);

  const formatAmount = (amt: number) => {
    if (currency === "IDR") {
      return `Rp ${amt.toLocaleString("id-ID")}`;
    }
    return `${currency} ${amt.toLocaleString()}`;
  };

  if (!fundId) {
    return (
      <Card telemetry="TREASURY.DUES_NO_FUND" cornerLines className="bg-card border-border">
        <CardContent className="py-16 text-center space-y-3">
          <div className="inline-flex p-3 bg-muted/40 border border-border/60 text-muted-foreground rounded-full">
            <Landmark className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No Fund Selected</h3>
            <p className="text-xs font-mono text-muted-foreground">
              Please select or create a fund account to view its member dues spreadsheet.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (spreadsheet === undefined || duesSummary === undefined) {
    return (
      <Card telemetry="TREASURY.DUES_LOADING" cornerLines className="bg-card border-border">
        <CardContent className="py-16 text-center space-y-3">
          <div className="inline-flex p-3 bg-muted/40 border border-border/60 text-muted-foreground rounded-full animate-spin">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-xs font-mono text-muted-foreground animate-pulse">
            Loading member dues spreadsheet...
          </p>
        </CardContent>
      </Card>
    );
  }

  const events = spreadsheet.events;
  const totalPages = Math.max(1, Math.ceil(events.length / WEEKS_PER_PAGE));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);

  // Paginate events to 4 weeks per month / page
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
    <div className="space-y-6">
      {/* Top Metrics Banner (hidden when in fullscreen mode) */}
      {!isFullscreen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card telemetry="TREASURY.DUES_SCHEDULE_STATUS" cornerLines className="bg-card/90 border-border shadow-sm">
            <CardContent className="p-4 space-y-1.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-mono uppercase tracking-wider">{t("treasury.dues.scheduleConfig")}</span>
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-foreground capitalize">
                  {duesSummary.config?.isEnabled
                    ? duesSummary.config.intervalType === "weekly"
                      ? "Weekly Dues"
                      : duesSummary.config.intervalType === "monthly"
                        ? "Monthly Dues"
                        : `Every ${duesSummary.config.intervalValue}d`
                    : "Schedule Paused"}
                </span>
                {duesSummary.config?.isEnabled && (
                  <span className="text-xs font-mono text-emerald-400 font-semibold">● Active</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {duesSummary.config
                  ? `${formatAmount(duesSummary.config.amount)} / member`
                  : "No recurring schedule"}
              </p>
            </CardContent>
          </Card>

          <Card telemetry="TREASURY.DUES_UNPAID_METRIC" cornerLines className="bg-card/90 border-border shadow-sm">
            <CardContent className="p-4 space-y-1.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-mono uppercase tracking-wider">{t("treasury.dues.unpaid")}</span>
                <Receipt className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-amber-400 font-mono">
                  {duesSummary.totalUnpaidMemberships}
                </span>
                <span className="text-xs text-muted-foreground">{t("treasury.dues.unpaid").toLowerCase()}</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                Across {duesSummary.totalEvents} recorded dues
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Spreadsheet Card */}
      <Card
        ref={containerRef}
        telemetry="TREASURY.DUES_SPREADSHEET"
        cornerLines={!isFullscreen}
        className={
          isFullscreen
            ? "fixed inset-0 z-50 rounded-none border-none bg-background flex flex-col h-screen w-screen p-3 sm:p-5 overflow-hidden"
            : "bg-card border-border shadow-xl"
        }
      >
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">
                  {t("treasury.dues.title")}
                </CardTitle>
                {isFullscreen && (
                  <span className="text-[11px] font-mono text-primary px-2 py-0.5 bg-primary/10 border border-primary/20 rounded">
                    {t("common.fullscreen") || "Fullscreen"}
                  </span>
                )}
              </div>
            </div>

            {/* Filter, Search, Minimizer, Zoom, Fullscreen & Create Dues Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex items-center flex-1 sm:flex-initial min-w-[120px] sm:w-44">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none shrink-0" />
                <input
                  type="text"
                  placeholder={t("common.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 bg-background/80 border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-8 px-2 bg-background/80 border border-border text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">{t("common.all")} ({spreadsheet.members.length})</option>
                <option value="has_unpaid">With Unpaid</option>
                <option value="fully_paid">Fully Paid</option>
              </select>

              {/* Quick toggle for compact/minimized member column */}
              <Button
                type="button"
                variant={isMemberColMinimized ? "cyber" : "outline"}
                chamfer="dual"
                size="sm"
                onClick={() => setIsMemberColMinimized((prev) => !prev)}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer px-2.5"
                title={isMemberColMinimized ? (t("treasury.dues.expandMembers") || "Expand member column") : (t("treasury.dues.minimizeMembers") || "Minimize member column")}
              >
                {isMemberColMinimized ? (
                  <>
                    <PanelLeftOpen className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t("treasury.dues.compactView") || "Compact"}</span>
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t("treasury.dues.minimizeMembers") || "Minimize"}</span>
                  </>
                )}
              </Button>

              {/* Zoom In & Zoom Out Controls */}
              <div className="flex items-center bg-background/80 border border-border h-8 px-1 rounded-sm gap-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoomPercent <= 70}
                  className="p-1 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title={t("common.zoomOut") || "Zoom Out"}
                  aria-label={t("common.zoomOut") || "Zoom Out"}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-1 text-[10px] font-mono font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer min-w-[34px] text-center"
                  title={t("common.resetZoom") || "Reset Zoom (100%)"}
                >
                  {zoomPercent}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoomPercent >= 130}
                  className="p-1 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title={t("common.zoomIn") || "Zoom In"}
                  aria-label={t("common.zoomIn") || "Zoom In"}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Export Dropdown Button */}
              <div className="relative" ref={exportDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  size="sm"
                  onClick={() => setIsExportMenuOpen((prev) => !prev)}
                  disabled={spreadsheet.events.length === 0}
                  className="h-8 text-xs flex items-center gap-1.5 cursor-pointer px-2.5 shadow-sm"
                  title={t("treasury.dues.export") || "Export"}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {t("treasury.dues.export") || "Export"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground ml-0.5" />
                </Button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-52 bg-card/95 backdrop-blur-md border border-border rounded shadow-2xl z-50 py-1 divide-y divide-border/60 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                      {t("treasury.dues.export") || "Export Options"}
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          setExportModalInitialFormat("pdf");
                          setIsExportModalOpen(true);
                        }}
                        className="w-full px-3 py-2 text-xs flex items-center gap-2 text-foreground hover:bg-muted/40 hover:text-rose-400 transition-colors text-left cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium">{t("treasury.dues.exportPdf") || "PDF Report (.pdf)"}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">Custom cycle range & layout</span>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsExportMenuOpen(false);
                          setExportModalInitialFormat("excel");
                          setIsExportModalOpen(true);
                        }}
                        className="w-full px-3 py-2 text-xs flex items-center gap-2 text-foreground hover:bg-muted/40 hover:text-emerald-400 transition-colors text-left cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="flex flex-col">
                          <span className="font-medium">{t("treasury.dues.exportExcel") || "Excel (.xlsx)"}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">Full matrix & raw grid</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Fullscreen Toggle Button */}
              <Button
                type="button"
                variant={isFullscreen ? "cyber" : "outline"}
                chamfer="dual"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer px-2.5"
                title={isFullscreen ? (t("common.exitFullscreen") || "Exit Fullscreen") : (t("common.fullscreen") || "Fullscreen")}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-primary" />
                    <span className="hidden sm:inline">{t("common.exitFullscreen") || "Exit Fullscreen"}</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t("common.fullscreen") || "Fullscreen"}</span>
                  </>
                )}
              </Button>

              {canManage && onOpenCreateDues && (
                <Button
                  type="button"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  onClick={onOpenCreateDues}
                  className="h-8 text-xs flex items-center gap-1.5 cursor-pointer px-2.5 shadow-sm"
                  title={t("treasury.dues.manualCreateCycle")}
                >
                  <CalendarPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("treasury.dues.manualCreateCycle")}</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className={isFullscreen ? "p-0 flex-1 min-h-0 flex flex-col overflow-hidden" : "p-0"}>
          {events.length === 0 ? (
            <div className="py-16 text-center space-y-4 px-4">
              <div className="inline-flex p-4 bg-muted/30 border border-border text-muted-foreground rounded-full">
                <CalendarDays className="w-8 h-8 opacity-70" />
              </div>
              <div className="space-y-1.5 max-w-sm mx-auto">
                <h3 className="font-semibold text-sm text-foreground">No Dues Cycles Recorded</h3>
                <p className="text-xs text-muted-foreground">
                  The automated dues cron job hasn't generated any dues cycles for {fundName || "this fund"} yet. Configure the schedule in the Admin tab or create a cycle manually for today or any past date.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {canManage && onOpenCreateDues && (
                  <Button
                    type="button"
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    onClick={onOpenCreateDues}
                    className="text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    <span>{t("treasury.dues.manualCreateCycle")}</span>
                  </Button>
                )}
                {canManage && onOpenAdminTab && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={onOpenAdminTab}
                    className="text-xs cursor-pointer"
                  >
                    {t("treasury.dues.scheduleConfig")}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className={`relative overflow-x-auto border-b border-border ${isFullscreen ? "flex-1 min-h-0 overflow-y-auto" : ""}`}>
              <table
                className="w-full border-collapse text-left text-xs transition-transform origin-top-left"
                style={{ zoom: `${zoomPercent}%` }}
              >
                <thead>
                  <tr className="bg-muted/30 border-b border-border/80 sticky top-0 z-20">
                    {/* Sticky left header: Member (Expanded vs Minimized) */}
                    {isMemberColMinimized ? (
                      <th className="sticky left-0 top-0 z-30 w-[56px] min-w-[56px] max-w-[56px] p-2.5 bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] text-center">
                        <button
                          type="button"
                          onClick={() => setIsMemberColMinimized(false)}
                          className="w-full flex items-center justify-center p-1 hover:bg-muted/40 rounded transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                          title={t("treasury.dues.expandMembers") || "Expand member column"}
                          aria-label={t("treasury.dues.expandMembers") || "Expand member column"}
                        >
                          <PanelLeftOpen className="w-4 h-4 text-primary" />
                        </button>
                      </th>
                    ) : (
                      <th className="sticky left-0 top-0 z-30 w-[190px] sm:w-[220px] min-w-[190px] sm:min-w-[220px] max-w-[190px] sm:max-w-[220px] p-3 bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] font-semibold text-foreground overflow-hidden">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{t("organization.member")}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-mono text-muted-foreground font-normal hidden sm:inline">
                              {filteredMembers.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsMemberColMinimized(true)}
                              className="p-1 hover:bg-muted/50 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={t("treasury.dues.minimizeMembers") || "Minimize member column"}
                              aria-label={t("treasury.dues.minimizeMembers") || "Minimize member column"}
                            >
                              <PanelLeftClose className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </th>
                    )}

                    {/* Paginated Period Columns per page */}
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
                              <span>{formatAmount(event.amount)}</span>
                              <span>·</span>
                              <span className={isComplete ? "text-emerald-400 font-bold" : "text-amber-400 font-semibold"}>
                                {paidRatio}
                              </span>
                            </div>
                            <p className="text-[9px] font-mono text-muted-foreground/70">
                              {new Date(event.dueDate).toLocaleDateString()}
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
                        No members matching current search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr key={member._id} className="hover:bg-muted/15 transition-colors group">
                        {/* Sticky Left Column: Member Profile (Expanded vs Minimized) */}
                        {isMemberColMinimized ? (
                          <td className="sticky left-0 z-10 w-[56px] min-w-[56px] max-w-[56px] p-2 bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] text-center">
                            <div className="relative inline-flex items-center justify-center group/avatar">
                              <div
                                className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0 overflow-hidden cursor-help"
                                title={`${member.nickname ? `${member.nickname} (${member.name})` : member.name} — ${
                                  member.unpaidPeriodsCount > 0
                                    ? `${member.unpaidPeriodsCount} ${t("treasury.dues.unpaid").toLowerCase()}`
                                    : t("treasury.dues.paid")
                                }`}
                              >
                                {member.image ? (
                                  <img src={member.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span>{(member.nickname || member.name).charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              {/* Mini Status Dot Badge */}
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                                  member.unpaidPeriodsCount > 0 ? "bg-rose-500" : "bg-emerald-400"
                                }`}
                              />
                            </div>
                          </td>
                        ) : (
                          <td className="sticky left-0 z-10 w-[190px] sm:w-[220px] min-w-[190px] sm:min-w-[220px] max-w-[190px] sm:max-w-[220px] p-2.5 sm:p-3 bg-card border-r border-border shadow-[4px_0_12px_-2px_rgba(0,0,0,0.5)] overflow-hidden">
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
                                  className="font-semibold text-xs text-foreground truncate block"
                                  title={member.nickname ? `${member.nickname} (${member.name})` : member.name}
                                >
                                  {member.nickname || member.name}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                                  {member.unpaidPeriodsCount > 0 ? (
                                    <span className="text-rose-400 font-semibold truncate">
                                      {member.unpaidPeriodsCount} {t("treasury.dues.unpaid").toLowerCase()}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 font-semibold truncate">
                                      ✓ {t("treasury.dues.paid")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Paginated Period Cells */}
                        {displayedEvents.map((event) => {
                          const cell = cellMap.get(`${member._id}_${event._id}`);
                          const hasPaid = cell?.hasPaid ?? false;
                          const isWaived = cell?.isWaived ?? false;

                          if (hasPaid) {
                            if (isWaived) {
                              return (
                                <td
                                  key={event._id}
                                  className="p-2 border-r border-border/40 text-center"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (cell?.ledgerEntryId && onOpenEntryDetails) {
                                        onOpenEntryDetails(cell.ledgerEntryId);
                                      }
                                    }}
                                    className="w-full py-1.5 px-1.5 sm:px-2 bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-300 rounded transition-all text-center group/cell cursor-pointer"
                                  >
                                    <div className="inline-flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-mono font-medium">
                                      <ShieldCheck className="w-3 h-3 text-indigo-400 shrink-0" />
                                      <span className="truncate">{t("treasury.dues.waived")}</span>
                                    </div>
                                    {cell?.paidAt && (
                                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                                        {new Date(cell.paidAt).toLocaleDateString()}
                                      </p>
                                    )}
                                  </button>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={event._id}
                                className="p-2 border-r border-border/40 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (cell?.ledgerEntryId && onOpenEntryDetails) {
                                      onOpenEntryDetails(cell.ledgerEntryId);
                                    }
                                  }}
                                  className="w-full py-1.5 px-1.5 sm:px-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 rounded transition-all text-center group/cell cursor-pointer"
                                >
                                  <div className="inline-flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-mono font-medium">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span className="truncate">{t("treasury.dues.paid")}</span>
                                  </div>
                                  {cell?.paidAt && (
                                    <p className="text-[9px] text-muted-foreground font-mono truncate">
                                      {new Date(cell.paidAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </button>
                              </td>
                            );
                          }

                          // Unpaid / Due cell
                          return (
                            <td
                              key={event._id}
                              className="p-2 border-r border-border/40 text-center"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (canSign) {
                                    onOpenRecordPayment({
                                      userId: member.userId,
                                      duesEventId: event._id,
                                      periodCount: 1,
                                    });
                                  }
                                }}
                                disabled={!canSign}
                                className={`w-full py-1.5 px-1.5 sm:px-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded transition-all text-center group/cell ${canSign
                                  ? "hover:bg-rose-500/25 hover:border-rose-500/60 cursor-pointer shadow-sm"
                                  : "opacity-80 cursor-default"
                                  }`}
                              >
                                <div className="inline-flex items-center justify-center gap-1 text-[10px] sm:text-[11px] font-mono font-medium">
                                  <Clock className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span className="truncate">{t("treasury.dues.unpaid")}</span>
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

          {/* Table Footer & Legend & Pagination */}
          <div className="p-3.5 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground shrink-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-emerald-500" />
                <span className="text-foreground">{t("treasury.dues.paid")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 border border-rose-500" />
                <span className="text-foreground">{t("treasury.dues.unpaid")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 border border-indigo-500" />
                <span className="text-foreground">{t("treasury.dues.waived")}</span>
              </div>
            </div>

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span className="font-bold text-foreground">
                    {pagePeriodRangeLabel || `Month ${safePageIndex + 1}`}
                  </span>
                  <span className="text-muted-foreground">
                    (Weeks {safePageIndex * WEEKS_PER_PAGE + 1}–{Math.min(events.length, (safePageIndex + 1) * WEEKS_PER_PAGE)} of {events.length})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={safePageIndex === 0}
                    onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                    className="h-7 text-[11px] px-2.5 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={safePageIndex >= totalPages - 1}
                    onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                    className="h-7 text-[11px] px-2.5 flex items-center gap-1 cursor-pointer disabled:opacity-40"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {pagePeriodRangeLabel && (
                  <span className="text-[11px] font-mono font-bold text-foreground">
                    {pagePeriodRangeLabel}
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Export Dues Modal */}
      {fundName && (
        <ExportDuesModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          fundName={fundName}
          organizationName={organizationName}
          currency={currency}
          events={spreadsheet.events}
          members={filteredMembers.length > 0 ? filteredMembers : spreadsheet.members}
          cellMap={cellMap}
          summary={
            duesSummary
              ? {
                  totalUnpaidMemberships: duesSummary.totalUnpaidMemberships,
                  totalEvents: duesSummary.totalEvents,
                  config: duesSummary.config,
                }
              : undefined
          }
          initialFormat={exportModalInitialFormat}
          currentPageIndex={safePageIndex}
          weeksPerPage={WEEKS_PER_PAGE}
        />
      )}
    </div>
  );
}
