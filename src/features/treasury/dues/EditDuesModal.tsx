import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button, Input, Badge } from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { AlertCircle, Loader2, Calendar, Coins, Tag, Lock, Archive } from "lucide-react";

export interface EditDuesModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  cycle: {
    _id: Id<"duesEvents">;
    periodLabel: string;
    dueDate: number;
    amount: number;
    totalMembers: number;
    paidCount: number;
    isArchived?: boolean;
  } | null;
  currency?: string;
  onSuccess?: () => void;
}

function formatDateToInput(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EditDuesModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  cycle,
  currency = "IDR",
  onSuccess,
}: EditDuesModalProps) {
  const { t } = useTranslation();
  const updateCycle = useMutation(api.treasury.dues.updateDuesCycle);

  const [periodLabel, setPeriodLabel] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [isArchived, setIsArchived] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cycle && isOpen) {
      setPeriodLabel(cycle.periodLabel);
      setDateInput(formatDateToInput(cycle.dueDate));
      setAmountInput(cycle.amount.toString());
      setIsArchived(Boolean(cycle.isArchived));
      setError(null);
    }
  }, [cycle, isOpen]);

  if (!isOpen || !cycle) return null;

  const hasPaidMembers = cycle.paidCount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodLabel.trim()) {
      setError("Period label cannot be empty.");
      return;
    }

    const selectedDateTime = new Date(dateInput + "T12:00:00").getTime();
    if (isNaN(selectedDateTime) || selectedDateTime <= 0) {
      setError("Please select a valid due date.");
      return;
    }

    const parsedAmount = parseInt(amountInput.replace(/[^0-9]/g, ""), 10);
    if (!hasPaidMembers && (isNaN(parsedAmount) || parsedAmount <= 0)) {
      setError("Amount must be a positive integer.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateCycle({
        organizationId,
        fundId,
        duesEventId: cycle._id,
        periodLabel: periodLabel.trim(),
        dueDate: selectedDateTime,
        amount: hasPaidMembers ? undefined : parsedAmount,
        isArchived,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update dues cycle.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.dues.editCycleModalTitle", "Edit Due Cycle")}
      description={t("treasury.dues.editCycleModalDesc", "Update title, trigger date, or amount for this cycle.")}
      maxWidth="md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-1">
        {error && (
          <div className="p-3 rounded-[var(--fintech-radius-sm)] bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Period Label */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.dues.periodLabel", "Period Label")} *</span>
          </label>
          <Input
            type="text"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="e.g. August 2026, Week 35, 2026"
            required
            disabled={isSubmitting}
            chamfer="none"
            className="w-full text-xs font-mono"
          />
        </div>

        {/* Due Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.dues.dueDate", "Due Date")} *</span>
          </label>
          <Input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            required
            disabled={isSubmitting}
            chamfer="none"
            className="w-full text-xs font-mono cursor-pointer"
          />
        </div>

        {/* Amount per Member */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span>{t("treasury.dues.amountPerMember", "Amount per Member")} ({currency}) *</span>
            </label>
            {hasPaidMembers && (
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Locked ({cycle.paidCount} paid)</span>
              </Badge>
            )}
          </div>
          <Input
            type="text"
            value={amountInput}
            onChange={(e) => {
              if (!hasPaidMembers) {
                setAmountInput(e.target.value.replace(/[^0-9]/g, ""));
              }
            }}
            disabled={isSubmitting || hasPaidMembers}
            chamfer="none"
            className={`w-full text-xs font-mono ${hasPaidMembers ? "opacity-60 bg-muted/40 cursor-not-allowed" : ""}`}
            required
          />
          {hasPaidMembers && (
            <p className="text-[11px] text-amber-400/90 leading-relaxed">
              {t(
                "treasury.dues.adjustAmountHelp",
                "Cycles with already committed payments cannot have their amount modified."
              )}
            </p>
          )}
        </div>

        {/* Archival Status Toggle */}
        <div className="pt-2 border-t border-border/60">
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={isArchived}
              onChange={(e) => setIsArchived(e.target.checked)}
              disabled={isSubmitting}
              className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
            />
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-xs font-medium text-foreground">
                  {t("treasury.dues.statusArchived", "Archived")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Archived cycles are hidden from active spreadsheets and member dues banners while keeping ledger audit proofs intact.
              </p>
            </div>
          </label>
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
            disabled={isSubmitting || !periodLabel.trim() || !dateInput}
            className="h-8 text-xs cursor-pointer flex items-center justify-center gap-1.5 font-semibold"
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
    </ResponsiveDialog>
  );
}
