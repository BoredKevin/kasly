import { useState } from "react";
import { useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from "@boredkevin/ui";
import { Receipt, AlertCircle } from "lucide-react";

interface CreateCustomInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
}

export function CreateCustomInvoiceModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
}: CreateCustomInvoiceModalProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const createCustomInvoice = useMutation(api.treasury.borderpay.createCustomInvoice);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(50000);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const invoiceNumber = await createCustomInvoice({
        organizationId,
        fundId,
        title: title.trim(),
        description: description.trim() || undefined,
        amount,
        payerName: payerName.trim() || "Customer",
        payerEmail: payerEmail.trim() || undefined,
      });

      onClose();
      setLocation(`/invoice/${invoiceNumber}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create custom invoice.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {t("treasury.invoices.customModalTitle")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("treasury.invoices.customModalDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit(e);
          }}
          className="space-y-4 py-2"
        >
          {error && (
            <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
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
              placeholder={t("treasury.invoices.itemTitlePlaceholder")}
              required
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              {t("treasury.invoices.itemAmount")}
            </label>
            <Input
              type="number"
              chamfer="dual"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1000}
              required
              className="text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                {t("treasury.invoices.recipientName")}
              </label>
              <Input
                type="text"
                chamfer="dual"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="text-xs"
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
                placeholder="optional@example.com"
                className="text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground block">
              {t("treasury.invoices.itemDesc")}
            </label>
            <Input
              type="text"
              chamfer="dual"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes for payer"
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="dual"
              onClick={onClose}
              className="text-xs"
            >
              {t("common.cancel")}
            </Button>

            <Button
              type="submit"
              variant="cyber"
              size="sm"
              chamfer="dual"
              disabled={isSubmitting || !title.trim() || amount <= 0}
              className="text-xs"
            >
              {isSubmitting
                ? t("treasury.invoices.creating")
                : t("treasury.invoices.createBtn")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
