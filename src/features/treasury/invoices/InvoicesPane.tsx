import { useState, useMemo } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@boredkevin/ui";
import {
  Receipt,
  Plus,
  Check,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Ban,
  Clock,
} from "lucide-react";
import { Panel, FilterBar, StatusPill, ConfirmDialog, EmptyState } from "../../../ui";
import { CreateCustomInvoiceModal } from "../components/CreateCustomInvoiceModal";
import { CreateInvoiceModal } from "../components/CreateInvoiceModal";
import { EditInvoiceModal } from "./EditInvoiceModal";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";
import { useFormat } from "../../../hooks/useFormat";

export interface InvoicesPaneProps {
  organizationId: Id<"organizations">;
  activeFundId: Id<"funds"> | null;
}

interface DateGroup {
  dateLabel: string;
  dateKey: string;
  invoices: Doc<"invoices">[];
}

function groupInvoicesByDate(invoices: Doc<"invoices">[], locale: string): DateGroup[] {
  const groups: DateGroup[] = [];
  const intlLocale = locale.startsWith("id") ? "id-ID" : "en-US";
  for (const inv of invoices) {
    const d = new Date(inv.createdAt);
    const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const dateLabel = d.toLocaleDateString(intlLocale, {
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
  const { t } = useTranslation();
  const { money: formatMoney, locale } = useFormat();
  const [, setLocation] = useLocation();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDuesModalOpen, setIsDuesModalOpen] = useState(false);
  const [verifyingInvoiceNumber, setVerifyingInvoiceNumber] = useState<string | null>(null);

  // Inspection & management state
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<Doc<"invoices"> | null>(null);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<Doc<"invoices"> | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Doc<"invoices"> | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Doc<"invoices"> | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const verifyPaymentAction = useAction(api.treasury.borderpay.verifyAndSettleTemanQrisOrder);
  const cancelInvoiceMutation = useMutation(api.treasury.borderpay.cancelInvoice);
  const deleteInvoiceMutation = useMutation(api.treasury.borderpay.deleteInvoice);

  const myMembership = useQuery(
    api.members.getMyMembership,
    organizationId ? { organizationId } : "skip"
  );

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const allInvoices = useQuery(
    api.treasury.borderpay.listInvoices,
    organizationId
      ? {
        organizationId,
        fundId: activeFundId ?? undefined,
      }
      : "skip"
  );


  const handleVerifyPayment = async (invoiceNumber: string) => {
    setVerifyingInvoiceNumber(invoiceNumber);
    try {
      await verifyPaymentAction({ invoiceNumber });
    } catch {
      // Error handled by mutation/toast
    } finally {
      setVerifyingInvoiceNumber(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!invoiceToCancel) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await cancelInvoiceMutation({ invoiceNumber: invoiceToCancel.invoiceNumber });
      setInvoiceToCancel(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel invoice");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await deleteInvoiceMutation({ invoiceId: invoiceToDelete._id });
      setInvoiceToDelete(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to delete invoice");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Filter & search
  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];
    return allInvoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = inv.invoiceNumber.toLowerCase().includes(q);
        const nameMatch = inv.payerName.toLowerCase().includes(q);
        const titleMatch = inv.title.toLowerCase().includes(q);
        if (!numMatch && !nameMatch && !titleMatch) return false;
      }
      return true;
    });
  }, [allInvoices, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allInvoices?.length ?? 0,
      pending: 0,
      paid: 0,
      expired: 0,
      cancelled: 0,
    };
    if (allInvoices) {
      for (const inv of allInvoices) {
        if (counts[inv.status] !== undefined) {
          counts[inv.status]++;
        }
      }
    }
    return counts;
  }, [allInvoices]);

  const totalPages = Math.ceil(filteredInvoices.length / pageSize) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, currentPage]);

  const dateGroups = useMemo(() => {
    return groupInvoicesByDate(paginatedInvoices, locale);
  }, [paginatedInvoices, locale]);

  const filterTabs = [
    { key: "all", label: t("common.all", "All"), count: statusCounts.all },
    { key: "pending", label: t("treasury.invoices.statusPending", "Pending"), count: statusCounts.pending },
    { key: "paid", label: t("treasury.invoices.statusPaid", "Paid"), count: statusCounts.paid },
    { key: "expired", label: t("treasury.invoices.statusExpired", "Expired"), count: statusCounts.expired },
    { key: "cancelled", label: t("treasury.invoices.statusCancelled", "Cancelled"), count: statusCounts.cancelled },
  ];


  return (
    <div className="space-y-6">
      <Panel className="p-0 overflow-hidden bg-card border-border/80 shadow-sm">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 text-primary">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t("treasury.invoices.title", "Invoices & Billing")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("treasury.invoices.subtitle", "Track member dues, issue custom invoices, and view payment receipts")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {canManage && activeFundId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  onClick={() => setIsDuesModalOpen(true)}
                  className="h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded-[var(--fintech-radius-sm)] font-medium"
                >
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate">{t("treasury.invoices.createDuesBtn", "Buat Faktur Tunggakan")}</span>
                </Button>

                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  chamfer="none"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded-[var(--fintech-radius-sm)] font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="truncate">{t("treasury.invoices.createCustomBtn", "Buat Faktur Kustom")}</span>
                </Button>
              </>
            )}

            {!canManage && activeFundId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                onClick={() => setIsDuesModalOpen(true)}
                className="h-8 text-xs flex items-center justify-center gap-1.5 cursor-pointer rounded-[var(--fintech-radius-sm)] font-medium w-full sm:w-auto"
              >
                <CreditCard className="w-3.5 h-3.5 text-primary" />
                <span>{t("treasury.invoices.payMyDues", "Bayar Tunggakan Saya")}</span>
              </Button>
            )}
          </div>
        </div>

        {/* FilterBar */}
        <div className="p-4 border-b border-border/60 bg-muted/5">
          <FilterBar
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            searchPlaceholder={t("treasury.invoices.searchPlaceholder", "Search by invoice #, payer, or title...")}
            filters={filterTabs}
            activeFilter={statusFilter}
            onFilterChange={(key) => {
              setStatusFilter(key);
              setCurrentPage(1);
            }}
          />
        </div>

        {/* List Content */}
        <div className="p-4 sm:p-5">
          {allInvoices === undefined ? (
            <div className="py-16 text-center text-xs text-muted-foreground animate-pulse">
              {t("treasury.invoices.loadingInvoices", "Loading invoices...")}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              icon={<Receipt className="w-6 h-6 text-muted-foreground" />}
              title={searchQuery || statusFilter !== "all" ? "No matching invoices" : "No invoices issued yet"}
              description={
                searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search query or filter."
                  : "Issue a dues or custom invoice to start tracking payments."
              }
            />
          ) : (
            <div className="space-y-6">
              {dateGroups.map((group) => (
                <div key={group.dateKey} className="space-y-2">
                  {/* Date Divider */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>

                  {/* Transaction Rows */}
                  <div className="divide-y divide-border/25 rounded-[var(--fintech-radius-md)] border border-border/40 bg-card/40 overflow-hidden">
                    {group.invoices.map((inv) => {
                      const isPaid = inv.status === "paid";
                      const isPending = inv.status === "pending";
                      const isCancelled = inv.status === "cancelled";
                      const isExpired = inv.status === "expired";
                      const isAwaitingVerification =
                        isPending && (inv.isAwaitingConfirmation || inv.gatewayProvider === "temanqris");

                      // Clean localized title
                      let displayTitle = inv.title;
                      if (inv.title.startsWith("Dues Payment (")) {
                        displayTitle = inv.title
                          .replace("Dues Payment", t("treasury.invoices.duesPayment", "Pembayaran Tunggakan"))
                          .replace("cycles", t("treasury.overview.cycles", "siklus"))
                          .replace("cycle", t("treasury.overview.cycle_one", "siklus"))
                          .replace("Week", t("treasury.overview.week", "Minggu"));
                      }

                      return (
                        <div
                          key={inv._id}
                          onClick={() => setSelectedInvoiceForDetails(inv)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedInvoiceForDetails(inv);
                            }
                          }}
                          className="p-3 sm:p-3.5 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        >
                          {/* Left Side: Circular Icon + Title + Status + Subtext */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Circular Status Icon */}
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isPaid
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : isPending
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : isCancelled || isExpired
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : "bg-muted text-muted-foreground border border-border/60"
                                }`}
                            >
                              {isPaid ? (
                                <Check className="w-4 h-4" />
                              ) : isPending ? (
                                <Clock className="w-4 h-4" />
                              ) : isCancelled || isExpired ? (
                                <Ban className="w-4 h-4" />
                              ) : (
                                <Receipt className="w-4 h-4" />
                              )}
                            </div>

                            {/* Title & Metadata */}
                            <div className="min-w-0 flex-1 space-y-1">
                              {/* Expanded Title */}
                              <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors block truncate">
                                  {displayTitle}
                                </span>
                              </div>

                              {/* Status Badge on sub-line where date was, author removed */}
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {isAwaitingVerification ? (
                                  <StatusPill tone="warning" className="text-[10px] py-0 px-1.5 shrink-0">
                                    <span>{t("treasury.invoices.statusAwaitingConfirmation", "Menunggu Konfirmasi")}</span>
                                  </StatusPill>
                                ) : isPaid ? (
                                  <StatusPill tone="success" className="text-[10px] py-0 px-1.5 shrink-0">
                                    {t("treasury.invoices.statusPaid", "Lunas")}
                                  </StatusPill>
                                ) : isPending ? (
                                  <StatusPill tone="warning" className="text-[10px] py-0 px-1.5 shrink-0">
                                    {t("treasury.invoices.statusPending", "Menunggu")}
                                  </StatusPill>
                                ) : isCancelled ? (
                                  <StatusPill tone="danger" className="text-[10px] py-0 px-1.5 shrink-0">
                                    {t("treasury.invoices.statusCancelled", "Dibatalkan")}
                                  </StatusPill>
                                ) : isExpired ? (
                                  <StatusPill tone="danger" className="text-[10px] py-0 px-1.5 shrink-0">
                                    {t("treasury.invoices.statusExpired", "Kedaluwarsa")}
                                  </StatusPill>
                                ) : (
                                  <StatusPill tone="neutral" className="text-[10px] py-0 px-1.5 shrink-0">
                                    {t("treasury.invoices.statusDraft", "Draf")}
                                  </StatusPill>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Side: Formatted Amount & Quick Pay */}
                          <div className="flex items-center gap-2.5 shrink-0 pl-2">
                            <div className="text-right">
                              <div
                                className={`text-sm sm:text-base font-sans font-bold tabular-nums tracking-tight ${isPaid ? "text-emerald-400" : isPending ? "text-amber-300" : "text-foreground"
                                  }`}
                              >
                                {formatMoney(inv.totalAmount, inv.currency)}
                              </div>
                            </div>

                            {/* Quick Pay CTA for pending invoices (hidden if awaiting verification/confirmation) */}
                            {isPending && !isAwaitingVerification && (
                              <Button
                                type="button"
                                size="sm"
                                chamfer="none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLocation(`/invoice/${inv.invoiceNumber}`);
                                }}
                                className="h-7 px-2.5 text-xs cursor-pointer flex items-center gap-1 font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-[var(--fintech-radius-sm)] shrink-0 shadow-sm"
                                title={t("treasury.invoices.payBtn", "Bayar")}
                              >
                                <CreditCard className="w-3 h-3" />
                                <span className="hidden sm:inline">{t("treasury.invoices.payBtn", "Bayar")}</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-7 px-2 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-7 px-2 cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel >

      {/* Reusable ConfirmDialog for Cancel Invoice */}
      < ConfirmDialog
        isOpen={invoiceToCancel !== null
        }
        onClose={() => setInvoiceToCancel(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Invoice"
        description={
          invoiceToCancel
            ? `Are you sure you want to cancel invoice #${invoiceToCancel.invoiceNumber}? Once cancelled, the payment link will be deactivated.`
            : ""
        }
        confirmText="Cancel Invoice"
        variant="warning"
        isLoading={isActionLoading}
        error={actionError}
      />

      {/* Reusable ConfirmDialog for Delete Invoice */}
      < ConfirmDialog
        isOpen={invoiceToDelete !== null}
        onClose={() => setInvoiceToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Invoice"
        description={
          invoiceToDelete
            ? `Are you sure you want to delete invoice #${invoiceToDelete.invoiceNumber}? This action is permanent and cannot be undone.`
            : ""
        }
        confirmText="Delete Invoice"
        variant="danger"
        isLoading={isActionLoading}
        error={actionError}
      />

      {/* Inspection Modal */}
      < InvoiceDetailsModal
        isOpen={selectedInvoiceForDetails !== null}
        onClose={() => setSelectedInvoiceForDetails(null)}
        invoice={selectedInvoiceForDetails}
        canManage={canManage}
        onEdit={(inv) => {
          setSelectedInvoiceForDetails(null);
          setSelectedInvoiceForEdit(inv);
        }}
        onCancel={(inv) => {
          setSelectedInvoiceForDetails(null);
          setInvoiceToCancel(inv);
        }}
        onDelete={(inv) => {
          setSelectedInvoiceForDetails(null);
          setInvoiceToDelete(inv);
        }}
        onVerify={handleVerifyPayment}
        isVerifying={verifyingInvoiceNumber !== null}
      />

      {/* Edit Modal */}
      <EditInvoiceModal
        isOpen={selectedInvoiceForEdit !== null}
        onClose={() => setSelectedInvoiceForEdit(null)}
        invoice={selectedInvoiceForEdit}
      />

      {/* Custom Invoice Creation Modal */}
      {
        isCustomModalOpen && activeFundId && (
          <CreateCustomInvoiceModal
            isOpen={isCustomModalOpen}
            onClose={() => setIsCustomModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
          />
        )
      }

      {/* Dues Invoice Creation Modal */}
      {
        isDuesModalOpen && activeFundId && (
          <CreateInvoiceModal
            isOpen={isDuesModalOpen}
            onClose={() => setIsDuesModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
          />
        )
      }
    </div >
  );
}
