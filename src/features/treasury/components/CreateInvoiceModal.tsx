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
  CalendarDays,
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Share2,
} from "lucide-react";
import { MemberSearchSelect } from "./MemberSearchSelect";

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
                    variant="cyber"
                    size="sm"
                    chamfer="none"
                    onClick={handleCopyLink}
                    className="w-full text-xs flex items-center justify-center gap-2 cursor-pointer h-9"
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
                          chamfer="none"
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
                            chamfer="none"
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
                          chamfer="none"
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
                    chamfer="none"
                    onClick={onClose}
                    className="text-xs cursor-pointer"
                  >
                    {t("common.cancel")}
                  </Button>

                  {maxPeriods > 0 && effectiveUserId && (
                    <Button
                      type="button"
                      variant="cyber"
                      size="sm"
                      chamfer="none"
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
