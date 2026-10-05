import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Doc } from "../../../../convex/_generated/dataModel";
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
  X,
  Copy,
  Check,
  ExternalLink,
  CalendarDays,
  Clock,
  ShieldCheck,
  FileEdit,
  Trash2,
  Ban,
  User,
  Loader2,
} from "lucide-react";

interface InvoiceDetailsModalProps {
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

  const getStatusBadge = () => {
    if (invoice.status === "pending" && invoice.isAwaitingConfirmation) {
      return (
        <Badge
          variant="outline"
          className="text-xs font-mono font-bold px-2 py-0.5 border flex items-center gap-1 shrink-0 bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{t("treasury.invoices.statusAwaitingVerification", "Awaiting Verification")}</span>
        </Badge>
      );
    }

    switch (invoice.status) {
      case "paid":
        return (
          <Badge
            variant="outline"
            className="text-xs font-mono font-bold px-2 py-0.5 border flex items-center gap-1 shrink-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t("treasury.invoices.statusPaid")}</span>
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="text-xs font-mono font-bold px-2 py-0.5 border flex items-center gap-1 shrink-0 bg-amber-500/15 text-amber-300 border-amber-500/30"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{t("treasury.invoices.statusPending")}</span>
          </Badge>
        );
      case "cancelled":
        return (
          <Badge
            variant="outline"
            className="text-xs font-mono font-bold px-2 py-0.5 border flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border-red-500/30"
          >
            <Ban className="w-3.5 h-3.5 text-red-400" />
            <span>{t("treasury.invoices.statusCancelled")}</span>
          </Badge>
        );
      case "expired":
        return (
          <Badge
            variant="outline"
            className="text-xs font-mono font-bold px-2 py-0.5 border flex items-center gap-1 shrink-0 bg-red-500/15 text-red-300 border-red-500/30"
          >
            <Clock className="w-3.5 h-3.5 text-red-400" />
            <span>{t("treasury.invoices.statusExpired")}</span>
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-xs font-mono font-bold px-2 py-0.5 border flex items-center gap-1 shrink-0 bg-muted/30 text-muted-foreground border-border/50"
          >
            <span>{t("treasury.invoices.statusDraft")}</span>
          </Badge>
        );
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <Card telemetry="TREASURY.INVOICE_DETAILS" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">
                      {invoice.title}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs font-mono flex items-center gap-2 mt-0.5">
                    <span>{invoice.invoiceNumber}</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                      {invoice.type}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                <Button
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={onClose}
                  className="h-7 w-7 p-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            {/* Payer Card */}
            <div className="p-3 bg-muted/20 border border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0 font-mono">
                  {invoice.payerName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                    {t("treasury.invoices.payer")}
                  </span>
                  <p className="font-semibold text-xs text-foreground truncate">
                    {invoice.payerName}
                  </p>
                  {invoice.payerEmail && (
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {invoice.payerEmail}
                    </p>
                  )}
                </div>
              </div>

              {invoice.userId && (
                <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0.5 shrink-0 bg-primary/10 text-primary border-primary/30">
                  <User className="w-3 h-3 mr-1" />
                  {t("treasury.invoices.memberRecipient", "Member")}
                </Badge>
              )}
            </div>

            {/* Description if present */}
            {invoice.description && (
              <div className="p-3 bg-muted/10 border border-border/60 text-xs text-muted-foreground">
                <span className="text-[10px] font-mono uppercase text-muted-foreground/70 block mb-1">
                  {t("treasury.invoices.itemDesc")}
                </span>
                <p className="whitespace-pre-line">{invoice.description}</p>
              </div>
            )}

            {/* Line Items & Cycles */}
            {invoice.type === "dues" && invoice.periodLabels && invoice.periodLabels.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  {t("treasury.invoices.checkout.lineItems")} ({invoice.periodLabels.length} {invoice.periodLabels.length > 1 ? "cycles" : "cycle"})
                </span>
                <div className="divide-y divide-border/40 border border-border/70 max-h-36 overflow-y-auto">
                  {invoice.periodLabels.map((label, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2 flex items-center justify-between text-xs font-mono bg-card"
                    >
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-primary" />
                        <span>{label}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {invoice.currency} {(invoice.subtotal / invoice.periodLabels!.length).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Breakdown Table */}
            <div className="p-3 bg-muted/20 border border-border space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("treasury.invoices.subtotal")}</span>
                <span>{invoice.currency} {invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{t("treasury.invoices.fee")}</span>
                <span>+ {invoice.currency} {invoice.gatewayFee.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-border/80 flex items-center justify-between text-foreground font-semibold text-sm">
                <span>{t("treasury.invoices.total")}</span>
                <span className="text-primary font-bold">
                  {invoice.currency} {invoice.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Metadata & Audit Section */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-muted-foreground">
              <div className="p-2.5 bg-muted/10 border border-border/60">
                <span className="text-[9px] uppercase text-muted-foreground/70 block">
                  {t("treasury.invoices.checkout.issueDate")}
                </span>
                <span className="text-foreground">
                  {new Date(invoice.createdAt).toLocaleString()}
                </span>
              </div>

              {invoice.paidAt && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30">
                  <span className="text-[9px] uppercase text-emerald-400 block font-semibold">
                    {t("treasury.invoices.statusPaid")}
                  </span>
                  <span className="text-emerald-300">
                    {new Date(invoice.paidAt).toLocaleString()}
                  </span>
                </div>
              )}

              {invoice.expiresAt && !invoice.paidAt && (
                <div className="p-2.5 bg-muted/10 border border-border/60">
                  <span className="text-[9px] uppercase text-muted-foreground/70 block">
                    {t("treasury.invoices.checkout.expiresIn")}
                  </span>
                  <span className="text-foreground">
                    {new Date(invoice.expiresAt).toLocaleString()}
                  </span>
                </div>
              )}

              {invoice.selectedMethod && (
                <div className="p-2.5 bg-muted/10 border border-border/60">
                  <span className="text-[9px] uppercase text-muted-foreground/70 block">
                    {t("treasury.invoices.method")}
                  </span>
                  <span className="text-foreground uppercase">
                    {invoice.selectedMethod} {invoice.selectedBankCode ? `(${invoice.selectedBankCode})` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* CLE Cryptographic Ledger Link */}
            {invoice.ledgerEntryId && (
              <div className="p-2.5 bg-primary/10 border border-primary/30 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1.5 text-primary">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>CLE Ledger Record</span>
                </div>
                <Link
                  href={`/tx/${invoice.ledgerEntryId}`}
                  className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>View Block Proof</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}

            {/* Actions Bar */}
            <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={handleCopyLink}
                  className="h-8 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t("treasury.invoices.copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t("treasury.invoices.copyPaymentLink")}</span>
                    </>
                  )}
                </Button>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  className="h-8 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  <Link href={`/invoice/${invoice.invoiceNumber}`}>
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.openInvoice")}</span>
                  </Link>
                </Button>

                {invoice.status === "pending" && onVerify && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    disabled={isVerifying}
                    onClick={() => onVerify(invoice.invoiceNumber)}
                    className="h-8 text-xs font-mono text-cyan-400 hover:text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isVerifying ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{t("treasury.invoices.verify")}</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {isEditable && onEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => onEdit(invoice)}
                    className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.editBtn")}</span>
                  </Button>
                )}

                {isCancellable && onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => onCancel(invoice)}
                    className="h-8 text-xs text-amber-400 hover:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.cancelBtn")}</span>
                  </Button>
                )}

                {isDeletable && onDelete && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => onDelete(invoice)}
                    className="h-8 text-xs text-rose-400 hover:text-rose-300 border-rose-500/40 hover:bg-rose-500/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.deleteBtn")}</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
