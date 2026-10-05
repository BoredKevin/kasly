import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@boredkevin/ui";
import {
  FileEdit,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface EditInvoiceModalProps {
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
        <Card telemetry="TREASURY.EDIT_INVOICE" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
                  <FileEdit className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("treasury.invoices.editModalTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    {invoice.invoiceNumber} • {t("treasury.invoices.editModalDesc")}
                  </CardDescription>
                </div>
              </div>
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
          </CardHeader>

          <CardContent className="pt-5">
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
              {error && (
                <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {invoice.status === "pending" && (
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Payment session is already initiated for this invoice. Amount and dues cycles cannot be altered.
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  {t("treasury.invoices.itemTitle")}
                </label>
                <Input
                  type="text"
                  chamfer="dual"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="font-sans text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  {t("treasury.invoices.itemDesc")}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full text-xs bg-muted/20 border border-input rounded-none p-2 text-foreground focus:outline-none focus:border-primary font-sans resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  {t("treasury.invoices.recipientName")}
                </label>
                <Input
                  type="text"
                  chamfer="dual"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  required
                  className="font-sans text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground block">
                  {t("treasury.invoices.recipientEmail")}
                </label>
                <Input
                  type="email"
                  chamfer="dual"
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              {isCustomAndDraft && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    {t("treasury.invoices.itemAmount")}
                  </label>
                  <Input
                    type="number"
                    chamfer="dual"
                    min="1000"
                    step="500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={onClose}
                  className="text-xs cursor-pointer"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  disabled={isSubmitting || !title.trim() || !payerName.trim()}
                  className="text-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t("treasury.invoices.saving")}</span>
                    </>
                  ) : (
                    <span>{t("treasury.invoices.saveChanges")}</span>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
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
      key={invoice._id}
      invoice={invoice}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
    document.body
  );
}
