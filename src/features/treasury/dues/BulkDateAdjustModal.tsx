import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { AlertCircle, Loader2, CalendarRange, Plus, Minus } from "lucide-react";

export interface BulkDateAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  cycleIds: Id<"duesEvents">[];
  onSuccess?: () => void;
}

export function BulkDateAdjustModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  cycleIds,
  onSuccess,
}: BulkDateAdjustModalProps) {
  const { t } = useTranslation();
  const bulkAdjustDates = useMutation(api.treasury.dues.bulkAdjustDates);

  const [offsetDays, setOffsetDays] = useState<number>(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cycleIds.length === 0) return;
    if (offsetDays === 0) {
      setError("Offset cannot be 0 days.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await bulkAdjustDates({
        organizationId,
        fundId,
        duesEventIds: cycleIds,
        offsetDays,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to adjust due dates.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.dues.shiftDatesModalTitle", "Shift Due Dates")}
      description={t(
        "treasury.dues.shiftDatesModalDesc",
        `Adjust scheduled due dates for ${cycleIds.length} selected cycle(s).`,
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

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <CalendarRange className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.dues.shiftDaysLabel", "Offset in Days (+/-)")}</span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setOffsetDays((prev) => prev - 7)}
              className="h-8 text-xs cursor-pointer"
            >
              <Minus className="w-3 h-3 mr-1" /> 7d
            </Button>
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setOffsetDays((prev) => prev - 1)}
              className="h-8 text-xs cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </Button>
            <Input
              type="number"
              value={offsetDays}
              onChange={(e) => setOffsetDays(parseInt(e.target.value, 10) || 0)}
              disabled={isSubmitting}
              chamfer="none"
              className="h-8 text-center text-xs font-mono font-bold text-primary"
            />
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setOffsetDays((prev) => prev + 1)}
              className="h-8 text-xs cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setOffsetDays((prev) => prev + 7)}
              className="h-8 text-xs cursor-pointer"
            >
              <Plus className="w-3 h-3 mr-1" /> 7d
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {t(
              "treasury.dues.shiftDaysHelp",
              "Positive values move due dates into the future; negative values move dates earlier."
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
            disabled={isSubmitting || offsetDays === 0}
            className="h-8 text-xs cursor-pointer flex items-center justify-center gap-1.5 font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t("common.saving", "Saving...")}</span>
              </>
            ) : (
              <span>Shift {offsetDays > 0 ? `+${offsetDays}d` : `${offsetDays}d`}</span>
            )}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
