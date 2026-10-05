import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { AlertCircle, Loader2, ChevronDown } from "lucide-react";

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
  const [showOptional, setShowOptional] = useState(Boolean(invoice.description || invoice.payerEmail));

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
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-1">
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
          chamfer="none"
          className="w-full text-xs"
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
          chamfer="none"
          className="w-full text-xs"
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
            chamfer="none"
            className="w-full text-xs font-mono"
          />
        </div>
      )}

      {/* Collapsible Optional Details */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors py-1 cursor-pointer"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showOptional ? "rotate-180" : ""}`} />
          <span>{showOptional ? "Hide optional details" : "+ Edit Email & Description (Optional)"}</span>
        </button>

        {showOptional && (
          <div className="space-y-3 pt-2 pl-3 border-l-2 border-border/60 animate-in fade-in-50 duration-150">
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
                chamfer="none"
                className="w-full text-xs font-mono"
              />
            </div>

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
                className="w-full p-2.5 bg-background border border-border/80 rounded-[var(--fintech-radius-sm)] text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans resize-none"
              />
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-border/60 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          chamfer="none"
          onClick={onClose}
          disabled={isSubmitting}
          className="h-8 text-xs cursor-pointer"
        >
          {t("common.cancel", "Cancel")}
        </Button>
        <Button
          type="submit"
          variant="cyber"
          size="sm"
          chamfer="none"
          disabled={isSubmitting || !title.trim() || !payerName.trim() || (isCustomAndDraft && amount <= 0)}
          className="h-8 text-xs cursor-pointer flex items-center justify-center gap-1.5"
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
  );
}

export function EditInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onSuccess,
}: EditInvoiceModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !invoice) return null;

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.invoices.editModalTitle", "Edit Invoice")}
      description={`#${invoice.invoiceNumber}`}
      maxWidth="md"
    >
      <EditInvoiceModalContent
        invoice={invoice}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </ResponsiveDialog>
  );
}
