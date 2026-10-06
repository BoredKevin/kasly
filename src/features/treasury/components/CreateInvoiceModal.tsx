import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveDialog } from "../../../ui";
import {
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Share2,
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ChevronDown,
} from "lucide-react";
import { MemberSearchSelect } from "./MemberSearchSelect";

function formatPeriodsRange(periods: Array<{ periodLabel: string }>): string {
  if (periods.length === 0) return "-";
  if (periods.length === 1) return periods[0].periodLabel;
  const first = periods[0].periodLabel;
  const last = periods[periods.length - 1].periodLabel;
  if (first === last) return first;
  return `${first} – ${last}`;
}

interface CreateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  targetUserId?: Id<"users">;
  prefillPeriodCount?: number;
  initialMode?: "self" | "admin";
}

interface CreateInvoiceModalContentProps {
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  targetUserId?: Id<"users">;
  prefillPeriodCount?: number;
  initialMode?: "self" | "admin";
}

function CreateInvoiceModalContent({
  onClose,
  organizationId,
  fundId,
  targetUserId,
  prefillPeriodCount,
  initialMode,
}: CreateInvoiceModalContentProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const myMembership = useQuery(api.members.getMyMembership, { organizationId });
  const members = useQuery(api.members.list, organizationId ? { organizationId } : "skip");
  const fund = useQuery(api.treasury.funds.get, fundId ? { fundId } : "skip");
  const createInvoice = useMutation(api.treasury.borderpay.createDuesInvoice);

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  const isAdminMode = initialMode === "admin" || (canManage && !targetUserId);

  const [selectedUserId, setSelectedUserId] = useState<string>(
    targetUserId || (initialMode === "admin" ? "" : myMembership?.userId || "")
  );

  const [periodCount, setPeriodCount] = useState<number>(prefillPeriodCount || 1);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success view state
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveUserId = (selectedUserId || (isAdminMode ? null : myMembership?.userId)) as Id<"users"> | null;

  const unpaidPeriods = useQuery(
    api.treasury.dues.getMemberUnpaidPeriods,
    organizationId && fundId && effectiveUserId
      ? { organizationId, fundId, userId: effectiveUserId }
      : "skip"
  );

  const maxPeriods = unpaidPeriods?.length || 0;
  const currentCount = Math.min(Math.max(1, periodCount), maxPeriods || 1);

  const handleDecrement = () => {
    setPeriodCount((prev) => Math.max(1, prev - 1));
  };

  const handleIncrement = () => {
    setPeriodCount((prev) => Math.min(maxPeriods, prev + 1));
  };

  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    if (!raw) {
      setPeriodCount(1);
      return;
    }
    const val = parseInt(raw, 10);
    setPeriodCount(Math.min(maxPeriods, Math.max(1, val)));
  };

  const selectedPeriods = (unpaidPeriods || []).slice(0, currentCount);
  const subtotal = selectedPeriods.reduce((sum, p) => sum + p.amount, 0);

  const selectedMemberObj = members?.find(
    (m) => m.userId === effectiveUserId
  );
  const selectedMemberName = selectedMemberObj?.nickname || selectedMemberObj?.name || "Member";

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

      setIsSubmitting(false);

      // If admin created an invoice for someone else, stay on success screen to copy/share link
      if (canManage && effectiveUserId !== myMembership?.userId) {
        setCreatedInvoiceNumber(invoiceNumber);
      } else {
        onClose();
        setLocation(`/invoice/${invoiceNumber}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdInvoiceNumber) return;
    const url = `${window.location.origin}/invoice/${createdInvoiceNumber}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWhatsAppShareUrl = () => {
    if (!createdInvoiceNumber) return "";
    const url = `${window.location.origin}/invoice/${createdInvoiceNumber}`;
    const periodStr = selectedPeriods.map((p) => p.periodLabel).join(", ");
    const currencyStr = fund?.currency || "IDR";
    const text = t(
      "treasury.invoices.whatsappMessage",
      `Halo ${selectedMemberName}, berikut adalah tagihan kas untuk periode ${periodStr} sebesar ${currencyStr} ${subtotal.toLocaleString()}: ${url}`,
      {
        name: selectedMemberName,
        periods: periodStr,
        total: `${currencyStr} ${subtotal.toLocaleString()}`,
        url,
      }
    );
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Success State View */}
      {createdInvoiceNumber ? (
        <div className="py-4 space-y-5 animate-in fade-in zoom-in-95">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center shadow-lg">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-base text-foreground">
              {t("treasury.invoices.invoiceCreatedSuccess", "Invoice Created Successfully!")}
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {t(
                "treasury.invoices.shareInvoiceHelp",
                "Share this payment link with the member. They can pay via QRIS, Virtual Account, or E-Wallet."
              )}
            </p>
          </div>

          <div className="p-3 bg-muted/20 border border-border/80 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>{t("treasury.invoices.invoiceNumber")}</span>
              <span className="text-foreground font-semibold">{createdInvoiceNumber}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>{t("treasury.invoices.payer")}</span>
              <span className="text-foreground">{selectedMemberName}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Cycles ({selectedPeriods.length})</span>
              <span className="text-foreground truncate max-w-[180px]">
                {selectedPeriods.map((p) => p.periodLabel).join(", ")}
              </span>
            </div>
            <div className="pt-1.5 border-t border-border/60 flex items-center justify-between text-foreground font-semibold">
              <span>{t("treasury.invoices.total")}</span>
              <span className="text-primary font-bold">
                {fund?.currency || "IDR"} {subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Share Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button
              type="button"
              variant="default"
              size="sm"
              chamfer="none"
              onClick={handleCopyLink}
              className="w-full text-xs flex items-center justify-center gap-2 cursor-pointer h-9 rounded-[var(--fintech-radius-sm)]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{t("treasury.invoices.copied", "Copied to clipboard!")}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{t("treasury.invoices.copyPaymentLink", "Copy Payment Link")}</span>
                </>
              )}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                chamfer="none"
                className="text-xs flex items-center justify-center gap-1.5 cursor-pointer h-8 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              >
                <a href={getWhatsAppShareUrl()} target="_blank" rel="noopener noreferrer">
                  <Share2 className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </Button>

              <Button
                asChild
                variant="outline"
                size="sm"
                chamfer="none"
                className="text-xs flex items-center justify-center gap-1.5 cursor-pointer h-8"
              >
                <a
                  href={`/invoice/${createdInvoiceNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.previewInvoice", "Preview")}</span>
                </a>
              </Button>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={onClose}
              className="text-xs cursor-pointer"
            >
              {t("treasury.invoices.done", "Done")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Member Selector (for Admins) */}
          {canManage && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
                {t("treasury.invoices.selectMemberToInvoice", "Select Member to Invoice")}
              </label>
              <MemberSearchSelect
                members={members}
                value={selectedUserId}
                onChange={(newUserId) => {
                  setSelectedUserId(newUserId);
                  setPeriodCount(1);
                }}
                placeholder={t("treasury.invoices.selectMemberPrompt", "Search and select a member...")}
              />
            </div>
          )}

          {!effectiveUserId ? (
            <div className="py-8 text-center text-xs text-muted-foreground font-mono">
              Please select a member above to inspect unpaid cycles.
            </div>
          ) : unpaidPeriods === undefined ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse font-mono">
              Loading unpaid cycles...
            </div>
          ) : maxPeriods === 0 ? (
            <div className="py-6 text-center space-y-2">
              <Badge variant="success" className="text-xs px-2.5 py-1 font-mono">
                {t("treasury.overview.allPaid")}
              </Badge>
              <p className="text-xs text-muted-foreground font-mono">
                {selectedMemberName} has no outstanding unpaid dues in this fund.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dues Period Selector Card */}
              <div className="p-3.5 sm:p-4 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-sm)] space-y-3 font-sans shadow-xs">
                {/* Stepper & Preset Controls */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm sm:text-base font-bold text-foreground">
                      {t("treasury.invoices.cyclesToPay", "Siklus yang dibayar:")}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="none"
                        disabled={isSubmitting || currentCount <= 1}
                        onClick={handleDecrement}
                        className="h-9 w-9 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-30 rounded-[var(--fintech-radius-sm)] border-border/80 bg-background hover:bg-muted/50 text-foreground transition-all active:scale-95 shadow-xs"
                        aria-label="Decrease cycle count"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={currentCount}
                        disabled={isSubmitting}
                        onChange={handleCountChange}
                        className="h-9 w-12 p-0 text-center font-sans font-bold text-base bg-background border border-border/80 rounded-[var(--fintech-radius-sm)] text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary tabular-nums shrink-0 shadow-xs"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="none"
                        disabled={isSubmitting || currentCount >= maxPeriods}
                        onClick={handleIncrement}
                        className="h-9 w-9 p-0 flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-30 rounded-[var(--fintech-radius-sm)] border-border/80 bg-background hover:bg-muted/50 text-foreground transition-all active:scale-95 shadow-xs"
                        aria-label="Increase cycle count"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Preset Chips */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setPeriodCount(1)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer ${currentCount === 1
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-background/80 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                      {t("treasury.invoices.cycleSingle", "1 Siklus")}
                    </button>

                    {maxPeriods > 1 && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setPeriodCount(2)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer ${currentCount === 2
                          ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                          : "bg-background/80 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                          }`}
                      >
                        {t("treasury.invoices.cyclesMultiple", "{{count}} Siklus", { count: 2 })}
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setPeriodCount(maxPeriods)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer ${currentCount === maxPeriods
                        ? "bg-primary text-primary-foreground border-primary font-semibold shadow-xs"
                        : "bg-background/80 border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                        }`}
                    >
                      {t("treasury.invoices.allCycles", "Semua ({{count}})", { count: maxPeriods })}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border/60 pt-3 space-y-2.5">
                  {/* Covered cycle(s) row */}
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground font-semibold text-right sm:max-w-none">
                      {formatPeriodsRange(selectedPeriods)}
                    </span>
                  </div>

                  {/* Expandable Breakdown Toggle */}
                  <div className="pt-2 border-t border-border/40">
                    <button
                      type="button"
                      onClick={() => setShowBreakdown((prev) => !prev)}
                      className="flex items-center justify-between w-full py-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span>
                        {t("treasury.invoices.viewCycleBreakdown", "Rincian Siklus")} ({selectedPeriods.length})
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${showBreakdown ? "rotate-180" : ""
                          }`}
                      />
                    </button>

                    {showBreakdown && (
                      <div className="pt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1 animate-in fade-in duration-150">
                        {selectedPeriods.map((p) => (
                          <div
                            key={p.membershipId}
                            className="flex items-center justify-between py-1.5 px-2.5 rounded-[var(--fintech-radius-sm)] bg-background/50 border border-border/40 text-xs sm:text-sm"
                          >
                            <span className="truncate font-medium text-foreground">{p.periodLabel}</span>
                            <span className="text-muted-foreground shrink-0 tabular-nums font-sans">
                              {fund?.currency || "IDR"} {p.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Action Row (Unified with InvoiceCheckoutView design) */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/80">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground font-medium">
                {t("treasury.invoices.checkout.subtotal", "Subtotal Tagihan")}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-foreground font-sans tracking-tight mt-0.5 truncate tabular-nums">
                {fund?.currency || "IDR"} {subtotal.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {maxPeriods > 0 && effectiveUserId && (
                <Button
                  type="button"
                  variant="default"
                  chamfer="none"
                  size="default"
                  disabled={isSubmitting}
                  onClick={() => {
                    void handleProceed();
                  }}
                  aria-label={t("treasury.invoices.generateInvoiceBtn", "Lanjut ke Pembayaran")}
                  title={t("treasury.invoices.generateInvoiceBtn", "Lanjut ke Pembayaran")}
                  className="h-11 w-11 sm:h-12 sm:w-12 p-0 flex items-center justify-center cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 rounded-[var(--fintech-radius-sm)] shadow-md transition-all active:scale-95 shrink-0"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowRight className="w-5 h-5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function CreateInvoiceModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  targetUserId,
  prefillPeriodCount,
  initialMode,
}: CreateInvoiceModalProps) {
  const { t } = useTranslation();
  const fund = useQuery(api.treasury.funds.get, fundId ? { fundId } : "skip");

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.invoices.payDuesTitle", "Pay Member Dues")}
      description={
        fund
          ? `${fund.name} • ${t("treasury.invoices.duesSelectionHelp", "Generate online invoice for member dues")}`
          : undefined
      }
      maxWidth="md"
    >
      <CreateInvoiceModalContent
        onClose={onClose}
        organizationId={organizationId}
        fundId={fundId}
        targetUserId={targetUserId}
        prefillPeriodCount={prefillPeriodCount}
        initialMode={initialMode}
      />
    </ResponsiveDialog>
  );
}
