import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@boredkevin/ui";
import {
  Download,
  X,
  FileText,
  CalendarDays,
  Loader2,
  Info,
} from "lucide-react";
import {
  DuesExportEvent,
  DuesExportMember,
  DuesExportCell,
  DuesExportPayload,
  exportDuesToPdf,
} from "../../../lib/exportDues";

interface ExportDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  fundName: string;
  organizationName?: string;
  currency?: string;
  events: DuesExportEvent[];
  members: DuesExportMember[];
  cellMap: Map<string, DuesExportCell>;
  summary?: DuesExportPayload["summary"];
  currentPageIndex?: number;
  weeksPerPage?: number;
}

export function ExportDuesModal({
  isOpen,
  onClose,
  fundName,
  organizationName = "Kasly Workspace",
  currency = "IDR",
  events,
  members,
  cellMap,
  summary,
  currentPageIndex = 0,
  weeksPerPage = 4,
}: ExportDuesModalProps) {
  const { t } = useTranslation();
  const [rangeMode, setRangeMode] = useState<"page" | "custom" | "all">(
    events.length > 8 ? "page" : "all"
  );
  const [fromEventIndex, setFromEventIndex] = useState<number>(0);
  const [toEventIndex, setToEventIndex] = useState<number>(
    Math.min(events.length - 1, Math.max(0, fromEventIndex + 3))
  );
  const [isExporting, setIsExporting] = useState(false);

  // Compute page slice bounds
  const pageStartIndex = currentPageIndex * weeksPerPage;
  const pageEndIndex = Math.min(events.length - 1, pageStartIndex + weeksPerPage - 1);

  // Filtered events based on selected range mode
  const selectedEvents = useMemo(() => {
    if (events.length === 0) return [];
    if (rangeMode === "page") {
      return events.slice(pageStartIndex, pageEndIndex + 1);
    }
    if (rangeMode === "all") {
      return events;
    }
    // Custom range
    const start = Math.min(fromEventIndex, toEventIndex);
    const end = Math.max(fromEventIndex, toEventIndex);
    return events.slice(start, end + 1);
  }, [events, rangeMode, pageStartIndex, pageEndIndex, fromEventIndex, toEventIndex]);

  if (!isOpen || typeof document === "undefined") return null;

  const dateRangeLabel = selectedEvents.length > 0
    ? (() => {
        const first = selectedEvents[0];
        const last = selectedEvents[selectedEvents.length - 1];
        const firstDate = new Date(first.dueDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const lastDate = new Date(last.dueDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        if (selectedEvents.length === 1) {
          return `${first.periodLabel} (${firstDate})`;
        }
        return `${first.periodLabel} (${firstDate}) – ${last.periodLabel} (${lastDate})`;
      })()
    : "No events";

  const handleExport = async () => {
    if (selectedEvents.length === 0) return;
    setIsExporting(true);

    try {
      const payload: DuesExportPayload = {
        fundName,
        organizationName,
        currency,
        events: selectedEvents,
        members,
        cellMap,
        rangeLabel: dateRangeLabel,
        summary,
      };

      await exportDuesToPdf(payload);
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg">
        <Card telemetry="TREASURY.EXPORT_DUES_MODAL" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <FileText className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("treasury.dues.exportModalTitle") || "Export Dues Report (PDF)"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("treasury.dues.exportModalDesc") ||
                      `Export ${fundName} dues report with customizable cycle date ranges`}
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

          <CardContent className="pt-5 space-y-5">
            {/* Date / Cycle Range Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-primary" />
                <span>{t("treasury.dues.rangeMode") || "Due Cycle / Date Range"}</span>
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRangeMode("page")}
                  className={`p-2.5 rounded border text-center transition-all cursor-pointer text-xs ${
                    rangeMode === "page"
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
                  }`}
                >
                  <div>{t("treasury.dues.rangeCurrentPage") || "Current Page"}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {Math.min(weeksPerPage, events.length)} cycles
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRangeMode("custom")}
                  className={`p-2.5 rounded border text-center transition-all cursor-pointer text-xs ${
                    rangeMode === "custom"
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
                  }`}
                >
                  <div>{t("treasury.dues.rangeCustom") || "Custom Range"}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    Select start & end
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRangeMode("all")}
                  className={`p-2.5 rounded border text-center transition-all cursor-pointer text-xs ${
                    rangeMode === "all"
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
                  }`}
                >
                  <div>{t("treasury.dues.rangeAll") || "All Recorded"}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {events.length} cycles
                  </div>
                </button>
              </div>

              {/* Custom Range Dropdowns */}
              {rangeMode === "custom" && (
                <div className="p-3 bg-muted/20 border border-border/80 rounded space-y-3 animate-in fade-in zoom-in-95 duration-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-muted-foreground">
                        {t("treasury.dues.fromCycle") || "From Due Cycle"}
                      </label>
                      <select
                        value={fromEventIndex}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setFromEventIndex(idx);
                          if (idx > toEventIndex) {
                            setToEventIndex(idx);
                          }
                        }}
                        className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer rounded"
                      >
                        {events.map((ev, i) => (
                          <option key={ev._id} value={i}>
                            {ev.periodLabel} (
                            {new Date(ev.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            )
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-muted-foreground">
                        {t("treasury.dues.toCycle") || "To Due Cycle"}
                      </label>
                      <select
                        value={toEventIndex}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setToEventIndex(idx);
                          if (idx < fromEventIndex) {
                            setFromEventIndex(idx);
                          }
                        }}
                        className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer rounded"
                      >
                        {events.map((ev, i) => (
                          <option key={ev._id} value={i}>
                            {ev.periodLabel} (
                            {new Date(ev.dueDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            )
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Scope Summary Preview Box */}
            <div className="p-3 bg-muted/30 border border-border rounded flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-semibold text-foreground">
                    {selectedEvents.length} Due Cycle{selectedEvents.length === 1 ? "" : "s"} Selected
                  </span>
                  <span className="text-[11px] font-mono text-primary font-medium">
                    {members.length} Members
                  </span>
                </div>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {dateRangeLabel}
                </p>
                {selectedEvents.length <= 8 && (
                  <p className="text-[10px] text-emerald-400 font-mono">
                    ✓ Optimal column spacing for landscape PDF rendering
                  </p>
                )}
                {selectedEvents.length > 12 && (
                  <p className="text-[10px] text-amber-400 font-mono">
                    ⚠ Wide table: choosing a 4–8 cycle range is recommended for maximum readability.
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="dual"
                size="sm"
                onClick={onClose}
                disabled={isExporting}
                className="cursor-pointer text-xs"
              >
                {t("common.cancel") || "Cancel"}
              </Button>
              <Button
                type="button"
                variant="cyber"
                chamfer="dual"
                size="sm"
                onClick={() => {
                  void handleExport();
                }}
                disabled={isExporting || selectedEvents.length === 0}
                className="cursor-pointer text-xs flex items-center gap-1.5 min-w-[130px] justify-center"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("treasury.dues.exporting") || "Exporting..."}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("treasury.dues.downloadPdf") || "Download PDF"}</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
