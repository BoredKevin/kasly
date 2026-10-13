import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import { Button, Badge } from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import {
  Users,
  UserPlus,
  Upload,
  CheckCircle,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  MessageSquareText,
} from "lucide-react";

import {
  DEFAULT_WA_TEMPLATE,
  SHORT_WA_TEMPLATE,
  ENGLISH_WA_TEMPLATE,
  getRegistrationUrl,
  normalizePhoneNumberClient,
  formatWhatsAppMessage,
} from "./preRegistration/preRegistrationUtils";
import { SingleStudentTab } from "./preRegistration/SingleStudentTab";
import {
  CsvImportTab,
  ParsedStudentRow,
  ImportedBatchStudent,
} from "./preRegistration/CsvImportTab";
import { MemberListTab } from "./preRegistration/MemberListTab";
import { WhatsAppTemplatesTab } from "./preRegistration/WhatsAppTemplatesTab";
import { AdjustDuesSubModal } from "./preRegistration/AdjustDuesSubModal";

interface PreRegistrationAdminModalProps {
  organizationId: Id<"organizations">;
  isOpen: boolean;
  onClose: () => void;
  initialFundId?: Id<"funds"> | null;
}

export function PreRegistrationAdminModal({
  organizationId,
  isOpen,
  onClose,
  initialFundId,
}: PreRegistrationAdminModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"single" | "csv" | "list" | "templates">("single");

  // Organization & Funds
  const org = useQuery(
    api.organizations.get,
    isOpen && organizationId ? { organizationId } : "skip",
  );
  const orgName = org?.name || "Cravion Class";

  const funds = useQuery(api.treasury.funds.list, isOpen ? { organizationId } : "skip");
  const activeFunds = useMemo<Doc<"funds">[]>(() => funds?.filter((f: Doc<"funds">) => !f.isArchived) ?? [], [funds]);
  const [selectedFundId, setSelectedFundId] = useState<Id<"funds"> | null>(initialFundId ?? null);

  useEffect(() => {
    if (isOpen) {
      if (initialFundId && activeFunds.some((f) => f._id === initialFundId)) {
        setSelectedFundId(initialFundId);
      } else if (activeFunds.length > 0) {
        setSelectedFundId((prev) =>
          prev && activeFunds.some((f) => f._id === prev) ? prev : activeFunds[0]._id
        );
      }
    }
  }, [isOpen, initialFundId, activeFunds]);

  const duesEvents = useQuery(
    api.treasury.dues.listDuesEvents,
    isOpen && organizationId && selectedFundId
      ? { organizationId, fundId: selectedFundId }
      : "skip",
  );

  // Single form state
  const [singleName, setSingleName] = useState("");
  const [singleNisn, setSingleNisn] = useState("");
  const [singleBirthYear, setSingleBirthYear] = useState("");
  const [singlePhone, setSinglePhone] = useState("");
  const [singleDuesCount, setSingleDuesCount] = useState<number>(0);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [lastAddedStudent, setLastAddedStudent] = useState<{
    name: string;
    token: string;
    phone: string;
  } | null>(null);

  // CSV import state
  const [batchDuesCount, setBatchDuesCount] = useState<number>(0);

  useEffect(() => {
    if (duesEvents && duesEvents.length > 0) {
      setSingleDuesCount((prev) => (prev === 0 ? duesEvents.length : prev));
      setBatchDuesCount((prev) => (prev === 0 ? duesEvents.length : prev));
    }
  }, [duesEvents]);

  const [parsedStudents, setParsedStudents] = useState<ParsedStudentRow[]>([]);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [lastImportedBatch, setLastImportedBatch] = useState<ImportedBatchStudent[]>([]);

  // WhatsApp template settings
  const [activeTemplatePreset, setActiveTemplatePreset] = useState<
    "standard" | "short" | "english" | "custom"
  >("standard");
  const [customTemplateText, setCustomTemplateText] = useState(DEFAULT_WA_TEMPLATE);

  const getEffectiveTemplate = () => {
    if (activeTemplatePreset === "short") return SHORT_WA_TEMPLATE;
    if (activeTemplatePreset === "english") return ENGLISH_WA_TEMPLATE;
    if (activeTemplatePreset === "custom") return customTemplateText;
    return DEFAULT_WA_TEMPLATE;
  };

  // Adjust Dues Sub-Modal State
  const [adjustingUser, setAdjustingUser] = useState<{
    userId: Id<"users">;
    name: string;
  } | null>(null);

  // Status & feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Convex hooks
  const appSettings = useQuery(api.appSettings.get);
  const placeholderMembers = useQuery(
    api.preRegistration.listPlaceholderMembers,
    isOpen && organizationId ? { organizationId } : "skip",
  );

  const importRoster = useMutation(api.preRegistration.importRoster);
  const deletePlaceholder = useMutation(api.preRegistration.deletePlaceholderMember);
  const togglePreReg = useMutation(api.preRegistration.togglePreRegistration);
  const toggleRegLinks = useMutation(api.preRegistration.toggleRegistrationLinks);
  const regenerateLink = useMutation(api.preRegistration.regenerateRegistrationLink);

  if (!isOpen) return null;

  const isPreRegRequired = appSettings?.enablePreRegistration === true;
  const isRegLinksEnabled = appSettings?.enableRegistrationLinks !== false;
  const currentFund = funds?.find((f) => f._id === selectedFundId);
  const availableEventsCount = duesEvents?.length ?? 0;

  const formatWhatsApp = (studentName: string, token: string) => {
    return formatWhatsAppMessage({
      studentName,
      token,
      orgName,
      templateText: getEffectiveTemplate(),
    });
  };

  const handleCopyRegistrationLink = async (token: string, identifier: string) => {
    try {
      const url = getRegistrationUrl(token);
      await navigator.clipboard.writeText(url);
      setCopiedId(`link_${identifier}`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setErrorMessage("Failed to copy link to clipboard.");
    }
  };

  const handleCopyWhatsAppMessage = async (
    studentName: string,
    token: string,
    identifier: string,
  ) => {
    try {
      const message = formatWhatsApp(studentName, token);
      await navigator.clipboard.writeText(message);
      setCopiedId(`wa_${identifier}`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setErrorMessage("Failed to copy WhatsApp message to clipboard.");
    }
  };

  const handleOpenWhatsAppShare = (
    studentName: string,
    token: string,
    phone?: string,
  ) => {
    const message = formatWhatsApp(studentName, token);
    const encoded = encodeURIComponent(message);
    const cleanPhone = normalizePhoneNumberClient(phone);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleToggleGlobalSetting = async () => {
    try {
      setErrorMessage(null);
      await togglePreReg({ enabled: !isPreRegRequired });
      setStatusMessage(
        !isPreRegRequired
          ? "Pre-registration identity requirement enabled globally."
          : "Pre-registration identity requirement disabled.",
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update setting.");
    }
  };

  const handleToggleRegistrationLinksSetting = async () => {
    try {
      setErrorMessage(null);
      await toggleRegLinks({ enabled: !isRegLinksEnabled });
      setStatusMessage(
        !isRegLinksEnabled
          ? "Personalized registration links enabled."
          : "Registration links disabled.",
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update setting.");
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);
    setLastAddedStudent(null);
    setIsSubmittingSingle(true);

    const candidateName = singleName.trim();
    const candidatePhone = singlePhone.trim();

    try {
      const res = await importRoster({
        organizationId,
        fundId: selectedFundId ?? undefined,
        defaultDuesCount: singleDuesCount,
        students: [
          {
            name: candidateName,
            nisn: singleNisn.trim(),
            birthYear: singleBirthYear.trim(),
            phone: candidatePhone,
            duesCount: singleDuesCount,
          },
        ],
      });

      if (res.insertedCount > 0 && res.insertedStudents && res.insertedStudents.length > 0) {
        const created = res.insertedStudents[0];
        setLastAddedStudent({
          name: created.name,
          token: created.token,
          phone: created.phone,
        });

        setStatusMessage(
          `Successfully registered ${candidateName}${
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
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to add student.");
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setStatusMessage(null);
    setLastImportedBatch([]);
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
        const results: ParsedStudentRow[] = [];

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
      } catch (err: unknown) {
        setErrorMessage("Failed to parse CSV file: " + (err instanceof Error ? err.message : String(err)));
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
    setLastImportedBatch([]);

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

      if (res.insertedStudents && res.insertedStudents.length > 0) {
        setLastImportedBatch(res.insertedStudents);
      }

      setParsedStudents([]);
      setCsvFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to import student roster.");
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleDownloadImportedBatchCsv = () => {
    if (lastImportedBatch.length === 0) return;

    const headers = ["Name", "NISN", "BirthYear", "Phone", "RegistrationLink"];
    const rows = lastImportedBatch.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.nisn}"`,
      `"${s.birthYear}"`,
      `"${s.phone}"`,
      `"${getRegistrationUrl(s.token)}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `roster_registration_links_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportUnclaimedRosterCsv = () => {
    if (!placeholderMembers || placeholderMembers.length === 0) return;

    const headers = [
      "StudentName",
      "RegistrationLink",
      "DateAdded",
      "UnpaidCyclesCount",
      "UnpaidAmount",
      "Status",
    ];

    const rows = placeholderMembers.map((m) => [
      `"${m.name.replace(/"/g, '""')}"`,
      `"${m.registrationToken ? getRegistrationUrl(m.registrationToken) : ""}"`,
      `"${new Date(m.joinedAt).toLocaleDateString()}"`,
      m.unpaidCyclesCount,
      m.unpaidAmount,
      "UNCLAIMED",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `unclaimed_students_links_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRegenerateStudentLink = async (userId: Id<"users">, name: string) => {
    if (!window.confirm(t("treasury.preReg.regenerateConfirm"))) {
      return;
    }

    try {
      setErrorMessage(null);
      const newToken = await regenerateLink({ organizationId, userId });
      setStatusMessage(`${t("treasury.preReg.linkRegenerated")} (${name})`);
      setCopiedId(`link_${userId}`);
      await navigator.clipboard.writeText(getRegistrationUrl(newToken));
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to regenerate link.");
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
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to delete student.");
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.preReg.title", "Student Pre-Registration")}
      description={t("treasury.preReg.description", "Manage pre-registered roster, import data, and share registration links.")}
      maxWidth="2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Global Controls & Toggles Header Banner */}
        <div className="bg-muted/30 border border-border/60 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 rounded-[var(--fintech-radius-sm)]">
          <div className="space-y-1 max-w-sm">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              {t("treasury.preReg.enableRegLinks")}
              {isRegLinksEnabled ? (
                <Badge
                  variant="secondary"
                  className="text-[9px] uppercase font-mono bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                >
                  ACTIVE
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] uppercase font-mono">
                  DISABLED
                </Badge>
              )}
            </span>
            <p className="text-[10px] text-muted-foreground">
              {t("treasury.preReg.enableRegLinksDesc")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant={isRegLinksEnabled ? "cyber" : "outline"}
              size="sm"
              chamfer="none"
              onClick={handleToggleRegistrationLinksSetting}
              className="text-xs cursor-pointer gap-1.5 h-7"
            >
              {isRegLinksEnabled ? (
                <>
                  <ToggleRight className="w-3.5 h-3.5" />
                  <span>Links: On</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-3.5 h-3.5" />
                  <span>Links: Off</span>
                </>
              )}
            </Button>

            <Button
              type="button"
              variant={isPreRegRequired ? "cyber" : "outline"}
              size="sm"
              chamfer="none"
              onClick={handleToggleGlobalSetting}
              className="text-xs cursor-pointer gap-1.5 h-7"
            >
              {isPreRegRequired ? (
                <>
                  <ToggleRight className="w-3.5 h-3.5" />
                  <span>PreReg Gate: On</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-3.5 h-3.5" />
                  <span>PreReg Gate: Off</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border/60 shrink-0 bg-background/50 px-4 pt-2 gap-2 text-xs font-medium overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
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
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
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
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
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

          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`pb-2 px-3 border-b-2 font-mono transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "templates"
                ? "border-primary text-primary font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>WhatsApp Template</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 pt-2">
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
            <SingleStudentTab
              singleName={singleName}
              setSingleName={setSingleName}
              singleNisn={singleNisn}
              setSingleNisn={setSingleNisn}
              singleBirthYear={singleBirthYear}
              setSingleBirthYear={setSingleBirthYear}
              singlePhone={singlePhone}
              setSinglePhone={setSinglePhone}
              singleDuesCount={singleDuesCount}
              setSingleDuesCount={setSingleDuesCount}
              selectedFundId={selectedFundId}
              setSelectedFundId={setSelectedFundId}
              activeFunds={activeFunds}
              currentFund={currentFund}
              duesEvents={duesEvents}
              availableEventsCount={availableEventsCount}
              isSubmittingSingle={isSubmittingSingle}
              onSubmit={handleSingleSubmit}
              lastAddedStudent={lastAddedStudent}
              copiedId={copiedId}
              onCopyLink={handleCopyRegistrationLink}
              onCopyWhatsApp={handleCopyWhatsAppMessage}
              onOpenWhatsApp={handleOpenWhatsAppShare}
            />
          )}

          {/* TAB 2: CSV Roster Ingestion */}
          {activeTab === "csv" && (
            <CsvImportTab
              lastImportedBatch={lastImportedBatch}
              onDownloadCsv={handleDownloadImportedBatchCsv}
              onCopyLink={handleCopyRegistrationLink}
              copiedId={copiedId}
              onOpenWhatsApp={handleOpenWhatsAppShare}
              availableEventsCount={availableEventsCount}
              selectedFundId={selectedFundId}
              setSelectedFundId={setSelectedFundId}
              activeFunds={activeFunds}
              batchDuesCount={batchDuesCount}
              setBatchDuesCount={setBatchDuesCount}
              csvFileName={csvFileName}
              fileInputRef={fileInputRef}
              onCsvFileUpload={handleCsvFileUpload}
              parsedStudents={parsedStudents}
              isImportingCsv={isImportingCsv}
              onImportParsedCsv={handleImportParsedCsv}
            />
          )}

          {/* TAB 3: Unclaimed Placeholder List */}
          {activeTab === "list" && (
            <MemberListTab
              placeholderMembers={placeholderMembers}
              onExportCsv={handleExportUnclaimedRosterCsv}
              copiedId={copiedId}
              onCopyLink={handleCopyRegistrationLink}
              onCopyWhatsApp={handleCopyWhatsAppMessage}
              onOpenWhatsApp={handleOpenWhatsAppShare}
              onRegenerateLink={handleRegenerateStudentLink}
              onAdjustDues={setAdjustingUser}
              onDeletePlaceholder={handleDeletePlaceholder}
            />
          )}

          {/* TAB 4: WhatsApp Message Template Customizer */}
          {activeTab === "templates" && (
            <WhatsAppTemplatesTab
              activeTemplatePreset={activeTemplatePreset}
              setActiveTemplatePreset={setActiveTemplatePreset}
              customTemplateText={customTemplateText}
              setCustomTemplateText={setCustomTemplateText}
              orgName={orgName}
              formatWhatsAppMessage={formatWhatsApp}
            />
          )}
        </div>
      </div>

      {/* ADJUST DUES SUB-MODAL */}
      {adjustingUser && (
        <AdjustDuesSubModal
          organizationId={organizationId}
          userId={adjustingUser.userId}
          studentName={adjustingUser.name}
          onClose={() => setAdjustingUser(null)}
        />
      )}
    </ResponsiveDialog>
  );
}
