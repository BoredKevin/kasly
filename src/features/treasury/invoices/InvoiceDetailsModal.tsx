import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Doc } from "../../../../convex/_generated/dataModel";
import { Button } from "@boredkevin/ui";
import { Panel, StatusPill, StatusTone } from "../../../ui";
import {
  Receipt,
  X,
  Copy,
  Check,
  ExternalLink,
  CalendarDays,
  ShieldCheck,
  FileEdit,
  Trash2,
  Ban,
  User,
  Loader2,
} from "lucide-react";

export interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Doc<"invoices"> | null;
  canManage?: boolean;
  onEdit?: (invoice: Doc<"invoices">) => void;
  onCancel?: (invoice: Doc<"invoices">) => void;
  onDelete?: (invoice: Doc<"invoices">) => void;
  onVerify?: (invoiceNumber: string) => void;
  isVerifying?: boolean;
}

export function InvoiceDetailsModal({
  isOpen,
  onClose,
  invoice,
  canManage = false,
  onEdit,
  onCancel,
  onDelete,
  onVerify,
  isVerifying = false,
}: InvoiceDetailsModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !invoice || typeof document === "undefined") return null;

  const handleCopyLink = () => {
    const url = `${window.location.origin}/invoice/${invoice.invoiceNumber}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isEditable = canManage && (invoice.status === "draft" || invoice.status === "pending");
  const isCancellable = canManage && (invoice.status === "draft" || invoice.status === "pending");
  const isDeletable = canManage && (invoice.status === "draft" || invoice.status === "cancelled" || invoice.status === "expired");

  const getStatusPill = () => {
    if (invoice.status === "pending" && invoice.isAwaitingConfirmation) {
      return (
        <StatusPill tone="warning" className="text-xs font-medium">
          {t("treasury.invoices.statusAwaitingVerification", "Awaiting Verification")}
        </StatusPill>
      );
    }

    let tone: StatusTone = "neutral";
    let label = t("treasury.invoices.statusDraft", "Draft");

    switch (invoice.status) {
      case "paid":
        tone = "success";
        label = t("treasury.invoices.statusPaid", "Paid");
        break;
      case "pending":
        tone = "warning";
        label = t("treasury.invoices.statusPending", "Pending");
        break;
      case "cancelled":
        tone = "danger";
        label = t("treasury.invoices.statusCancelled", "Cancelled");
        break;
      case "expired":
        tone = "danger";
        label = t("treasury.invoices.statusExpired", "Expired");
        break;
    }

    return <StatusPill tone={tone} className="text-xs font-medium">{label}</StatusPill>;
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Panel className="bg-card border-border/80 shadow-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 text-primary">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {invoice.title}
                </h3>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span className="font-mono">#{invoice.invoiceNumber}</span>
                  <span>•</span>
                  <span className="uppercase text-[10px] font-medium tracking-wider">{invoice.type}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {getStatusPill()}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-[var(--fintech-radius-sm)] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Payer Summary Card */}
            <div className="p-3.5 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-md)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {invoice.payerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">
                    {t("treasury.invoices.payer", "Payer")}
                  </span>
                  <p className="font-semibold text-xs text-foreground truncate">
                    {invoice.payerName}
                  </p>
                  {invoice.payerEmail && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {invoice.payerEmail}
                    </p>
                  )}
                </div>
              </div>

              {invoice.userId && (
                <StatusPill tone="info" className="text-[10px] py-0 px-1.5">
                  <User className="w-3 h-3 mr-1" />
                  {t("treasury.invoices.memberRecipient", "Member")}
                </StatusPill>
              )}
            </div>

            {/* Description */}
            {invoice.description && (
              <div className="p-3 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-md)] text-xs text-muted-foreground">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium block mb-1">
                  {t("treasury.invoices.itemDesc", "Description")}
                </span>
                <p className="whitespace-pre-line text-foreground/90">{invoice.description}</p>
              </div>
            )}

            {/* Line Items for Dues */}
            {invoice.type === "dues" && invoice.periodLabels && invoice.periodLabels.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium block px-1">
                  {t("treasury.invoices.checkout.lineItems", "Items")} ({invoice.periodLabels.length} {invoice.periodLabels.length > 1 ? "cycles" : "cycle"})
                </span>
                <div className="divide-y divide-border/40 border border-border/70 rounded-[var(--fintech-radius-md)] overflow-hidden max-h-36 overflow-y-auto">
                  {invoice.periodLabels.map((label, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 flex items-center justify-between text-xs bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium text-foreground">{label}</span>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {invoice.currency} {(invoice.subtotal / invoice.periodLabels!.length).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Breakdown */}
            <div className="p-3.5 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-md)] space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("treasury.invoices.subtotal", "Subtotal")}</span>
                <span className="font-mono">{invoice.currency} {invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("treasury.invoices.fee", "Gateway Fee")}</span>
                <span className="font-mono">+ {invoice.currency} {invoice.gatewayFee.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-border/70 flex items-center justify-between text-foreground font-semibold text-sm">
                <span>{t("treasury.invoices.total", "Total")}</span>
                <span className="font-mono text-primary font-bold text-base">
                  {invoice.currency} {invoice.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Metadata Section */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-sm)]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">
                  {t("treasury.invoices.checkout.issueDate", "Issued")}
                </span>
                <span className="text-foreground font-mono text-[11px]">
                  {new Date(invoice.createdAt).toLocaleDateString()}
                </span>
              </div>

              {invoice.paidAt && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-[var(--fintech-radius-sm)]">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-400 block font-semibold">
                    {t("treasury.invoices.statusPaid", "Paid Date")}
                  </span>
                  <span className="text-emerald-300 font-mono text-[11px]">
                    {new Date(invoice.paidAt).toLocaleDateString()}
                  </span>
                </div>
              )}

              {invoice.expiresAt && !invoice.paidAt && (
                <div className="p-2.5 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-sm)]">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">
                    {t("treasury.invoices.checkout.expiresIn", "Expires")}
                  </span>
                  <span className="text-foreground font-mono text-[11px]">
                    {new Date(invoice.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}

              {invoice.selectedMethod && (
                <div className="p-2.5 bg-muted/15 border border-border/50 rounded-[var(--fintech-radius-sm)]">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-medium">
                    {t("treasury.invoices.method", "Method")}
                  </span>
                  <span className="text-foreground uppercase font-mono text-[11px]">
                    {invoice.selectedMethod} {invoice.selectedBankCode ? `(${invoice.selectedBankCode})` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* CLE Cryptographic Ledger Record */}
            {invoice.ledgerEntryId && (
              <div className="p-2.5 bg-primary/10 border border-primary/25 rounded-[var(--fintech-radius-sm)] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-primary font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>CLE Ledger Record</span>
                </div>
                <Link
                  href={`/tx/${invoice.ledgerEntryId}`}
                  className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>Block Proof</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t("treasury.invoices.copied", "Copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.copyPaymentLink", "Copy Link")}</span>
                  </>
                )}
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Link href={`/invoice/${invoice.invoiceNumber}`}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.openInvoice", "Open Invoice")}</span>
                </Link>
              </Button>

              {invoice.status === "pending" && onVerify && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isVerifying}
                  onClick={() => onVerify(invoice.invoiceNumber)}
                  className="h-8 text-xs text-amber-400 hover:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  {isVerifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{t("treasury.invoices.verify", "Verify")}</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditable && onEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(invoice)}
                  className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <FileEdit className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.editBtn", "Edit")}</span>
                </Button>
              )}

              {isCancellable && onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCancel(invoice)}
                  className="h-8 text-xs text-amber-400 hover:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.cancelBtn", "Cancel")}</span>
                </Button>
              )}

              {isDeletable && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(invoice)}
                  className="h-8 text-xs text-rose-400 hover:text-rose-300 border-rose-500/40 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.deleteBtn", "Delete")}</span>
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
