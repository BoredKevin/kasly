import { useState, useMemo } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@boredkevin/ui";
import {
  Receipt,
  Plus,
  Copy,
  Check,
  CreditCard,
  User,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Loader2,
  FileEdit,
  Trash2,
  Ban,
  Clock,
} from "lucide-react";
import { Panel, FilterBar, StatusPill, ConfirmDialog, EmptyState } from "../../../ui";
import { CreateCustomInvoiceModal } from "../components/CreateCustomInvoiceModal";
import { CreateInvoiceModal } from "../components/CreateInvoiceModal";
import { EditInvoiceModal } from "./EditInvoiceModal";
import { InvoiceDetailsModal } from "./InvoiceDetailsModal";

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

  const handleCopyLink = async (invoiceNumber: string) => {
    try {
      const url = `${window.location.origin}/invoice/${invoiceNumber}`;
      await navigator.clipboard.writeText(url);
      setCopiedInvoiceNumber(invoiceNumber);
      setTimeout(() => setCopiedInvoiceNumber(null), 2000);
    } catch {
      // Ignore
    }
  };

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
    return groupInvoicesByDate(paginatedInvoices, i18n.language);
  }, [paginatedInvoices, i18n.language]);

  const filterTabs = [
    { key: "all", label: t("common.all", "All"), count: statusCounts.all },
    { key: "pending", label: t("treasury.invoices.statusPending", "Pending"), count: statusCounts.pending },
    { key: "paid", label: t("treasury.invoices.statusPaid", "Paid"), count: statusCounts.paid },
    { key: "expired", label: t("treasury.invoices.statusExpired", "Expired"), count: statusCounts.expired },
    { key: "cancelled", label: t("treasury.invoices.statusCancelled", "Cancelled"), count: statusCounts.cancelled },
  ];

  const renderStatusPill = (inv: Doc<"invoices">) => {
    if (inv.status === "pending" && (inv.isAwaitingConfirmation || inv.gatewayProvider === "temanqris")) {
      return (
        <StatusPill tone="warning" className="text-[10px] py-0 px-1.5 font-medium animate-pulse">
          <Clock className="w-3 h-3 mr-1" />
          <span>Awaiting Verification</span>
        </StatusPill>
      );
    }

    switch (inv.status) {
      case "paid":
        return (
          <StatusPill tone="success" className="text-[10px] py-0 px-1.5 font-medium">
            <Check className="w-3 h-3 mr-1" />
            <span>{t("treasury.invoices.statusPaid", "Paid")}</span>
          </StatusPill>
        );
      case "pending":
        return (
          <StatusPill tone="warning" className="text-[10px] py-0 px-1.5 font-medium">
            <Clock className="w-3 h-3 mr-1" />
            <span>{t("treasury.invoices.statusPending", "Pending")}</span>
          </StatusPill>
        );
      case "cancelled":
        return (
          <StatusPill tone="danger" className="text-[10px] py-0 px-1.5 font-medium">
            <span>{t("treasury.invoices.statusCancelled", "Cancelled")}</span>
          </StatusPill>
        );
      case "expired":
        return (
          <StatusPill tone="danger" className="text-[10px] py-0 px-1.5 font-medium">
            <span>{t("treasury.invoices.statusExpired", "Expired")}</span>
          </StatusPill>
        );
      default:
        return (
          <StatusPill tone="neutral" className="text-[10px] py-0 px-1.5 font-medium">
            <span>{t("treasury.invoices.statusDraft", "Draft")}</span>
          </StatusPill>
        );
    }
  };

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

          <div className="flex items-center gap-2">
            {canManage && activeFundId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDuesModalOpen(true)}
                  className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5 text-primary" />
                  <span>{t("treasury.invoices.createDuesBtn", "Dues Invoice")}</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.createCustomBtn", "Custom Invoice")}</span>
                </Button>
              </>
            )}

            {!canManage && activeFundId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDuesModalOpen(true)}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{t("treasury.invoices.payMyDues", "Pay My Dues")}</span>
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
                <div key={group.dateKey} className="space-y-2.5">
                  {/* Date Divider */}
                  <div className="flex items-center gap-2 pt-1 first:pt-0">
                    <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-muted-foreground/80 shrink-0">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>

                  {/* Modern Cards */}
                  <div className="space-y-2">
                    {group.invoices.map((inv) => (
                      <div
                        key={inv._id}
                        className="p-3.5 sm:p-4 bg-muted/10 hover:bg-muted/25 border border-border/60 hover:border-border/90 rounded-[var(--fintech-radius-md)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        {/* Left Side */}
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {renderStatusPill(inv)}

                            <button
                              type="button"
                              onClick={() => void handleCopyLink(inv.invoiceNumber)}
                              className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground bg-muted/30 px-1.5 py-0.5 rounded-[var(--fintech-radius-xs)] border border-border/60 transition-colors cursor-pointer shrink-0"
                              title="Copy invoice link"
                            >
                              <span>#{inv.invoiceNumber}</span>
                              {copiedInvoiceNumber === inv.invoiceNumber ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-60" />
                              )}
                            </button>
                          </div>

                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForDetails(inv)}
                              className="text-sm font-semibold text-foreground hover:text-primary transition-colors block truncate text-left w-full cursor-pointer"
                              title={inv.title}
                            >
                              {inv.title}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 truncate">
                            <User className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                            <span className="font-medium text-foreground/90 truncate max-w-[140px] sm:max-w-[220px]">
                              {inv.payerName}
                            </span>
                            <span className="opacity-40">•</span>
                            <span className="shrink-0">{new Date(inv.createdAt).toLocaleDateString()}</span>
                            {inv.paidAt && (
                              <>
                                <span className="opacity-40">•</span>
                                <span className="text-emerald-400 shrink-0 font-medium">
                                  Paid {new Date(inv.paidAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Side */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-border/40 sm:flex-col sm:items-end sm:gap-2">
                          <div className="font-mono text-base font-bold text-foreground tabular-nums text-right">
                            {inv.currency} {inv.totalAmount.toLocaleString()}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {/* Verify Action */}
                            {canManage &&
                              inv.status === "pending" &&
                              (inv.isAwaitingConfirmation || inv.gatewayProvider === "temanqris") && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={verifyingInvoiceNumber === inv.invoiceNumber}
                                  onClick={() => void handleVerifyPayment(inv.invoiceNumber)}
                                  className="h-7 px-2 text-xs text-amber-400 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer flex items-center gap-1"
                                >
                                  {verifyingInvoiceNumber === inv.invoiceNumber ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3 h-3" />
                                  )}
                                  <span>Verify</span>
                                </Button>
                              )}

                            {/* Primary Action */}
                            {inv.status === "pending" ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setLocation(`/invoice/${inv.invoiceNumber}`)}
                                className="h-7 px-2.5 text-xs cursor-pointer flex items-center gap-1"
                              >
                                <CreditCard className="w-3 h-3" />
                                <span>{t("treasury.invoices.payBtn", "Pay")}</span>
                              </Button>
                            ) : inv.status === "paid" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedInvoiceForDetails(inv)}
                                className="h-7 px-2.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1"
                              >
                                <Receipt className="w-3 h-3 text-emerald-400" />
                                <span>Receipt</span>
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedInvoiceForDetails(inv)}
                                className="h-7 px-2 text-xs cursor-pointer"
                              >
                                Details
                              </Button>
                            )}

                            {/* Dropdown Menu */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                                  aria-label="Actions"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onClick={() => setSelectedInvoiceForDetails(inv)}
                                  className="text-xs cursor-pointer"
                                >
                                  <Receipt className="w-3.5 h-3.5 mr-2" />
                                  <span>View Details</span>
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => void handleCopyLink(inv.invoiceNumber)}
                                  className="text-xs cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 mr-2" />
                                  <span>Copy Link</span>
                                </DropdownMenuItem>

                                {canManage && (inv.status === "draft" || inv.status === "pending") && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setSelectedInvoiceForEdit(inv)}
                                      className="text-xs cursor-pointer"
                                    >
                                      <FileEdit className="w-3.5 h-3.5 mr-2" />
                                      <span>Edit</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setInvoiceToCancel(inv)}
                                      className="text-xs text-amber-400 cursor-pointer"
                                    >
                                      <Ban className="w-3.5 h-3.5 mr-2" />
                                      <span>Cancel</span>
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {canManage &&
                                  (inv.status === "draft" ||
                                    inv.status === "cancelled" ||
                                    inv.status === "expired") && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setInvoiceToDelete(inv)}
                                        className="text-xs text-rose-400 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                                        <span>Delete</span>
                                      </DropdownMenuItem>
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
      </Panel>

      {/* Reusable ConfirmDialog for Cancel Invoice */}
      <ConfirmDialog
        isOpen={invoiceToCancel !== null}
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
      <ConfirmDialog
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
      <InvoiceDetailsModal
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
      {isCustomModalOpen && activeFundId && (
        <CreateCustomInvoiceModal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          organizationId={organizationId}
          fundId={activeFundId}
        />
      )}

      {/* Dues Invoice Creation Modal */}
      {isDuesModalOpen && activeFundId && (
        <CreateInvoiceModal
          isOpen={isDuesModalOpen}
          onClose={() => setIsDuesModalOpen(false)}
          organizationId={organizationId}
          fundId={activeFundId}
        />
      )}
    </div>
  );
}
