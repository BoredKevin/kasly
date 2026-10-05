import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { Panel } from "../../../ui";
import { FileEdit, X, AlertCircle, Loader2 } from "lucide-react";

export interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Doc<"invoices"> | null;
  onSuccess?: () => void;
}

interface EditInvoiceModalContentProps {
  invoice: Doc<"invoices">;
  onClose: () => void;
  onSuccess?: () => void;
}

function EditInvoiceModalContent({
  invoice,
  onClose,
  onSuccess,
}: EditInvoiceModalContentProps) {
  const { t } = useTranslation();
  const updateInvoice = useMutation(api.treasury.borderpay.updateInvoice);

  const [title, setTitle] = useState(invoice.title);
  const [description, setDescription] = useState(invoice.description || "");
  const [payerName, setPayerName] = useState(invoice.payerName);
  const [payerEmail, setPayerEmail] = useState(invoice.payerEmail || "");
  const [amount, setAmount] = useState<number>(invoice.subtotal);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomAndDraft = invoice.type === "custom" && invoice.status === "draft";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !payerName.trim()) return;
    if (isCustomAndDraft && amount <= 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await updateInvoice({
        invoiceId: invoice._id,
        title: title.trim(),
        description: description.trim() || undefined,
        payerName: payerName.trim(),
        payerEmail: payerEmail.trim() || undefined,
        amount: isCustomAndDraft ? amount : undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update invoice.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <Panel className="bg-card border-border/80 shadow-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[var(--fintech-radius-sm)] bg-primary/10 border border-primary/25 text-primary">
                <FileEdit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {t("treasury.invoices.editModalTitle", "Edit Invoice")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  #{invoice.invoiceNumber}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="p-1.5 rounded-[var(--fintech-radius-sm)] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-[var(--fintech-radius-sm)] bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("treasury.invoices.fieldTitle", "Title")} *
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Server Maintenance"
                required
                disabled={isSubmitting}
                className="w-full h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("treasury.invoices.fieldPayerName", "Payer Name")} *
              </label>
              <Input
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Full name or company name"
                required
                disabled={isSubmitting}
                className="w-full h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("treasury.invoices.fieldPayerEmail", "Payer Email")}
              </label>
              <Input
                type="email"
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                placeholder="Optional notification email"
                disabled={isSubmitting}
                className="w-full h-9 text-xs"
              />
            </div>

            {isCustomAndDraft && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {t("treasury.invoices.fieldAmount", "Amount")} ({invoice.currency}) *
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  required
                  disabled={isSubmitting}
                  className="w-full h-9 text-xs font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t("treasury.invoices.fieldDescription", "Description")}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes, payment instructions, or details..."
                rows={3}
                disabled={isSubmitting}
                className="w-full p-2.5 bg-background border border-border/80 rounded-[var(--fintech-radius-sm)] text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-8 text-xs cursor-pointer"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !title.trim() || !payerName.trim()}
                className="h-8 text-xs cursor-pointer flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("common.saving", "Saving...")}</span>
                  </>
                ) : (
                  <span>{t("common.save", "Save Changes")}</span>
                )}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function EditInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}: EditInvoiceModalProps) {
  if (!isOpen || !invoice || typeof document === "undefined") return null;

  return createPortal(
    <EditInvoiceModalContent
      invoice={invoice}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
    document.body
  );
}
