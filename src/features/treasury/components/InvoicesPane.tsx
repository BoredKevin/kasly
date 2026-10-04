import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { Link, useLocation } from "wouter";
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
} from "lucide-react";
import { CreateCustomInvoiceModal } from "./CreateCustomInvoiceModal";
import { CreateInvoiceModal } from "./CreateInvoiceModal";

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
  const [activeMobileMenuId, setActiveMobileMenuId] = useState<string | null>(null);
  const [verifyingInvoiceNumber, setVerifyingInvoiceNumber] = useState<string | null>(null);

  const verifyAndSettleTemanQrisOrder = useAction(
    api.treasury.borderpay.verifyAndSettleTemanQrisOrder
  );

  const myMembership = useQuery(api.members.getMyMembership, { organizationId });
  const invoices = useQuery(api.treasury.borderpay.listInvoices, {
    organizationId,
    fundId: activeFundId || undefined,
    status: statusFilter,
  });

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const handleVerifyPayment = async (invoiceNumber: string) => {
    if (verifyingInvoiceNumber) return;
    setVerifyingInvoiceNumber(invoiceNumber);
    try {
      await verifyAndSettleTemanQrisOrder({ invoiceNumber });
    } catch (err: unknown) {
      console.error("Verification failed:", err);
      alert(
        err instanceof Error
          ? err.message
          : t("treasury.invoices.verifyFailed", "Failed to verify payment.")
      );
    } finally {
      setVerifyingInvoiceNumber(null);
    }
  };

  useEffect(() => {
    if (!activeMobileMenuId) return;
    const handleOutsideClick = () => setActiveMobileMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, [activeMobileMenuId]);

  const filteredInvoices = (invoices || []).filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.payerName.toLowerCase().includes(q) ||
      inv.title.toLowerCase().includes(q)
    );
  });

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
    setTimeout(() => setCopiedInvoiceNumber(null), 2000);
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
          className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
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
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          >
            <Check className="w-3 h-3 text-emerald-400" />
            <span>{t("treasury.invoices.statusPaid")}</span>
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-amber-500/15 text-amber-300 border-amber-500/30"
          >
            <Clock className="w-3 h-3 text-amber-400" />
            <span>{t("treasury.invoices.statusPending")}</span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border-red-500/30"
          >
            <X className="w-3 h-3 text-red-400" />
            <span>{t("treasury.invoices.statusCancelled")}</span>
          </Badge>
        );
      case "expired":
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border-red-500/30"
          >
            <Clock className="w-3 h-3 text-red-400" />
            <span>{t("treasury.invoices.statusExpired")}</span>
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-[10px] font-mono font-bold px-1.5 py-0.5 border flex items-center gap-1 shrink-0 bg-muted/30 text-muted-foreground border-border/50"
          >
            <span>{t("treasury.invoices.statusDraft")}</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6" onClick={() => setActiveMobileMenuId(null)}>
      <Card telemetry="TREASURY.INVOICES" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("treasury.invoices.title")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("treasury.invoices.subtitle")}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeFundId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsDuesModalOpen(true)}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.payNow")}</span>
                </Button>
              )}

              {canManage && activeFundId && (
                <Button
                  type="button"
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.createCustomBtn")}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t("treasury.invoices.searchPlaceholder")}
                className="w-full h-8 pl-8 pr-3 bg-muted/20 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted-foreground text-[10px] uppercase">
                {t("treasury.invoices.filterStatus")}:
              </span>
              {(["all", "pending", "paid", "expired", "cancelled"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={statusFilter === s ? "secondary" : "outline"}
                  size="sm"
                  chamfer="dual"
                  onClick={() => handleFilterChange(s)}
                  className={`h-7 px-2 text-[10px] uppercase cursor-pointer ${statusFilter === s ? "border-primary/50 text-primary font-bold" : "text-muted-foreground"
                    }`}
                >
                  {s === "all" ? t("common.all") : getStatusText(s)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6 space-y-6">
          {invoices === undefined ? (
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
              {/* GitHub Commits Style CLE Timeline */}
              <div className="relative pl-6 space-y-6 border-l border-border/80 ml-2">
                {dateGroups.map((group) => (
                  <div key={group.dateKey} className="space-y-2.5 relative">
                    {/* Date Group Header with Commit Node */}
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-background -ml-[31px] shrink-0" />
                      <span className="font-semibold text-foreground/50">
                        {t("treasury.invoices.invoicesOnDate", { date: group.dateLabel })}
                      </span>
                    </div>

                    {/* Commit Rows Container Box */}
                    <div className="border border-border/80 bg-card/60 divide-y divide-border/60 overflow-hidden shadow-sm">
                      {group.invoices.map((inv) => (
                        <div
                          key={inv._id}
                          className="p-3.5 hover:bg-muted/15 transition-colors flex items-center justify-between gap-3 group"
                        >
                          {/* Left Side: Status Badge, Amount, Title & Payer Details */}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            {/* Top Line: Status Badge + Amount + Title */}
                            <div className="flex flex-wrap items-center gap-2">
                              {getStatusBadge(inv)}

                              <span className="font-mono text-xs font-bold text-foreground shrink-0">
                                {inv.currency} {inv.totalAmount.toLocaleString()}
                              </span>

                              <Link
                                href={`/invoice/${inv.invoiceNumber}`}
                                className="text-xs font-semibold text-foreground truncate max-w-sm sm:max-w-md md:max-w-lg hover:text-primary hover:underline transition-colors text-left cursor-pointer"
                                title={inv.title}
                              >
                                {inv.title}
                              </Link>
                            </div>

                            {/* Bottom Sub-line: Invoice #, Payer, Date, Details */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-muted-foreground">
                              <span className="text-primary font-bold">#{inv.invoiceNumber}</span>
                              <div className="flex items-center gap-1 text-foreground">
                                <div className="p-0.5 rounded-full border border-border/60 bg-muted/40">
                                  <User className="w-2.5 h-2.5 text-muted-foreground" />
                                </div>
                                <span className="font-medium">{inv.payerName}</span>
                              </div>
                              {inv.payerEmail && (
                                <span className="hidden sm:inline opacity-75">• {inv.payerEmail}</span>
                              )}
                              <span>{t("treasury.invoices.createdAgo", { time: formatRelativeTime(inv.createdAt, t, i18n.language) })}</span>
                              {inv.paidAt && (
                                <span className="text-emerald-400/90">{t("treasury.invoices.paidAgo", { time: formatRelativeTime(inv.paidAt, t, i18n.language) })}</span>
                              )}
                              {inv.expiresAt && inv.status === "pending" && (
                                <span className="text-amber-400/90">{t("treasury.invoices.expiresIn", { time: formatRelativeTime(inv.expiresAt, t, i18n.language) })}</span>
                              )}
                            </div>
                          </div>

                          {/* Right Side - Desktop: Easily Clickable Action Buttons (like CLE) */}
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0 font-mono text-xs">
                            {/* Invoice Number Short Copy Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              chamfer="dual"
                              onClick={() => handleCopyLink(inv.invoiceNumber)}
                              title={t("treasury.invoices.copyLink")}
                              className="h-7 px-2 font-mono text-[11px] flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <span>{inv.invoiceNumber}</span>
                              {copiedInvoiceNumber === inv.invoiceNumber ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60" />
                              )}
                            </Button>

                            {/* View Button */}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              chamfer="dual"
                              onClick={() => setLocation(`/invoice/${inv.invoiceNumber}`)}
                              title={t("treasury.invoices.openInvoice")}
                              className="h-7 px-2.5 flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                            >
                              <Receipt className="w-3.5 h-3.5 text-primary" />
                              <span className="hidden md:inline">{t("treasury.invoices.viewBtn")}</span>
                            </Button>

                            {/* Verify Button if Pending and (Awaiting Confirmation or TemanQRIS) */}
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
                                  title={t(
                                    "treasury.invoices.verifyPaymentAction",
                                    "Verify upstream & settle to ledger"
                                  )}
                                  className="h-7 px-2.5 flex items-center gap-1.5 cursor-pointer text-xs text-amber-400 hover:text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
                                >
                                  {verifyingInvoiceNumber === inv.invoiceNumber ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                  <span>{t("treasury.invoices.verifyPaymentBtn", "Verify")}</span>
                                </Button>
                              )}

                            {/* Pay Button if Pending */}
                            {inv.status === "pending" && (
                              <Button
                                type="button"
                                variant="cyber"
                                size="sm"
                                chamfer="dual"
                                onClick={() => setLocation(`/invoice/${inv.invoiceNumber}`)}
                                title={t("treasury.invoices.payNow")}
                                className="h-7 px-2.5 flex items-center gap-1.5 cursor-pointer text-xs"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>{t("treasury.invoices.payBtn")}</span>
                              </Button>
                            )}

                            {/* Receipt Button if Paid */}
                            {inv.status === "paid" && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                chamfer="dual"
                                onClick={() => setLocation(`/invoice/${inv.invoiceNumber}`)}
                                title={t("treasury.invoices.viewReceiptAction")}
                                className="h-7 px-2.5 flex items-center gap-1.5 cursor-pointer text-xs text-emerald-400 hover:text-emerald-300 border-emerald-500/30"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span className="hidden md:inline">{t("treasury.invoices.receiptBtn")}</span>
                              </Button>
                            )}
                          </div>

                          {/* Right Side - Mobile: Easily clickable [...] Dropdown Menu Button */}
                          <div className="sm:hidden relative shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              chamfer="dual"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMobileMenuId(
                                  activeMobileMenuId === inv._id ? null : inv._id
                                );
                              }}
                              className="h-7 w-7 p-0 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>

                            {activeMobileMenuId === inv._id && (
                              <div
                                className="absolute right-0 top-full mt-1 z-40 w-56 p-1 bg-popover/95 backdrop-blur-md border border-border shadow-2xl font-mono text-xs space-y-0.5 animate-in fade-in zoom-in-95"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLocation(`/invoice/${inv.invoiceNumber}`);
                                    setActiveMobileMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-muted/40 text-foreground text-left cursor-pointer transition-colors"
                                >
                                  <Receipt className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span>{t("treasury.invoices.openInvoice")}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCopyLink(inv.invoiceNumber);
                                    setActiveMobileMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-muted/40 text-foreground text-left cursor-pointer transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <span>{t("treasury.invoices.copyLink")}</span>
                                </button>

                                {canManage &&
                                  inv.status === "pending" &&
                                  (inv.isAwaitingConfirmation || inv.gatewayProvider === "temanqris") && (
                                    <button
                                      type="button"
                                      disabled={verifyingInvoiceNumber === inv.invoiceNumber}
                                      onClick={() => {
                                        void handleVerifyPayment(inv.invoiceNumber);
                                        setActiveMobileMenuId(null);
                                      }}
                                      className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-amber-500/20 text-amber-400 text-left cursor-pointer transition-colors border-t border-border/40 font-bold"
                                    >
                                      {verifyingInvoiceNumber === inv.invoiceNumber ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                      ) : (
                                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                      )}
                                      <span>
                                        {t("treasury.invoices.verifyPaymentBtn", "Verify Payment")}
                                      </span>
                                    </button>
                                  )}

                                {inv.status === "pending" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLocation(`/invoice/${inv.invoiceNumber}`);
                                      setActiveMobileMenuId(null);
                                    }}
                                    className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-primary/20 text-primary text-left cursor-pointer transition-colors border-t border-border/40 font-bold"
                                  >
                                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                                    <span>{t("treasury.invoices.payInvoiceAction")}</span>
                                  </button>
                                )}

                                {inv.status === "paid" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLocation(`/invoice/${inv.invoiceNumber}`);
                                      setActiveMobileMenuId(null);
                                    }}
                                    className="w-full px-2.5 py-1.5 flex items-center gap-2 hover:bg-emerald-500/20 text-emerald-400 text-left cursor-pointer transition-colors border-t border-border/40 font-bold"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    <span>{t("treasury.invoices.viewReceiptAction")}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

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

      {/* Modals */}
      {activeFundId && (
        <>
          <CreateInvoiceModal
            isOpen={isDuesModalOpen}
            onClose={() => setIsDuesModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
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
