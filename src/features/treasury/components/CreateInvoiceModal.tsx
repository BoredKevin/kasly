import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import { CreditCard, CalendarDays, AlertCircle, X } from "lucide-react";

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  targetUserId?: Id<"users">;
  prefillPeriodCount?: number;
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  targetUserId,
  prefillPeriodCount,
}: CreateInvoiceModalProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const myMembership = useQuery(api.members.getMyMembership, { organizationId });
  const effectiveUserId = targetUserId || myMembership?.userId;

  const unpaidPeriods = useQuery(
    api.treasury.dues.getMemberUnpaidPeriods,
    organizationId && fundId && effectiveUserId
      ? { organizationId, fundId, userId: effectiveUserId }
      : "skip"
  );

  const fund = useQuery(api.treasury.funds.get, fundId ? { fundId } : "skip");
  const createInvoice = useMutation(api.treasury.borderpay.createDuesInvoice);

  const [periodCount, setPeriodCount] = useState<number>(prefillPeriodCount || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || typeof document === "undefined") return null;

  const maxPeriods = unpaidPeriods?.length || 0;
  const currentCount = Math.min(Math.max(1, periodCount), maxPeriods || 1);

  const selectedPeriods = (unpaidPeriods || []).slice(0, currentCount);
  const subtotal = selectedPeriods.reduce((sum, p) => sum + p.amount, 0);

  const handleProceed = async () => {
    if (!effectiveUserId || maxPeriods === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const invoiceNumber = await createInvoice({
        organizationId,
        fundId,
        periodCount: currentCount,
        targetUserId: effectiveUserId,
      });

      onClose();
      setLocation(`/invoice/${invoiceNumber}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <Card telemetry="TREASURY.DUES_INVOICE" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("treasury.invoices.payDuesTitle")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {fund?.name} • {t("treasury.invoices.duesSelectionHelp")}
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

          <CardContent className="pt-5 space-y-4">
            {error && (
              <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {unpaidPeriods === undefined ? (
              <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-mono">
                Loading unpaid cycles...
              </div>
            ) : maxPeriods === 0 ? (
              <div className="py-6 text-center space-y-2">
                <Badge variant="success" className="text-xs px-2.5 py-1 font-mono">
                  {t("treasury.overview.allPaid")}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  No unpaid dues periods found for this fund.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Period Count Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground block">
                    {t("treasury.invoices.selectPeriodCount")}
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={currentCount === 1 ? "cyber" : "outline"}
                      size="sm"
                      chamfer="dual"
                      onClick={() => setPeriodCount(1)}
                      className="text-xs cursor-pointer"
                    >
                      1 Cycle
                    </Button>

                    {maxPeriods > 1 && (
                      <Button
                        type="button"
                        variant={currentCount === 2 ? "cyber" : "outline"}
                        size="sm"
                        chamfer="dual"
                        onClick={() => setPeriodCount(2)}
                        className="text-xs cursor-pointer"
                      >
                        2 Cycles
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant={currentCount === maxPeriods ? "cyber" : "outline"}
                      size="sm"
                      chamfer="dual"
                      onClick={() => setPeriodCount(maxPeriods)}
                      className="text-xs cursor-pointer"
                    >
                      All ({maxPeriods})
                    </Button>
                  </div>
                </div>

                {/* Selected Periods List */}
                <div className="p-3 bg-muted/20 border border-border/70 space-y-2">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                    {t("treasury.invoices.checkout.lineItems")} ({selectedPeriods.length})
                  </span>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {selectedPeriods.map((p) => (
                      <div
                        key={p.membershipId}
                        className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-b-0 font-mono"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <CalendarDays className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{p.periodLabel}</span>
                        </div>
                        <span className="font-semibold text-foreground shrink-0">
                          {fund?.currency || "IDR"} {p.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Calculation */}
                <div className="p-3 bg-primary/5 border border-primary/30 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">
                    {t("treasury.invoices.subtotal")}
                  </span>
                  <span className="font-mono text-base font-bold text-primary">
                    {fund?.currency || "IDR"} {subtotal.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
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

              {maxPeriods > 0 && (
                <Button
                  type="button"
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleProceed();
                  }}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting
                    ? t("treasury.invoices.generatingInvoice")
                    : t("treasury.invoices.generateInvoiceBtn")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
