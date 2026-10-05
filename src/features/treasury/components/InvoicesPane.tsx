import { useState, useMemo } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@boredkevin/ui";
import {
  Receipt,
  Plus,
  ExternalLink,
  Copy,
  Check,
  CreditCard,
  Search,
  Clock,
  X,
  User,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Loader2,
  FileEdit,
  Trash2,
  Ban,
  MessageCircle,
} from "lucide-react";
import { CreateCustomInvoiceModal } from "./CreateCustomInvoiceModal";
import { CreateInvoiceModal } from "./CreateInvoiceModal";
import { EditInvoiceModal } from "./EditInvoiceModal";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";

interface InvoicesPaneProps {
  organizationId: Id<"organizations">;
  activeFundId: Id<"funds"> | null;
}

function formatRelativeTime(
  timestamp: number,
  t: (key: string, opt?: any) => string,
  locale: string
): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return t("time.justNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t("time.minutesAgo", { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t("time.hoursAgo", { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return t("time.yesterday");
  if (diffDays < 30) return t("time.daysAgo", { count: diffDays });
  return new Date(timestamp).toLocaleDateString(locale === "id" ? "id-ID" : "en-US");
}

interface DateGroup {
  dateLabel: string;
  dateKey: string;
  invoices: Doc<"invoices">[];
}

function groupInvoicesByDate(invoices: Doc<"invoices">[], locale: string): DateGroup[] {
  const groups: DateGroup[] = [];
  for (const inv of invoices) {
    const d = new Date(inv.createdAt);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dateLabel = d.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    let group = groups.find((g) => g.dateKey === dateKey);
    if (!group) {
      group = { dateKey, dateLabel, invoices: [] };
      groups.push(group);
    }
    group.invoices.push(inv);
  }
  return groups;
}

export function InvoicesPane({
  organizationId,
  activeFundId,
}: InvoicesPaneProps) {
  const { t, i18n } = useTranslation();
  const [, setLocation] = useLocation();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDuesModalOpen, setIsDuesModalOpen] = useState(false);
  const [copiedInvoiceNumber, setCopiedInvoiceNumber] = useState<string | null>(null);
  const [verifyingInvoiceNumber, setVerifyingInvoiceNumber] = useState<string | null>(null);

  // CRUD inspection & management state
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<Doc<"invoices"> | null>(null);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<Doc<"invoices"> | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Doc<"invoices"> | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Doc<"invoices"> | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const verifyAndSettleTemanQrisOrder = useAction(
    api.treasury.borderpay.verifyAndSettleTemanQrisOrder
  );
  const cancelInvoice = useMutation(api.treasury.borderpay.cancelInvoice);
  const deleteInvoice = useMutation(api.treasury.borderpay.deleteInvoice);

  const myMembership = useQuery(api.members.getMyMembership, { organizationId });
  const allInvoices = useQuery(api.treasury.borderpay.listInvoices, {
    organizationId,
    fundId: activeFundId || undefined,
    status: "all",
  });

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const handleVerifyPayment = async (invoiceNumber: string) => {
    try {
      setVerifyingInvoiceNumber(invoiceNumber);
      setActionError(null);
      await verifyAndSettleTemanQrisOrder({ invoiceNumber });
    } catch (err: any) {
      setActionError(err?.message || "Failed to verify payment");
    } finally {
      setVerifyingInvoiceNumber(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!invoiceToCancel) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await cancelInvoice({ invoiceNumber: invoiceToCancel.invoiceNumber });
      setInvoiceToCancel(null);
    } catch (err: any) {
      setActionError(err?.message || "Failed to cancel invoice");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      setIsActionLoading(true);
      setActionError(null);
      await deleteInvoice({ invoiceId: invoiceToDelete._id });
      setInvoiceToDelete(null);
    } catch (err: any) {
      setActionError(err?.message || "Failed to delete invoice");
    } finally {
      setIsActionLoading(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      pending: 0,
      paid: 0,
      expired: 0,
      cancelled: 0,
    };
    if (!allInvoices) return counts;
    counts.all = allInvoices.length;
    for (const inv of allInvoices) {
      if (counts[inv.status] !== undefined) {
        counts[inv.status]++;
      }
    }
    return counts;
  }, [allInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];
    return allInvoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.payerName.toLowerCase().includes(q) ||
        inv.title.toLowerCase().includes(q) ||
        (inv.payerEmail && inv.payerEmail.toLowerCase().includes(q))
      );
    });
  }, [allInvoices, statusFilter, searchQuery]);

  const totalInvoices = filteredInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize));
  const shouldPaginate = totalInvoices > pageSize;
  const displayedInvoices = shouldPaginate
    ? filteredInvoices.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : filteredInvoices;

  const dateGroups = groupInvoicesByDate(displayedInvoices, i18n.language);

  const handleCopyLink = (invoiceNumber: string) => {
    const url = `${window.location.origin}/invoice/${invoiceNumber}`;
    void navigator.clipboard.writeText(url);
    setCopiedInvoiceNumber(invoiceNumber);
    setTimeout(() => {
      setCopiedInvoiceNumber((prev) => (prev === invoiceNumber ? null : prev));
    }, 2000);
  };

  const handleShareWhatsApp = (inv: Doc<"invoices">) => {
    const url = `${window.location.origin}/invoice/${inv.invoiceNumber}`;
    const text = encodeURIComponent(
      `Halo ${inv.payerName}, berikut tautan faktur kas ${inv.title} sebesar ${inv.currency} ${inv.totalAmount.toLocaleString()}:\n${url}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "paid":
        return t("treasury.invoices.statusPaid");
      case "pending":
        return t("treasury.invoices.statusPending");
      case "cancelled":
        return t("treasury.invoices.statusCancelled");
      case "expired":
        return t("treasury.invoices.statusExpired");
      default:
        return t("treasury.invoices.statusDraft");
    }
  };

  const getStatusBadge = (inv: Doc<"invoices">) => {
    if (inv.status === "pending" && inv.isAwaitingConfirmation) {
      return (
        <Badge
          variant="outline"
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse whitespace-nowrap"
        >
          <Clock className="w-3 h-3 text-amber-400" />
          <span>
            {t("treasury.invoices.statusAwaitingVerification", "Awaiting Verification")}
          </span>
        </Badge>
      );
    }
    switch (inv.status) {
      case "paid":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 whitespace-nowrap"
          >
            <Check className="w-3 h-3 text-emerald-400" />
            <span>{t("treasury.invoices.statusPaid")}</span>
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-amber-500/15 text-amber-300 border-amber-500/30 whitespace-nowrap"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{t("treasury.invoices.statusPending")}</span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border-red-500/30 whitespace-nowrap"
          >
            <X className="w-3 h-3 text-red-400" />
            <span>{t("treasury.invoices.statusCancelled")}</span>
          </Badge>
        );
      case "expired":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border-red-500/30 whitespace-nowrap"
          >
            <Clock className="w-3 h-3 text-red-400" />
            <span>{t("treasury.invoices.statusExpired")}</span>
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-muted/30 text-muted-foreground border-border/50 whitespace-nowrap"
          >
            <span>{t("treasury.invoices.statusDraft")}</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card telemetry="TREASURY.INVOICES" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 border border-primary/30 text-primary rounded shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("treasury.invoices.title", "Faktur & Tagihan")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("treasury.invoices.subtitle", "Pantau pembayaran tunggakan anggota, buat faktur kustom, dan cetak tanda terima.")}
                </CardDescription>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto shrink-0">
              {canManage && activeFundId && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => setIsDuesModalOpen(true)}
                    className="flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1.5 cursor-pointer h-8 px-3"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    <span>{t("treasury.invoices.createDuesBtn", "Faktur Tunggakan")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="dual"
                    onClick={() => setIsCustomModalOpen(true)}
                    className="flex-1 sm:flex-initial text-xs flex items-center justify-center gap-1.5 cursor-pointer h-8 px-3"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.createCustomBtn", "Faktur Kustom")}</span>
                  </Button>
                </>
              )}

              {!canManage && activeFundId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsDuesModalOpen(true)}
                  className="w-full sm:w-auto text-xs flex items-center justify-center gap-1.5 cursor-pointer h-8 px-3"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.payMyDues", "Bayar Iuran Saya")}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-border/40 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("treasury.invoices.searchPlaceholder", "Cari no. faktur, nama pembayar, atau judul...")}
                className="w-full h-8 pl-8 pr-3 bg-muted/20 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary rounded"
              />
            </div>

            {/* Smooth horizontally scrollable filter tabs (No jagged 2-row wrapping) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
              {(["all", "pending", "paid", "expired", "cancelled"] as const).map((s) => {
                const count = statusCounts[s];
                const isActive = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleFilterChange(s)}
                    className={`h-7 px-2.5 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1.5 transition-all cursor-pointer border rounded shrink-0 whitespace-nowrap ${
                      isActive
                        ? "bg-primary/15 border-primary text-primary font-bold shadow-sm"
                        : "bg-muted/10 border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    <span>{s === "all" ? t("common.all", "Semua") : getStatusText(s)}</span>
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isActive
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6 space-y-6">
          {allInvoices === undefined ? (
            <div className="py-12 text-center text-xs font-mono text-muted-foreground animate-pulse">
              {t("treasury.invoices.loadingInvoices")}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Receipt className="w-6 h-6 text-muted-foreground mx-auto opacity-50" />
              <p className="text-xs text-muted-foreground font-mono">
                {searchQuery || statusFilter !== "all"
                  ? t("treasury.invoices.noFilterMatch")
                  : t("treasury.invoices.noInvoices")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {dateGroups.map((group) => (
                <div key={group.dateKey} className="space-y-2.5">
                  {/* Date Divider */}
                  <div className="flex items-center gap-2 pt-1 first:pt-0">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground/80 shrink-0">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>

                  {/* Responsive Invoice Cards: Simpler & naturally scalable on mobile and desktop without code duplication */}
                  <div className="space-y-2.5">
                    {group.invoices.map((inv) => (
                      <div
                        key={inv._id}
                        className="p-3.5 sm:p-4 bg-card/60 hover:bg-muted/15 border border-border/70 hover:border-border/90 rounded-lg transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        {/* Left Section: Status Badge, Title, and Payer/Timestamp info */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Line 1: Status & Monospace Invoice # */}
                          <div className="flex items-center gap-2 min-w-0">
                            {getStatusBadge(inv)}

                            <button
                              type="button"
                              onClick={() => handleCopyLink(inv.invoiceNumber)}
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-primary bg-muted/20 hover:bg-primary/10 border border-border/40 hover:border-primary/30 px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                              title={t("treasury.invoices.copyLink", "Salin nomor faktur")}
                            >
                              <span>#{inv.invoiceNumber}</span>
                              {copiedInvoiceNumber === inv.invoiceNumber ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60" />
                              )}
                            </button>
                          </div>

                          {/* Line 2: Title (Full width, click opens details) */}
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForDetails(inv)}
                              className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors block truncate text-left w-full cursor-pointer"
                              title={inv.title}
                            >
                              {inv.title}
                            </button>
                          </div>

                          {/* Line 3: Payer & Timestamp info */}
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground min-w-0 truncate">
                            <User className="w-3.5 h-3.5 shrink-0 opacity-70 text-muted-foreground" />
                            <span className="font-medium text-foreground/90 truncate max-w-[120px] sm:max-w-[200px]">
                              {inv.payerName}
                            </span>
                            <span className="opacity-30">•</span>
                            <span className="shrink-0">{formatRelativeTime(inv.createdAt, t, i18n.language)}</span>
                            {inv.paidAt && (
                              <>
                                <span className="opacity-30">•</span>
                                <span className="text-emerald-400/90 shrink-0">
                                  {t("treasury.invoices.paidAgo", { time: formatRelativeTime(inv.paidAt, t, i18n.language) })}
                                </span>
                              </>
                            )}
                            {inv.expiresAt && inv.status === "pending" && (
                              <>
                                <span className="opacity-30">•</span>
                                <span className="text-amber-400/90 shrink-0">
                                  {t("treasury.invoices.expiresIn", { time: formatRelativeTime(inv.expiresAt, t, i18n.language) })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Section: Amount & Actions */}
                        {/* On mobile: full-width bottom row with subtle top border, Amount on left, Actions on right. */}
                        {/* On desktop: right-aligned column without border, Amount on top, Actions aligned below. */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border/40 sm:flex-col sm:items-end sm:gap-2">
                          {/* Amount: Prominent tabular monospace */}
                          <div className="font-mono text-sm sm:text-base font-bold text-foreground tabular-nums text-right">
                            {inv.currency} {inv.totalAmount.toLocaleString()}
                          </div>

                          {/* Actions: Simplified to 1 primary action + 1 dropdown menu */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Verify Button (if awaiting admin confirmation) */}
                            {canManage &&
                              inv.status === "pending" &&
                              (inv.isAwaitingConfirmation || inv.gatewayProvider === "temanqris") && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  chamfer="dual"
                                  disabled={verifyingInvoiceNumber === inv.invoiceNumber}
                                  onClick={() => void handleVerifyPayment(inv.invoiceNumber)}
                                  className="h-7 px-2 text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer flex items-center gap-1"
                                >
                                  {verifyingInvoiceNumber === inv.invoiceNumber ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3 h-3" />
                                  )}
                                  <span>Verifikasi</span>
                                </Button>
                              )}

                            {/* Primary Action Button */}
                            {inv.status === "pending" ? (
                              <Button
                                type="button"
                                variant="cyber"
                                size="sm"
                                chamfer="dual"
                                onClick={() => setLocation(`/invoice/${inv.invoiceNumber}`)}
                                className="h-7 px-2.5 text-xs cursor-pointer flex items-center gap-1"
                                title={t("treasury.invoices.payNow", "Bayar Sekarang")}
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>{t("treasury.invoices.payBtn", "Bayar")}</span>
                              </Button>
                            ) : inv.status === "paid" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                chamfer="dual"
                                onClick={() => setSelectedInvoiceForDetails(inv)}
                                className="h-7 px-2.5 text-xs text-emerald-400/90 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1"
                                title="Lihat Kuitansi"
                              >
                                <Receipt className="w-3 h-3 text-emerald-400" />
                                <span>Kuitansi</span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                chamfer="dual"
                                onClick={() => setSelectedInvoiceForDetails(inv)}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                                title="Lihat Rincian"
                              >
                                <Receipt className="w-3 h-3 text-primary" />
                                <span>Rincian</span>
                              </Button>
                            )}

                            {/* DropdownMenu for Secondary Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  chamfer="dual"
                                  className="h-7 w-7 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Menu opsi"
                                >
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 font-mono text-xs">
                                <DropdownMenuItem
                                  onClick={() => setSelectedInvoiceForDetails(inv)}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Receipt className="w-3.5 h-3.5 text-primary" />
                                  <span>Lihat Rincian Lengkap</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleCopyLink(inv.invoiceNumber)}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{copiedInvoiceNumber === inv.invoiceNumber ? "Tautan Disalin!" : "Salin Tautan Pembayaran"}</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => handleShareWhatsApp(inv)}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Bagikan ke WhatsApp</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => window.open(`/invoice/${inv.invoiceNumber}`, "_blank")}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>Buka di Tab Baru</span>
                                </DropdownMenuItem>

                                {canManage && (
                                  <>
                                    <DropdownMenuSeparator />

                                    {(inv.status === "draft" || inv.status === "pending") && (
                                      <DropdownMenuItem
                                        onClick={() => setSelectedInvoiceForEdit(inv)}
                                        className="flex items-center gap-2 cursor-pointer"
                                      >
                                        <FileEdit className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span>Ubah Faktur</span>
                                      </DropdownMenuItem>
                                    )}

                                    {(inv.status === "draft" || inv.status === "pending") && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setActionError(null);
                                          setInvoiceToCancel(inv);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer text-amber-400 focus:text-amber-400 focus:bg-amber-500/10"
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                        <span>Batalkan Faktur</span>
                                      </DropdownMenuItem>
                                    )}

                                    {(inv.status === "draft" || inv.status === "cancelled" || inv.status === "expired") && (
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setActionError(null);
                                          setInvoiceToDelete(inv);
                                        }}
                                        className="flex items-center gap-2 cursor-pointer text-rose-400 focus:text-rose-400 focus:bg-rose-500/10"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Hapus Faktur</span>
                                      </DropdownMenuItem>
                                    )}
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Pagination Controls */}
              {shouldPaginate && totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-border/80">
                  <div className="text-xs font-mono text-muted-foreground">
                    {t("treasury.invoices.paginationInfo", { current: currentPage, total: totalPages, count: totalInvoices })}
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
                      <span>{t("common.prev")}</span>
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
                      <span>{t("common.next")}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Modal */}
      {invoiceToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md">
            <Card telemetry="TREASURY.CANCEL_INVOICE" cornerLines className="bg-card border-border shadow-2xl">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {t("treasury.invoices.cancelConfirmTitle", "Cancel Invoice")}
                    </CardTitle>
                    <CardDescription className="text-xs font-mono">
                      {invoiceToCancel.invoiceNumber}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {actionError && (
                  <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                    {actionError}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t(
                    "treasury.invoices.cancelConfirmDesc",
                    `Are you sure you want to cancel invoice ${invoiceToCancel.invoiceNumber}? The invoice will no longer be payable and reserved dues cycles will be released.`,
                    { number: invoiceToCancel.invoiceNumber }
                  )}
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={isActionLoading}
                    onClick={() => {
                      setInvoiceToCancel(null);
                      setActionError(null);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="dual"
                    disabled={isActionLoading}
                    onClick={() => void handleConfirmCancel()}
                    className="text-xs cursor-pointer bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                  >
                    {isActionLoading
                      ? t("treasury.invoices.cancelling", "Cancelling...")
                      : t("treasury.invoices.confirmCancel", "Yes, Cancel Invoice")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md">
            <Card telemetry="TREASURY.DELETE_INVOICE" cornerLines className="bg-card border-border shadow-2xl">
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-destructive/15 border border-destructive/30 text-destructive">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {t("treasury.invoices.deleteConfirmTitle", "Delete Invoice")}
                    </CardTitle>
                    <CardDescription className="text-xs font-mono">
                      {invoiceToDelete.invoiceNumber}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {actionError && (
                  <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                    {actionError}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t(
                    "treasury.invoices.deleteConfirmDesc",
                    `Are you sure you want to permanently delete invoice ${invoiceToDelete.invoiceNumber}? This will release any reserved dues cycles. This action cannot be undone.`,
                    { number: invoiceToDelete.invoiceNumber }
                  )}
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={isActionLoading}
                    onClick={() => {
                      setInvoiceToDelete(null);
                      setActionError(null);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="dual"
                    disabled={isActionLoading}
                    onClick={() => void handleConfirmDelete()}
                    className="text-xs cursor-pointer bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                  >
                    {isActionLoading
                      ? t("treasury.invoices.deleting", "Deleting...")
                      : t("treasury.invoices.confirmDelete", "Yes, Delete Permanently")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={Boolean(selectedInvoiceForDetails)}
        onClose={() => setSelectedInvoiceForDetails(null)}
        invoice={selectedInvoiceForDetails}
        canManage={canManage}
        onEdit={(inv) => {
          setSelectedInvoiceForDetails(null);
          setSelectedInvoiceForEdit(inv);
        }}
        onCancel={(inv) => {
          setInvoiceToCancel(inv);
        }}
        onDelete={(inv) => {
          setInvoiceToDelete(inv);
        }}
        onVerify={(num) => {
          void handleVerifyPayment(num);
        }}
        isVerifying={Boolean(verifyingInvoiceNumber)}
      />

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        isOpen={Boolean(selectedInvoiceForEdit)}
        onClose={() => setSelectedInvoiceForEdit(null)}
        invoice={selectedInvoiceForEdit}
      />

      {/* Create Invoices Modals */}
      {activeFundId && (
        <>
          <CreateInvoiceModal
            isOpen={isDuesModalOpen}
            onClose={() => setIsDuesModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
            initialMode={canManage ? "admin" : "self"}
          />
          <CreateCustomInvoiceModal
            isOpen={isCustomModalOpen}
            onClose={() => setIsCustomModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
          />
        </>
      )}
    </div>
  );
}
