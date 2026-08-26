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
  Link,
  Copy,
  MessageCircle,
  RefreshCw,
  Download,
  Share2,
  ExternalLink,
  MessageSquareText,
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

  const [activeTab, setActiveTab] = useState<"single" | "csv" | "list" | "templates">("single");

  // Organization & Funds
  const org = useQuery(
    api.organizations.get,
    isOpen && organizationId ? { organizationId } : "skip",
  );
  const orgName = org?.name || "Cravion Class";

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
  const [lastAddedStudent, setLastAddedStudent] = useState<{
    name: string;
    token: string;
    phone: string;
  } | null>(null);

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
  const [lastImportedBatch, setLastImportedBatch] = useState<
    Array<{
      name: string;
      nisn: string;
      birthYear: string;
      phone: string;
      token: string;
      userId: Id<"users">;
    }>
  >([]);

  // WhatsApp template settings
  const DEFAULT_WA_TEMPLATE =
    "{regLink}\n\nKlik link diatas untuk masuk {orgName} di platform Kasly. Dari platform ini, kamu bisa melihat tunggakan kas, serta buku besar/histori pengeluaran kas kelas melalui Ledger.\n\nDaftar dengan mengisi NISN, tahun lahir, serta nomor handphone, lalu masukkan email dan password, jangan dilupakan ya!";
  const SHORT_WA_TEMPLATE =
    "Halo {name}! Silakan klaim akun kamu di {orgName} melalui tautan pendaftaran berikut: {regLink}\n\nMasukkan NISN, tahun lahir, dan no. HP untuk verifikasi.";
  const ENGLISH_WA_TEMPLATE =
    "Hello {name}! Claim your account in {orgName} on Kasly: {regLink}\n\nVerify with your NISN, birth year, and phone number to activate your account.";

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

  const getRegistrationUrl = (token: string) => {
    return `${window.location.origin}/claim?token=${token}`;
  };

  const formatWhatsAppMessage = (studentName: string, token: string) => {
    const template = getEffectiveTemplate();
    const regUrl = getRegistrationUrl(token);
    return template
      .replace(/{name}/g, studentName)
      .replace(/{orgName}/g, orgName)
      .replace(/{regLink}/g, regUrl);
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
      const message = formatWhatsAppMessage(studentName, token);
      await navigator.clipboard.writeText(message);
      setCopiedId(`wa_${identifier}`);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setErrorMessage("Failed to copy WhatsApp message to clipboard.");
    }
  };

  const normalizePhoneNumberClient = (phone?: string) => {
    if (!phone) return "";
    let digits = phone.replace(/\D/g, "").trim();
    if (digits.startsWith("08")) {
      digits = "62" + digits.slice(1);
    } else if (digits.startsWith("8")) {
      digits = "62" + digits;
    } else if (digits.startsWith("6208")) {
      digits = "62" + digits.slice(3);
    }
    return digits;
  };

  const handleOpenWhatsAppShare = (
    studentName: string,
    token: string,
    phone?: string,
  ) => {
    const message = formatWhatsAppMessage(studentName, token);
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
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update setting.");
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
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update setting.");
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
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to import student roster.");
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
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to regenerate link.");
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
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>

        {/* Global Controls & Toggles Header Banner */}
        <div className="bg-muted/30 border-b border-border/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
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
              chamfer="dual"
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
              chamfer="dual"
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
            <div className="space-y-4 max-w-lg mx-auto py-2">
              {/* Last Added Student Registration Link Card */}
              {lastAddedStudent && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 chamfer-dual space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5" />
                      {t("treasury.preReg.singleLinkCreated")}: {lastAddedStudent.name}
                    </span>
                    <Badge variant="secondary" className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300">
                      READY TO SEND
                    </Badge>
                  </div>

                  <div className="p-2 bg-background/70 border border-border/60 text-xs font-mono text-foreground truncate select-all">
                    {getRegistrationUrl(lastAddedStudent.token)}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="cyber"
                      size="sm"
                      chamfer="dual"
                      onClick={() => handleCopyRegistrationLink(lastAddedStudent.token, "single_post")}
                      className="text-xs h-7 cursor-pointer flex items-center gap-1"
                    >
                      {copiedId === "link_single_post" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>{t("treasury.preReg.linkCopied")}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>{t("treasury.preReg.copyLink")}</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="dual"
                      onClick={() =>
                        handleCopyWhatsAppMessage(
                          lastAddedStudent.name,
                          lastAddedStudent.token,
                          "single_post",
                        )
                      }
                      className="text-xs h-7 cursor-pointer flex items-center gap-1"
                    >
                      {copiedId === "wa_single_post" ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>{t("treasury.preReg.waCopied")}</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-3 h-3 text-emerald-400" />
                          <span>{t("treasury.preReg.copyWa")}</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="dual"
                      onClick={() =>
                        handleOpenWhatsAppShare(
                          lastAddedStudent.name,
                          lastAddedStudent.token,
                          lastAddedStudent.phone,
                        )
                      }
                      className="text-xs h-7 cursor-pointer flex items-center gap-1 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>{t("treasury.preReg.openWa")}</span>
                    </Button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSingleSubmit} className="space-y-4">
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
            </div>
          )}

          {/* TAB 2: CSV Roster Ingestion */}
          {activeTab === "csv" && (
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
                      chamfer="dual"
                      onClick={handleDownloadImportedBatchCsv}
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
                            chamfer="dual"
                            onClick={() => handleCopyRegistrationLink(s.token, `batch_${idx}`)}
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
                            chamfer="dual"
                            onClick={() => handleOpenWhatsAppShare(s.name, s.token, s.phone)}
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-mono text-muted-foreground">
                  Unclaimed Records: <strong>{placeholderMembers?.length ?? 0}</strong>
                </span>

                {placeholderMembers && placeholderMembers.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={handleExportUnclaimedRosterCsv}
                    className="text-xs cursor-pointer flex items-center gap-1.5 h-7"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("treasury.preReg.exportLinksCsv")}</span>
                  </Button>
                )}
              </div>

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
                        <th className="p-2.5 text-left">Registration Link</th>
                        <th className="p-2.5 text-left">Unpaid Dues</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono">
                      {placeholderMembers.map((member) => (
                        <tr key={member.memberId} className="hover:bg-muted/20 transition-colors">
                          <td className="p-2.5 font-semibold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span>{member.name}</span>
                              <Badge
                                variant="outline"
                                className="text-[8px] px-1 py-0 border-amber-500/40 text-amber-300 bg-amber-500/10 font-bold"
                              >
                                UNCLAIMED
                              </Badge>
                            </div>
                          </td>

                          <td className="p-2.5">
                            {member.registrationToken ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  chamfer="dual"
                                  onClick={() =>
                                    handleCopyRegistrationLink(
                                      member.registrationToken!,
                                      member.memberId,
                                    )
                                  }
                                  className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                                >
                                  {copiedId === `link_${member.memberId}` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>{t("treasury.preReg.linkCopied")}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>{t("treasury.preReg.copyLink")}</span>
                                    </>
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  chamfer="dual"
                                  onClick={() =>
                                    handleCopyWhatsAppMessage(
                                      member.name,
                                      member.registrationToken!,
                                      member.memberId,
                                    )
                                  }
                                  className="h-6 text-[10px] px-1.5 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                  title={t("treasury.preReg.copyWa")}
                                >
                                  {copiedId === `wa_${member.memberId}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <MessageCircle className="w-3 h-3" />
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  chamfer="dual"
                                  onClick={() =>
                                    handleOpenWhatsAppShare(
                                      member.name,
                                      member.registrationToken!,
                                    )
                                  }
                                  className="h-6 text-[10px] px-1.5 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                                  title={t("treasury.preReg.openWa")}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRegenerateStudentLink(
                                      member.userId,
                                      member.name,
                                    )
                                  }
                                  className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors cursor-pointer ml-1"
                                  title={t("treasury.preReg.regenerateLink")}
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-[10px]">No token</span>
                            )}
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

          {/* TAB 4: WhatsApp Message Template Customizer */}
          {activeTab === "templates" && (
            <div className="space-y-4 py-2 max-w-lg mx-auto">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  {t("treasury.preReg.waTemplateSection")}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button
                    type="button"
                    variant={activeTemplatePreset === "standard" ? "cyber" : "outline"}
                    size="sm"
                    chamfer="dual"
                    onClick={() => setActiveTemplatePreset("standard")}
                    className="text-xs h-7 cursor-pointer"
                  >
                    Standard
                  </Button>
                  <Button
                    type="button"
                    variant={activeTemplatePreset === "short" ? "cyber" : "outline"}
                    size="sm"
                    chamfer="dual"
                    onClick={() => setActiveTemplatePreset("short")}
                    className="text-xs h-7 cursor-pointer"
                  >
                    Short
                  </Button>
                  <Button
                    type="button"
                    variant={activeTemplatePreset === "english" ? "cyber" : "outline"}
                    size="sm"
                    chamfer="dual"
                    onClick={() => setActiveTemplatePreset("english")}
                    className="text-xs h-7 cursor-pointer"
                  >
                    English
                  </Button>
                  <Button
                    type="button"
                    variant={activeTemplatePreset === "custom" ? "cyber" : "outline"}
                    size="sm"
                    chamfer="dual"
                    onClick={() => setActiveTemplatePreset("custom")}
                    className="text-xs h-7 cursor-pointer"
                  >
                    Custom
                  </Button>
                </div>
              </div>

              {activeTemplatePreset === "custom" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Custom Template Text
                  </label>
                  <textarea
                    rows={6}
                    value={customTemplateText}
                    onChange={(e) => setCustomTemplateText(e.target.value)}
                    placeholder="Enter custom template..."
                    className="w-full p-2.5 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary chamfer-dual"
                  />
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {t("treasury.preReg.placeholdersHelp")}
                  </p>
                </div>
              )}

              {/* Live Preview */}
              <div className="p-3.5 bg-muted/20 border border-border/80 space-y-2 chamfer-dual">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>{t("treasury.preReg.waPreview")}</span>
                  </span>
                  <Badge variant="outline" className="text-[9px] font-mono">
                    Target Org: {orgName}
                  </Badge>
                </div>

                <div className="p-3 bg-background border border-border/60 text-xs font-mono text-foreground whitespace-pre-line select-all leading-relaxed">
                  {formatWhatsAppMessage("Kevin Sanjaya", "sample_token_xyz123")}
                </div>
              </div>
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
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
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
