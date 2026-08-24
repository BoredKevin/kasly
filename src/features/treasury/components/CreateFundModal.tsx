import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
} from "@boredkevin/ui";
import { Landmark, X, Sparkles } from "lucide-react";

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
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createFund = useMutation(api.treasury.funds.create);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="TREASURY.CREATE_FUND" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Create Treasury Fund
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Establish a new fund account with isolated cryptographic ledger
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
            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Fund Name *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. General Operating Fund, Event Pool"
                  value={name}
                  disabled={isSubmitting}
                  onChange={(e) => setName(e.target.value)}
                  chamfer="dual"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Currency Code (Immutable) *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. IDR, USD, EUR"
                  value={currency}
                  disabled={isSubmitting}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  chamfer="dual"
                  maxLength={10}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Standard currency code (e.g. IDR, USD). Cannot be changed after creation.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Description
                </label>
                <Input
                  type="text"
                  placeholder="Purpose of this fund"
                  value={description}
                  disabled={isSubmitting}
                  onChange={(e) => setDescription(e.target.value)}
                  chamfer="dual"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                  {error}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  onClick={onClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={isSubmitting || !name.trim() || !currency.trim()}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create Fund</span>
                    </>
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
