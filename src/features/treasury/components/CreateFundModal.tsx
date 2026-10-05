import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import { Button, Input } from "@boredkevin/ui";
import { Sparkles } from "lucide-react";

interface CreateFundModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  onSuccess?: (fundId: Id<"funds">) => void;
}

export function CreateFundModal({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
}: CreateFundModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFund = useMutation(api.treasury.funds.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currency.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const fundId = await createFund({
        organizationId,
        name: name.trim(),
        currency: currency.trim().toUpperCase(),
        description: description.trim() ? description.trim() : undefined,
      });

      setName("");
      setCurrency("IDR");
      setDescription("");
      onSuccess?.(fundId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create fund.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.createFund.title", "Create Treasury Fund")}
      description={t(
        "treasury.createFund.description",
        "Add an isolated account for dues, projects, or operating cash."
      )}
      maxWidth="md"
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 pt-1">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t("treasury.createFund.fundName", "Fund Name")} *
          </label>
          <Input
            type="text"
            placeholder="e.g. General Operating Fund, Event Pool"
            value={name}
            disabled={isSubmitting}
            onChange={(e) => setName(e.target.value)}
            chamfer="none"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t("treasury.createFund.currency", "Currency")} *
          </label>
          <Input
            type="text"
            placeholder="e.g. IDR, USD, EUR"
            value={currency}
            disabled={isSubmitting}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            chamfer="none"
            maxLength={10}
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Standard currency code (e.g. IDR, USD). Cannot be changed after creation.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            {t("treasury.createFund.fundDescription", "Description")}
          </label>
          <Input
            type="text"
            placeholder="Purpose of this fund (optional)"
            value={description}
            disabled={isSubmitting}
            onChange={(e) => setDescription(e.target.value)}
            chamfer="none"
          />
        </div>

        {error && (
          <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs rounded-[var(--fintech-radius-sm)]">
            {error}
          </div>
        )}

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            chamfer="none"
            onClick={onClose}
            disabled={isSubmitting}
            size="sm"
            className="text-xs cursor-pointer"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            type="submit"
            variant="cyber"
            chamfer="none"
            size="sm"
            disabled={isSubmitting || !name.trim() || !currency.trim()}
            className="text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
          >
            {isSubmitting ? (
              <span>{t("common.loading", "Creating...")}</span>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("treasury.createFund.submit", "Create Fund")}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
