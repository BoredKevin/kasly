import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  X,
  Users,
  UserPlus,
  Upload,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  Coins,
  Plus,
  Check,
} from "lucide-react";

interface PreRegistrationAdminModalProps {
  organizationId: Id<"organizations">;
  isOpen: boolean;
  onClose: () => void;
}

export function PreRegistrationAdminModal({
  organizationId,
  isOpen,
  onClose,
}: PreRegistrationAdminModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"single" | "csv" | "list">("single");

  // Fund & Dues state
  const funds = useQuery(api.treasury.funds.list, isOpen ? { organizationId } : "skip");
  const activeFunds = funds?.filter((f) => !f.isArchived) ?? [];
  const [selectedFundId, setSelectedFundId] = useState<Id<"funds"> | null>(null);

  useEffect(() => {
    if (!selectedFundId && activeFunds.length > 0) {
      setSelectedFundId(activeFunds[0]._id);
    }
  }, [activeFunds, selectedFundId]);

  const duesEvents = useQuery(
    api.treasury.dues.listDuesEvents,
    isOpen && organizationId && selectedFundId
      ? { organizationId, fundId: selectedFundId }
      : "skip",
  );

  useEffect(() => {
    if (duesEvents && duesEvents.length > 0) {
      setSingleDuesCount((prev) => (prev === 0 ? duesEvents.length : prev));
      setBatchDuesCount((prev) => (prev === 0 ? duesEvents.length : prev));
    }
  }, [duesEvents]);

  // Single form state
  const [singleName, setSingleName] = useState("");
  const [singleNisn, setSingleNisn] = useState("");
  const [singleBirthYear, setSingleBirthYear] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [singleDuesCount, setSingleDuesCount] = useState<number>(0);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);

  // CSV import state
  const [batchDuesCount, setBatchDuesCount] = useState<number>(0);
  const [parsedStudents, setParsedStudents] = useState<
    Array<{
      name: string;
      nisn: string;
      birthYear: string;
      phone: string;
      duesCount?: number;
      isValid: boolean;
      errorMsg?: string;
    }>
  >([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  // Adjust Dues Sub-Modal State
  const [adjustingUser, setAdjustingUser] = useState<{
    userId: Id<"users">;
    name: string;
  } | null>(null);

  // Status & feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Convex hooks
  const appSettings = useQuery(api.appSettings.get);
  const placeholderMembers = useQuery(
    api.preRegistration.listPlaceholderMembers,
    isOpen && organizationId ? { organizationId } : "skip",
  );

  const importRoster = useMutation(api.preRegistration.importRoster);
  const deletePlaceholder = useMutation(api.preRegistration.deletePlaceholderMember);
  const togglePreReg = useMutation(api.preRegistration.togglePreRegistration);

  if (!isOpen) return null;

  const isPreRegRequired = appSettings?.enablePreRegistration === true;
  const currentFund = funds?.find((f) => f._id === selectedFundId);
  const availableEventsCount = duesEvents?.length ?? 0;

  const handleToggleGlobalSetting = async () => {
    try {
      setErrorMessage(null);
      await togglePreReg({ enabled: !isPreRegRequired });
      setStatusMessage(
        !isPreRegRequired
          ? "Pre-registration identity requirement enabled globally."
          : "Pre-registration identity requirement disabled.",
      );
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update setting.");
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setIsSubmittingSingle(true);

    try {
      const res = await importRoster({
        organizationId,
        fundId: selectedFundId ?? undefined,
        defaultDuesCount: singleDuesCount,
        students: [
          {
            name: singleName.trim(),
            nisn: singleNisn.trim(),
            birthYear: singleBirthYear.trim(),
            phone: singlePhone.trim(),
            duesCount: singleDuesCount,
          },
        ],
      });

      if (res.insertedCount > 0) {
        setStatusMessage(
          `Successfully registered ${singleName}${
            singleDuesCount > 0
              ? ` with ${Math.min(singleDuesCount, availableEventsCount)} dues cycle(s)`
              : ""
          }.`,
        );
        setSingleName("");
        setSingleNisn("");
        setSingleBirthYear("");
        setSinglePhone("");
        setSingleDuesCount(0);
      } else if (res.skippedCount > 0) {
        setErrorMessage(`Student with NISN ${singleNisn} already exists or format was invalid.`);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to add student.");
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

        if (lines.length === 0) {
          setErrorMessage("The uploaded CSV file is empty.");
          return;
        }

        // Determine delimiter
        const header = lines[0];
        const delimiter = header.includes(";")
          ? ";"
          : header.includes("\t")
          ? "\t"
          : ",";

        const hasHeader =
          header.toLowerCase().includes("nisn") ||
          header.toLowerCase().includes("name") ||
          header.toLowerCase().includes("nama");

        const dataRows = hasHeader ? lines.slice(1) : lines;
        const results: typeof parsedStudents = [];

        for (const row of dataRows) {
          const cols = row.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
          if (cols.length < 4) continue;

          const [name, nisnVal, birthYearVal, phoneVal, duesVal] = cols;
          const isNisnValid = /^\d{10}$/.test(nisnVal);
          const isYearValid = /^\d{4}$/.test(birthYearVal);
          const isPhoneValid = Boolean(phoneVal && phoneVal.length >= 8);
          const parsedDues = duesVal && !isNaN(parseInt(duesVal, 10)) ? parseInt(duesVal, 10) : undefined;

          let errorMsg = undefined;
          if (!name) errorMsg = "Name missing";
          else if (!isNisnValid) errorMsg = "NISN must be 10 digits";
          else if (!isYearValid) errorMsg = "Year must be 4 digits";
          else if (!isPhoneValid) errorMsg = "Invalid phone number";

          results.push({
            name,
            nisn: nisnVal,
            birthYear: birthYearVal,
            phone: phoneVal,
            duesCount: parsedDues,
            isValid: !errorMsg,
            errorMsg,
          });
        }

        setParsedStudents(results);
      } catch (err: any) {
        setErrorMessage("Failed to parse CSV file: " + err?.message);
      }
    };

    reader.readAsText(file);
  };

  const handleImportParsedCsv = async () => {
    const validStudents = parsedStudents.filter((s) => s.isValid);
    if (validStudents.length === 0) {
      setErrorMessage("No valid student rows to import.");
      return;
    }

    setIsImportingCsv(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const res = await importRoster({
        organizationId,
        fundId: selectedFundId ?? undefined,
        defaultDuesCount: batchDuesCount,
        students: validStudents.map((s) => ({
          name: s.name,
          nisn: s.nisn,
          birthYear: s.birthYear,
          phone: s.phone,
          duesCount: s.duesCount ?? batchDuesCount,
        })),
      });

      setStatusMessage(
        `Import complete: ${res.insertedCount} students added, ${res.skippedCount} duplicates/invalid skipped.`,
      );
      setParsedStudents([]);
      setCsvFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to import student roster.");
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleDeletePlaceholder = async (userId: Id<"users">) => {
    if (!window.confirm(t("treasury.preReg.deleteConfirm"))) {
      return;
    }

    try {
      setErrorMessage(null);
      await deletePlaceholder({ organizationId, userId });
      setStatusMessage("Pre-registered student removed.");
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to delete student.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <Card
        telemetry="TREASURY.PRE_REG_MODAL"
        cornerLines
        className="w-full max-w-3xl bg-card border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <CardHeader className="pb-4 border-b border-border/80 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 border border-primary/20 text-primary">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {t("treasury.preReg.title")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("treasury.preReg.description")}
              </CardDescription>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        {/* Global Toggle Header Banner */}
        <div className="bg-muted/30 border-b border-border/60 p-4 flex items-center justify-between shrink-0">
          <div className="space-y-0.5 max-w-md">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {t("treasury.preReg.enablePreReg")}
              {isPreRegRequired ? (
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase font-mono bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                >
                  ACTIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  DISABLED
                </Badge>
              )}
            </span>
            <p className="text-[11px] text-muted-foreground">
              {t("treasury.preReg.enablePreRegDesc")}
            </p>
          </div>

          <Button
            type="button"
            variant={isPreRegRequired ? "cyber" : "outline"}
            size="sm"
            chamfer="dual"
            onClick={handleToggleGlobalSetting}
            className="text-xs cursor-pointer gap-1.5 shrink-0"
          >
            {isPreRegRequired ? (
              <>
                <ToggleRight className="w-4 h-4" />
                <span>Enabled</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>Disabled</span>
              </>
            )}
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/60 shrink-0 bg-background/50 px-4 pt-2 gap-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "single"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t("treasury.preReg.manualTab")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("csv")}
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "csv"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t("treasury.preReg.csvTab")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "list"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>
              {t("treasury.preReg.listTab")} ({placeholderMembers ? placeholderMembers.length : 0})
            </span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <CardContent className="p-6 overflow-y-auto space-y-4 flex-1">
          {statusMessage && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: Single Student Form */}
          {activeTab === "single" && (
            <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-lg mx-auto py-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("treasury.preReg.studentName")}
                </label>
                <Input
                  type="text"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  placeholder="e.g. Kevin Sanjaya"
                  chamfer="dual"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {t("treasury.preReg.nisn")}
                  </label>
                  <Input
                    type="text"
                    value={singleNisn}
                    onChange={(e) => setSingleNisn(e.target.value)}
                    placeholder="10 numeric digits"
                    maxLength={10}
                    chamfer="dual"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {t("treasury.preReg.birthYear")}
                  </label>
                  <Input
                    type="text"
                    value={singleBirthYear}
                    onChange={(e) => setSingleBirthYear(e.target.value)}
                    placeholder="e.g. 2008"
                    maxLength={4}
                    chamfer="dual"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("treasury.preReg.phone")}
                </label>
                <Input
                  type="tel"
                  value={singlePhone}
                  onChange={(e) => setSinglePhone(e.target.value)}
                  placeholder="e.g. 08123456789"
                  chamfer="dual"
                  required
                />
              </div>

              {/* DUES ASSIGNMENT SECTION */}
              <div className="p-3.5 bg-muted/30 border border-border/80 space-y-3 chamfer-dual mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-primary" />
                    {t("treasury.preReg.assignPastDues")}
                  </span>
                  {availableEventsCount > 0 ? (
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {availableEventsCount} {t("treasury.preReg.nCycles", { count: availableEventsCount })} available
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                      0 cycles
                    </Badge>
                  )}
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
                      {t("treasury.preReg.assignPastDues")}
                    </label>
                    <select
                      value={singleDuesCount}
                      onChange={(e) => setSingleDuesCount(parseInt(e.target.value, 10))}
                      disabled={availableEventsCount === 0}
                      className="w-full h-8 px-2 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                    >
                      <option value={0}>{t("treasury.preReg.noPastDues")}</option>
                      {availableEventsCount >= 1 && <option value={1}>{t("treasury.preReg.oneCycle")}</option>}
                      {availableEventsCount >= 2 && <option value={2}>{t("treasury.preReg.nCycles", { count: 2 })}</option>}
                      {availableEventsCount >= 3 && <option value={3}>{t("treasury.preReg.nCycles", { count: 3 })}</option>}
                      {availableEventsCount >= 4 && <option value={4}>{t("treasury.preReg.nCycles", { count: 4 })}</option>}
                      {availableEventsCount >= 5 && <option value={5}>{t("treasury.preReg.nCycles", { count: 5 })}</option>}
                      {availableEventsCount > 0 && (
                        <option value={availableEventsCount}>
                          {t("treasury.preReg.allCycles", { count: availableEventsCount })}
                        </option>
                      )}
                    </select>
                  </div>
                </div>

                {singleDuesCount > 0 && duesEvents && (
                  <div className="p-2 bg-primary/10 border border-primary/30 text-[11px] font-mono text-primary flex items-center justify-between">
                    <span>
                      {t("treasury.preReg.duesPreview", {
                        count: Math.min(singleDuesCount, availableEventsCount),
                        amount: `${currentFund?.currency || "IDR"} ${(
                          duesEvents
                            .slice(0, singleDuesCount)
                            .reduce((sum, ev) => sum + ev.amount, 0)
                        ).toLocaleString()}`,
                      })}
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="cyber"
                chamfer="dual"
                disabled={isSubmittingSingle}
                className="w-full mt-3 cursor-pointer"
              >
                {isSubmittingSingle
                  ? t("treasury.preReg.adding")
                  : t("treasury.preReg.addStudentBtn")}
              </Button>
            </form>
          )}

          {/* TAB 2: CSV Roster Ingestion */}
          {activeTab === "csv" && (
            <div className="space-y-4 py-2">
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
                  onChange={handleCsvFileUpload}
                  className="hidden"
                  id="csv-file-upload"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
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
                      chamfer="dual"
                      disabled={isImportingCsv || parsedStudents.filter((s) => s.isValid).length === 0}
                      onClick={handleImportParsedCsv}
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
          )}

          {/* TAB 3: Unclaimed Placeholder List */}
          {activeTab === "list" && (
            <div className="space-y-3 py-2">
              {placeholderMembers === undefined ? (
                <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
                  {t("common.loading")}
                </div>
              ) : placeholderMembers.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-muted-foreground">
                  {t("treasury.preReg.noPlaceholders")}
                </div>
              ) : (
                <div className="border border-border/60 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40 text-[10px] font-mono text-muted-foreground uppercase border-b border-border/60">
                      <tr>
                        <th className="p-2.5 text-left">Student Name</th>
                        <th className="p-2.5 text-left">Added Date</th>
                        <th className="p-2.5 text-left">Unpaid Dues</th>
                        <th className="p-2.5 text-left">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {placeholderMembers.map((member) => (
                        <tr key={member.memberId} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-semibold text-foreground">{member.name}</td>
                          <td className="p-2.5 text-muted-foreground">
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </td>
                          <td className="p-2.5">
                            {member.unpaidCyclesCount > 0 ? (
                              <span className="text-amber-400 font-bold">
                                {member.unpaidCyclesCount} cycles (Rp{" "}
                                {member.unpaidAmount.toLocaleString()})
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0 cycles</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1.5 py-0 border-amber-500/40 text-amber-300 bg-amber-500/10 font-bold"
                            >
                              UNCLAIMED
                            </Badge>
                          </td>
                          <td className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                chamfer="dual"
                                onClick={() =>
                                  setAdjustingUser({
                                    userId: member.userId,
                                    name: member.name,
                                  })
                                }
                                className="h-6 text-[10px] px-2 text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-1"
                              >
                                <Coins className="w-3 h-3" />
                                <span>{t("treasury.preReg.adjustDuesBtn")}</span>
                              </Button>

                              <button
                                type="button"
                                onClick={() => handleDeletePlaceholder(member.userId)}
                                className="text-destructive hover:bg-destructive/15 p-1 rounded transition-colors cursor-pointer"
                                title="Delete placeholder student"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ADJUST DUES SUB-MODAL */}
      {adjustingUser && (
        <AdjustDuesSubModal
          organizationId={organizationId}
          userId={adjustingUser.userId}
          studentName={adjustingUser.name}
          onClose={() => setAdjustingUser(null)}
        />
      )}
    </div>
  );
}

interface AdjustDuesSubModalProps {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  studentName: string;
  onClose: () => void;
}

function AdjustDuesSubModal({
  organizationId,
  userId,
  studentName,
  onClose,
}: AdjustDuesSubModalProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const duesData = useQuery(api.preRegistration.getPlaceholderMemberDues, {
    organizationId,
    userId,
  });

  const assignCycle = useMutation(api.preRegistration.assignPlaceholderDuesCycle);
  const removeCycle = useMutation(api.preRegistration.removePlaceholderDuesCycle);
  const togglePayment = useMutation(api.preRegistration.togglePlaceholderDuesPayment);

  const handleAssign = async (duesEventId: Id<"duesEvents">) => {
    setError(null);
    setSuccess(null);
    try {
      await assignCycle({ organizationId, userId, duesEventId });
      setSuccess("Dues cycle assigned.");
    } catch (err: any) {
      setError(err?.message || "Failed to assign cycle.");
    }
  };

  const handleRemove = async (membershipId: Id<"duesMemberships">) => {
    setError(null);
    setSuccess(null);
    try {
      await removeCycle({ organizationId, membershipId });
      setSuccess("Dues cycle removed.");
    } catch (err: any) {
      setError(err?.message || "Failed to remove cycle.");
    }
  };

  const handleTogglePaid = async (membershipId: Id<"duesMemberships">) => {
    setError(null);
    setSuccess(null);
    try {
      const isPaid = await togglePayment({ organizationId, membershipId });
      setSuccess(isPaid ? "Marked as Paid." : "Marked as Unpaid.");
    } catch (err: any) {
      setError(err?.message || "Failed to update payment status.");
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <Card
        telemetry="TREASURY.ADJUST_DUES_MODAL"
        cornerLines
        className="w-full max-w-xl bg-card border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <CardHeader className="pb-3 border-b border-border/80 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-semibold">
                {t("treasury.preReg.adjustDuesTitle", { name: studentName })}
              </CardTitle>
              <CardDescription className="text-xs font-mono">
                {t("treasury.preReg.totalOwed")}:{" "}
                <strong className="text-amber-400 font-bold">
                  Rp {duesData?.totalUnpaidAmount.toLocaleString() ?? 0}
                </strong>
              </CardDescription>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        <CardContent className="p-5 overflow-y-auto space-y-4 flex-1">
          {success && (
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Enrolled Cycles */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
              {t("treasury.preReg.enrolledCycles")} ({duesData?.enrolled.length ?? 0})
            </h4>

            {duesData === undefined ? (
              <div className="py-4 text-center text-xs font-mono text-muted-foreground animate-pulse">
                {t("common.loading")}
              </div>
            ) : duesData.enrolled.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono py-2">
                {t("treasury.preReg.noEnrolledCycles")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {duesData.enrolled.map((cycle) => (
                  <div
                    key={cycle.membershipId}
                    className="p-3 bg-muted/20 border border-border/60 flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {cycle.periodLabel}
                        </span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {cycle.fundName}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {cycle.currency} {cycle.amount.toLocaleString()} • Due:{" "}
                        {new Date(cycle.dueDate).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant={cycle.hasPaid ? "cyber" : "outline"}
                        size="sm"
                        chamfer="dual"
                        onClick={() => handleTogglePaid(cycle.membershipId)}
                        className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                      >
                        {cycle.hasPaid ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>PAID</span>
                          </>
                        ) : (
                          <span>UNPAID</span>
                        )}
                      </Button>

                      <button
                        type="button"
                        onClick={() => handleRemove(cycle.membershipId)}
                        className="text-destructive hover:bg-destructive/15 p-1 rounded transition-colors cursor-pointer"
                        title={t("treasury.preReg.removeBtn")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Available Cycles to Assign */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
              {t("treasury.preReg.availableCycles")} ({duesData?.available.length ?? 0})
            </h4>

            {duesData && duesData.available.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono py-2">
                {t("treasury.preReg.noAvailableCycles")}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {duesData?.available.map((ev) => (
                  <div
                    key={ev.duesEventId}
                    className="p-2.5 bg-background/50 border border-border/40 flex items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {ev.periodLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({ev.fundName})
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-muted-foreground">
                        {ev.currency} {ev.amount.toLocaleString()}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="cyber"
                      size="sm"
                      chamfer="dual"
                      onClick={() => handleAssign(ev.duesEventId)}
                      className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{t("treasury.preReg.assignBtn")}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
