import React, { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Id, Doc } from "../../../../../convex/_generated/dataModel";
import { Button, Badge } from "@boredkevin/ui";
import {
  FileSpreadsheet,
  CheckCircle,
  Download,
  Copy,
  Check,
  Share2,
  Coins,
} from "lucide-react";

export interface ParsedStudentRow {
  name: string;
  nisn: string;
  birthYear: string;
  phone: string;
  duesCount?: number;
  isValid: boolean;
  errorMsg?: string;
}

export interface ImportedBatchStudent {
  name: string;
  nisn: string;
  birthYear: string;
  phone: string;
  token: string;
  userId: Id<"users">;
}

export interface CsvImportTabProps {
  lastImportedBatch: ImportedBatchStudent[];
  onDownloadCsv: () => void;
  onCopyLink: (token: string, identifier: string) => void;
  copiedId: string | null;
  onOpenWhatsApp: (name: string, token: string, phone?: string) => void;
  availableEventsCount: number;
  selectedFundId: Id<"funds"> | null;
  setSelectedFundId: (id: Id<"funds">) => void;
  activeFunds: Doc<"funds">[];
  batchDuesCount: number;
  setBatchDuesCount: (val: number) => void;
  csvFileName: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onCsvFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  parsedStudents: ParsedStudentRow[];
  isImportingCsv: boolean;
  onImportParsedCsv: () => void;
}

export function CsvImportTab({
  lastImportedBatch,
  onDownloadCsv,
  onCopyLink,
  copiedId,
  onOpenWhatsApp,
  availableEventsCount,
  selectedFundId,
  setSelectedFundId,
  activeFunds,
  batchDuesCount,
  setBatchDuesCount,
  csvFileName,
  fileInputRef,
  onCsvFileUpload,
  parsedStudents,
  isImportingCsv,
  onImportParsedCsv,
}: CsvImportTabProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 py-2">
      {/* Post-Import Batch Summary Banner */}
      {lastImportedBatch.length > 0 && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 chamfer-dual space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" />
                <span>
                  Batch Generated: <strong>{lastImportedBatch.length}</strong> Student Registration Links
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground">
                Download the completed distribution spreadsheet or dispatch links via WhatsApp.
              </p>
            </div>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="none"
              onClick={onDownloadCsv}
              className="text-xs cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("treasury.preReg.downloadRosterLinks")}</span>
            </Button>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-border/40 border border-border/60">
            {lastImportedBatch.map((s, idx) => (
              <div
                key={idx}
                className="p-2.5 bg-background/50 flex items-center justify-between gap-2 text-xs font-mono"
              >
                <div className="truncate min-w-0">
                  <span className="font-semibold text-foreground">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">
                    ({s.phone})
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="none"
                    onClick={() => onCopyLink(s.token, `batch_${idx}`)}
                    className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                  >
                    {copiedId === `link_batch_${idx}` ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Link</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="none"
                    onClick={() => onOpenWhatsApp(s.name, s.token, s.phone)}
                    className="h-6 text-[10px] px-2 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>WA</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Batch Dues Settings */}
      <div className="p-3.5 bg-muted/30 border border-border/80 space-y-3 chamfer-dual">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-primary" />
            {t("treasury.preReg.batchDefaultDues")}
          </span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {availableEventsCount} cycles available
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("treasury.preReg.targetFund")}
            </label>
            <select
              value={selectedFundId ?? ""}
              onChange={(e) => setSelectedFundId(e.target.value as Id<"funds">)}
              className="w-full h-8 px-2 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              {activeFunds.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name} ({f.currency})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">
              {t("treasury.preReg.batchDefaultDues")}
            </label>
            <select
              value={batchDuesCount}
              onChange={(e) => setBatchDuesCount(parseInt(e.target.value, 10))}
              disabled={availableEventsCount === 0}
              className="w-full h-8 px-2 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
            >
              <option value={0}>{t("treasury.preReg.noPastDues")}</option>
              {availableEventsCount >= 1 && <option value={1}>{t("treasury.preReg.oneCycle")}</option>}
              {availableEventsCount >= 2 && <option value={2}>{t("treasury.preReg.nCycles", { count: 2 })}</option>}
              {availableEventsCount >= 3 && <option value={3}>{t("treasury.preReg.nCycles", { count: 3 })}</option>}
              {availableEventsCount > 0 && (
                <option value={availableEventsCount}>
                  {t("treasury.preReg.allCycles", { count: availableEventsCount })}
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 border-2 border-dashed border-border/80 hover:border-primary/50 transition-colors bg-muted/10 text-center space-y-2">
        <FileSpreadsheet className="w-8 h-8 text-primary mx-auto opacity-70" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground">
            {csvFileName || t("treasury.preReg.csvFile")}
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">
            {t("treasury.preReg.csvFormatHelp")}
          </p>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept=".csv,text/csv"
          onChange={onCsvFileUpload}
          className="hidden"
          id="csv-file-upload"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          chamfer="none"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs cursor-pointer"
        >
          Browse CSV File
        </Button>
      </div>

      {parsedStudents.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground">
              Parsed Rows: <strong>{parsedStudents.length}</strong> (
              <strong className="text-emerald-400">
                {parsedStudents.filter((s) => s.isValid).length} valid
              </strong>
              )
            </span>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="none"
              disabled={isImportingCsv || parsedStudents.filter((s) => s.isValid).length === 0}
              onClick={onImportParsedCsv}
              className="text-xs cursor-pointer"
            >
              {isImportingCsv
                ? t("treasury.preReg.importing")
                : `${t("treasury.preReg.importBtn")} (${parsedStudents.filter((s) => s.isValid).length})`}
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto border border-border/60">
            <table className="w-full text-xs font-mono">
              <thead className="bg-muted/40 text-[10px] text-muted-foreground sticky top-0 uppercase">
                <tr>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">NISN</th>
                  <th className="p-2 text-left">Year</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Dues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {parsedStudents.map((row, idx) => (
                  <tr
                    key={idx}
                    className={row.isValid ? "bg-background/40" : "bg-destructive/10"}
                  >
                    <td className="p-2">
                      {row.isValid ? (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        >
                          VALID
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 bg-destructive/20 text-destructive-foreground"
                        >
                          {row.errorMsg || "INVALID"}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 font-medium">{row.name}</td>
                    <td className="p-2">{row.nisn}</td>
                    <td className="p-2">{row.birthYear}</td>
                    <td className="p-2">{row.phone}</td>
                    <td className="p-2 font-semibold">
                      {row.duesCount !== undefined ? row.duesCount : batchDuesCount} cycles
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
