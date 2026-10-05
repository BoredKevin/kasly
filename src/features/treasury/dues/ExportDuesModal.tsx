import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import { Button } from "@boredkevin/ui";
import {
  Download,
  FileText,
  FileJson,
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
  exportDuesToJson,
} from "../../../lib/exportDues";

import { DuesCellItem } from "../types/dues";

interface ExportDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  fundName: string;
  organizationName?: string;
  currency?: string;
  events: DuesExportEvent[];
  members: DuesExportMember[];
  cellMap: Map<string, DuesExportCell | DuesCellItem>;
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
  const [exportFormat, setExportFormat] = useState<"pdf" | "json">("pdf");
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
    const start = Math.min(fromEventIndex, toEventIndex);
    const end = Math.max(fromEventIndex, toEventIndex);
    return events.slice(start, end + 1);
  }, [events, rangeMode, pageStartIndex, pageEndIndex, fromEventIndex, toEventIndex]);

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

  const handleExport = async (formatOverride?: "pdf" | "json") => {
    if (selectedEvents.length === 0) return;
    const format = formatOverride || exportFormat;
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

      if (format === "json") {
        exportDuesToJson(payload);
      } else {
        await exportDuesToPdf(payload);
      }
      onClose();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.dues.exportModalTitle", "Export Dues Report")}
      description={
        t("treasury.dues.exportModalDesc") ||
        `Export ${fundName} dues report with customizable cycle date ranges`
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Date / Cycle Range Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.dues.rangeMode", "Due Cycle / Date Range")}</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRangeMode("page")}
              className={`p-2.5 rounded-[var(--fintech-radius-sm)] border text-center transition-all cursor-pointer text-xs ${
                rangeMode === "page"
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div>{t("treasury.dues.rangeCurrentPage", "Current Page")}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {Math.min(weeksPerPage, events.length)} cycles
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRangeMode("custom")}
              className={`p-2.5 rounded-[var(--fintech-radius-sm)] border text-center transition-all cursor-pointer text-xs ${
                rangeMode === "custom"
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div>{t("treasury.dues.rangeCustom", "Custom Range")}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                Select start & end
              </div>
            </button>

            <button
              type="button"
              onClick={() => setRangeMode("all")}
              className={`p-2.5 rounded-[var(--fintech-radius-sm)] border text-center transition-all cursor-pointer text-xs ${
                rangeMode === "all"
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div>{t("treasury.dues.rangeAll", "All Recorded")}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {events.length} cycles
              </div>
            </button>
          </div>

          {/* Custom Range Dropdowns */}
          {rangeMode === "custom" && (
            <div className="p-3 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-sm)] space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-muted-foreground">
                    {t("treasury.dues.fromCycle", "From Due Cycle")}
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
                    className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer rounded-[var(--fintech-radius-sm)]"
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
                    {t("treasury.dues.toCycle", "To Due Cycle")}
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
                    className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer rounded-[var(--fintech-radius-sm)]"
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

        {/* Export Format Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.dues.exportFormat", "Export Format")}</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setExportFormat("pdf")}
              className={`p-2.5 rounded-[var(--fintech-radius-sm)] border text-left transition-all cursor-pointer text-xs flex items-center gap-2.5 ${
                exportFormat === "pdf"
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div className="p-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-foreground">
                  {t("treasury.dues.formatPdfTitle", "PDF Report")}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t("treasury.dues.formatPdfDesc", "Printable document (.pdf)")}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setExportFormat("json")}
              className={`p-2.5 rounded-[var(--fintech-radius-sm)] border text-left transition-all cursor-pointer text-xs flex items-center gap-2.5 ${
                exportFormat === "json"
                  ? "bg-primary/10 border-primary text-primary font-semibold"
                  : "bg-muted/20 border-border hover:border-border/80 text-muted-foreground"
              }`}
            >
              <div className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileJson className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-foreground">
                  {t("treasury.dues.formatJsonTitle", "JSON Data")}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t("treasury.dues.formatJsonDesc", "Structured payload (.json)")}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Scope Summary Preview Box */}
        <div className="p-3 bg-muted/30 border border-border rounded-[var(--fintech-radius-sm)] flex items-start gap-2.5 text-xs">
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
            <p className="text-[11px] text-muted-foreground font-mono">
              {dateRangeLabel}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            chamfer="none"
            size="sm"
            onClick={onClose}
            disabled={isExporting}
            className="cursor-pointer text-xs"
          >
            {t("common.cancel", "Cancel")}
          </Button>

          <Button
            type="button"
            variant={exportFormat === "json" ? "cyber" : "outline"}
            chamfer="none"
            size="sm"
            onClick={() => void handleExport("json")}
            disabled={isExporting || selectedEvents.length === 0}
            className="cursor-pointer text-xs flex items-center gap-1.5"
          >
            {isExporting && exportFormat === "json" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("treasury.dues.exporting", "Exporting...")}</span>
              </>
            ) : (
              <>
                <FileJson className="w-3.5 h-3.5 text-amber-400" />
                <span>JSON</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant={exportFormat === "pdf" ? "cyber" : "outline"}
            chamfer="none"
            size="sm"
            onClick={() => void handleExport("pdf")}
            disabled={isExporting || selectedEvents.length === 0}
            className="cursor-pointer text-xs flex items-center gap-1.5"
          >
            {isExporting && exportFormat === "pdf" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("treasury.dues.exporting", "Exporting...")}</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-rose-400" />
                <span>PDF</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
