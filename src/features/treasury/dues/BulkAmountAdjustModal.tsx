import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { AlertCircle, Loader2, Coins } from "lucide-react";

export interface BulkAmountAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  cycleIds: Id<"duesEvents">[];
  currency?: string;
  defaultAmount?: number;
  onSuccess?: () => void;
}

export function BulkAmountAdjustModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  cycleIds,
  currency = "IDR",
  defaultAmount = 20000,
  onSuccess,
}: BulkAmountAdjustModalProps) {
  const { t } = useTranslation();
  const bulkAdjustAmounts = useMutation(api.treasury.dues.bulkAdjustAmounts);

  const [amountInput, setAmountInput] = useState<string>(defaultAmount.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cycleIds.length === 0) return;

    const parsedAmount = parseInt(amountInput.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive integer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await bulkAdjustAmounts({
        organizationId,
        fundId,
        duesEventIds: cycleIds,
        amount: parsedAmount,
      });

      if (result.skippedCount > 0 && result.updatedCount === 0) {
        setError("All selected cycles already have payments recorded in the ledger and their rates could not be modified.");
        setIsSubmitting(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to adjust dues amount.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.dues.adjustAmountModalTitle", "Adjust Dues Rate")}
      description={t(
        "treasury.dues.adjustAmountModalDesc",
        `Update amount per member for ${cycleIds.length} selected unpaid cycle(s).`,
        { count: cycleIds.length }
      )}
      maxWidth="sm"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-1">
        {error && (
          <div className="p-3 rounded-[var(--fintech-radius-sm)] bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-primary" />
            <span>New Rate per Member ({currency}) *</span>
          </label>
          <Input
            type="text"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 20000"
            required
            disabled={isSubmitting}
            chamfer="none"
            className="w-full text-xs font-mono"
          />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t(
              "treasury.dues.adjustAmountHelp",
              "Cycles with already committed payments cannot have their amount modified."
            )}
          </p>
        </div>

        <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
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
            disabled={isSubmitting || !amountInput.trim()}
            className="h-8 text-xs cursor-pointer flex items-center justify-center gap-1.5 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("common.saving", "Saving...")}</span>
              </>
            ) : (
              <span>Apply New Rate</span>
            )}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
