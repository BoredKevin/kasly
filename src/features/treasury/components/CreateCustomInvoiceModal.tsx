import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { ResponsiveDialog } from "../../../ui";
import {
  Button,
  Input,
} from "@boredkevin/ui";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Share2,
  Users,
  User,
  ChevronDown,
} from "lucide-react";
import { MemberSearchSelect } from "./MemberSearchSelect";

interface CreateCustomInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
}

interface CreateCustomInvoiceModalContentProps {
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
}

function CreateCustomInvoiceModalContent({
  onClose,
  organizationId,
  fundId,
}: CreateCustomInvoiceModalContentProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  const members = useQuery(api.members.list, organizationId ? { organizationId } : "skip");
  const createInvoice = useMutation(api.treasury.borderpay.createCustomInvoice);

  const [recipientType, setRecipientType] = useState<"member" | "guest">("member");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(50000);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success view state
  const [createdInvoiceNumber, setCreatedInvoiceNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0 || !payerName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createInvoice({
        organizationId,
        fundId,
        targetUserId: recipientType === "member" && selectedUserId ? (selectedUserId as Id<"users">) : undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        amount,
        payerName: payerName.trim(),
        payerEmail: payerEmail.trim() || undefined,
      });

      setCreatedInvoiceNumber(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const invoiceUrl = createdInvoiceNumber
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invoice/${createdInvoiceNumber}`
    : "";

  const handleCopyLink = () => {
    if (!invoiceUrl) return;
    void navigator.clipboard.writeText(invoiceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!createdInvoiceNumber) return;
    const msg = encodeURIComponent(
      `Halo ${payerName}, berikut invoice pembayaran untuk "${title}":\n${invoiceUrl}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  };

  return (
    <div className="space-y-4 pt-1">
      {createdInvoiceNumber ? (
              <div className="space-y-5 text-center py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-foreground">
                    {t("treasury.invoices.invoiceCreatedSuccess", "Invoice Created Successfully!")}
                  </h3>
                  <p className="text-xs font-mono text-primary font-bold">
                    {createdInvoiceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {t(
                      "treasury.invoices.shareInvoiceHelp",
                      "Share this payment link with the payer. They can pay via QRIS, Virtual Account, or E-Wallet."
                    )}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border text-left space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("treasury.invoices.titleCol", "Description")}:</span>
                    <span className="font-semibold text-foreground truncate max-w-[200px]">{title}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{t("treasury.invoices.payer", "Payer")}:</span>
                    <span className="font-semibold text-foreground">{payerName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2">
                    <span className="text-muted-foreground">{t("treasury.invoices.total", "Total")}:</span>
                    <span className="font-bold text-foreground font-mono">
                      {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="none"
                    onClick={handleCopyLink}
                    className="w-full text-xs font-mono flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{t("treasury.invoices.checkout.copied", "Copied to clipboard!")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{t("treasury.invoices.copyPaymentLink", "Copy Payment Link")}</span>
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="none"
                    onClick={handleShareWhatsApp}
                    className="w-full text-xs flex items-center justify-center gap-2 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{t("treasury.invoices.shareWhatsApp", "Share via WhatsApp")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    chamfer="none"
                    onClick={() => {
                      onClose();
                      setLocation(`/invoice/${createdInvoiceNumber}`);
                    }}
                    className="w-full text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.previewInvoice", "Preview Invoice")}</span>
                  </Button>
                </div>

                <div className="pt-2 border-t border-border/80 flex justify-end">
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
              <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
                {error && (
                  <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Recipient Mode Tabs */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/30 border border-border">
                  <Button
                    type="button"
                    variant={recipientType === "member" ? "cyber" : "ghost"}
                    size="sm"
                    chamfer="none"
                    onClick={() => setRecipientType("member")}
                    className="text-xs flex items-center justify-center gap-1.5 h-7 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.memberRecipient", "Organization Member")}</span>
                  </Button>

                  <Button
                    type="button"
                    variant={recipientType === "guest" ? "cyber" : "ghost"}
                    size="sm"
                    chamfer="none"
                    onClick={() => {
                      setRecipientType("guest");
                      setSelectedUserId("");
                    }}
                    className="text-xs flex items-center justify-center gap-1.5 h-7 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.guestRecipient", "Guest / External")}</span>
                  </Button>
                </div>

                {recipientType === "member" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("treasury.invoices.selectMemberToInvoice", "Select Member")} *
                    </label>
                    <MemberSearchSelect
                      members={members}
                      value={selectedUserId}
                      onChange={(newUserId) => {
                        setSelectedUserId(newUserId);
                        if (newUserId && members) {
                          const found = members.find((m) => m.userId === newUserId);
                          if (found) {
                            setPayerName(found.nickname || found.name || "");
                            setPayerEmail(found.email || "");
                          }
                        }
                      }}
                      placeholder={t("treasury.invoices.selectMemberPrompt", "Search and select a member...")}
                    />
                    {payerName && (
                      <p className="text-[11px] text-muted-foreground">
                        {t("treasury.invoices.invoicingAs", "Invoicing:")} <span className="text-foreground font-medium">{payerName}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("treasury.invoices.recipientName", "Payer Name")} *
                    </label>
                    <Input
                      type="text"
                      chamfer="none"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                      className="font-sans text-xs"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    {t("treasury.invoices.itemTitle", "Invoice Title")} *
                  </label>
                  <Input
                    type="text"
                    chamfer="none"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("treasury.invoices.itemTitlePlaceholder", "e.g. Annual T-Shirt, Event Ticket")}
                    required
                    className="font-sans text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    {t("treasury.invoices.itemAmount", "Amount (IDR)")} *
                  </label>
                  <Input
                    type="number"
                    chamfer="none"
                    min="1000"
                    step="500"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                    className="font-mono text-xs"
                  />
                </div>

                {/* Collapsible Optional Details */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOptional(!showOptional)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors py-1 cursor-pointer"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showOptional ? "rotate-180" : ""}`} />
                    <span>{showOptional ? t("treasury.invoices.hideOptional", "Hide optional details") : t("treasury.invoices.showOptional", "+ Add Description & Email (Optional)")}</span>
                  </button>

                  {showOptional && (
                    <div className="space-y-3 pt-2 pl-3 border-l-2 border-border/60 animate-in fade-in-50 duration-150">
                      {recipientType === "member" && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground block">
                            {t("treasury.invoices.recipientName", "Payer Display Name")}
                          </label>
                          <Input
                            type="text"
                            chamfer="none"
                            value={payerName}
                            onChange={(e) => setPayerName(e.target.value)}
                            placeholder="John Doe"
                            className="font-sans text-xs"
                          />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground block">
                          {t("treasury.invoices.recipientEmail", "Email Address")}
                        </label>
                        <Input
                          type="email"
                          chamfer="none"
                          value={payerEmail}
                          onChange={(e) => setPayerEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground block">
                          {t("treasury.invoices.itemDesc", "Description")}
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Details about this payment..."
                          rows={2}
                          className="w-full text-xs bg-muted/20 border border-input rounded-none p-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-sans resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
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
                  <Button
                    type="submit"
                    variant="cyber"
                    size="sm"
                    chamfer="none"
                    disabled={isSubmitting || !title.trim() || amount <= 0 || !payerName.trim() || (recipientType === "member" && !selectedUserId)}
                    className="text-xs cursor-pointer"
                  >
                    {isSubmitting
                      ? t("treasury.invoices.creating")
                      : t("treasury.invoices.createBtn")}
                  </Button>
                </div>
              </form>
            )}
    </div>
  );
}

export function CreateCustomInvoiceModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
}: CreateCustomInvoiceModalProps) {
  const { t } = useTranslation();

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.invoices.customModalTitle", "Create Custom Invoice")}
      description={t(
        "treasury.invoices.customModalDesc",
        "Generate a standalone invoice with custom amount and purpose."
      )}
      maxWidth="md"
    >
      <CreateCustomInvoiceModalContent
        onClose={onClose}
        organizationId={organizationId}
        fundId={fundId}
      />
    </ResponsiveDialog>
  );
}
