import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@boredkevin/ui";
import { Panel, StatusPill } from "../../../../../ui";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Building,
  ExternalLink,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { QrisTemplateCard } from "../components/QrisTemplateCard";
import { PaymentInstructionsGuide } from "../components/PaymentInstructionsGuide";
import { ExpiryCountdownTimer } from "../components/ExpiryCountdownTimer";
import { downloadBrandedQrisImage } from "../utils/qrisCanvasCompositor";

export interface InvoicePaymentViewProps {
  invoice: any;
  onBackToCheckout: () => void;
  onConfirmClaim: () => void;
  isConfirmingClaim: boolean;
  onSimulatePayment: () => void;
  isSimulating: boolean;
  onCancelInvoice: () => void;
  isCancelling: boolean;
  errorMessage: string | null;
}

export function InvoicePaymentView({
  invoice,
  onBackToCheckout,
  onConfirmClaim,
  isConfirmingClaim,
  onSimulatePayment,
  isSimulating,
  onCancelInvoice,
  isCancelling,
  errorMessage,
}: InvoicePaymentViewProps) {
  const { t, i18n } = useTranslation();
  const [isCopiedVa, setIsCopiedVa] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const qrImageUrl = invoice.qrString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=0&data=${encodeURIComponent(invoice.qrString)}`
    : null;

  const isTemanQris = Boolean(
    invoice?.gatewayProvider === "temanqris" || invoice?.payUrl?.includes("temanqris")
  );

  const handleCopyVa = () => {
    if (invoice.vaNumber) {
      void navigator.clipboard.writeText(invoice.vaNumber);
      setIsCopiedVa(true);
      setTimeout(() => setIsCopiedVa(false), 2000);
    }
  };

  const qrisDisplayName = invoice.qrisName || invoice.organizationName;

  const handleDownloadQr = async () => {
    if (!qrImageUrl) return;
    setIsDownloading(true);
    try {
      await downloadBrandedQrisImage({
        qrImageUrl,
        merchantName: qrisDisplayName,
        invoiceNumber: invoice.invoiceNumber,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between gap-2 max-w-sm sm:max-w-md mx-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          chamfer="none"
          onClick={onBackToCheckout}
          className="h-8 text-xs font-sans font-medium px-2 flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-[var(--fintech-radius-sm)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{i18n.language === "id" ? "Rincian Tagihan" : "Invoice Details"}</span>
        </Button>

        <StatusPill tone="warning">
          {t("treasury.invoices.statusPending", "Menunggu Pembayaran")}
        </StatusPill>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2 rounded-[var(--fintech-radius-sm)] max-w-sm sm:max-w-md mx-auto">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Prominent Countdown Timer Header */}
      <Panel className="bg-card border border-border/80 shadow-sm p-4 sm:p-5 rounded-[var(--fintech-radius-md)] max-w-sm sm:max-w-md mx-auto">
        <ExpiryCountdownTimer expiresAt={invoice.expiresAt} />
      </Panel>

      {/* 2. QRIS Mode: Authentic Template Card & Primary Action Pair */}
      {invoice.selectedMethod === "qris" && (
        <div className="space-y-4">
          {qrImageUrl ? (
            <QrisTemplateCard
              qrImageUrl={qrImageUrl}
              merchantName={qrisDisplayName}
              invoiceNumber={invoice.invoiceNumber}
            />
          ) : (
            <div className="p-12 text-center text-xs font-sans text-muted-foreground animate-pulse border border-border/60 rounded-xl bg-card">
              Generating Official QRIS Code...
            </div>
          )}

          {/* Action Row: [ Check Payment Status ] + [ Download QR ] */}
          {qrImageUrl && (
            <div className="max-w-sm sm:max-w-md mx-auto flex items-stretch gap-2">
              <Button
                type="button"
                variant="default"
                chamfer="none"
                size="default"
                disabled={isConfirmingClaim}
                onClick={onConfirmClaim}
                className="flex-1 font-sans font-semibold text-xs sm:text-sm h-11 flex items-center justify-center gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 rounded-[var(--fintech-radius-sm)] shadow-xs transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {isConfirmingClaim
                    ? t("treasury.invoices.checkout.checkingStatus", "Checking Status...")
                    : t("treasury.invoices.checkout.checkPaymentStatus", "Check Payment Status")}
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                chamfer="none"
                size="default"
                disabled={isDownloading}
                onClick={() => void handleDownloadQr()}
                title={t("treasury.invoices.checkout.downloadQr", "Download QR")}
                className="w-11 h-11 px-0 flex items-center justify-center font-sans border-border/80 hover:bg-muted/30 cursor-pointer rounded-[var(--fintech-radius-sm)] shrink-0"
              >
                <Download className={`w-4 h-4 ${isDownloading ? "animate-bounce" : ""}`} />
              </Button>
            </div>
          )}

          {/* Gateway external link (if Borderpay hosted redirect available) */}
          {invoice.payUrl && !isTemanQris && (
            <div className="max-w-sm sm:max-w-md mx-auto text-center">
              <a
                href={invoice.payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer transition-colors py-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>
                  {i18n.language === "id" ? "Buka Halaman Gateway" : "Open Gateway Page"}
                </span>
              </a>
            </div>
          )}

          {/* 3. Interactive Guide: "How to Pay" with Dual Phone Modes */}
          <PaymentInstructionsGuide />
        </div>
      )}

      {/* 3. Virtual Account Mode (Fallback if customer chose VA) */}
      {invoice.selectedMethod === "va" && (
        <Panel className="bg-card border border-border/80 shadow-sm p-4 sm:p-5 space-y-4 max-w-sm sm:max-w-md mx-auto font-sans rounded-[var(--fintech-radius-md)]">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs font-sans font-medium text-muted-foreground flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>Virtual Account Bank</span>
            </span>
            <StatusPill tone="info">
              {invoice.vaBank || "Virtual Account"}
            </StatusPill>
          </div>

          <div className="p-4 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-sm)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-sans uppercase text-muted-foreground tracking-wider block">
                {t("treasury.invoices.checkout.vaNumber", "VA Number")}
              </span>
              <span className="font-mono text-xl sm:text-2xl font-bold text-foreground tracking-wider block mt-0.5">
                {invoice.vaNumber || "---"}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={handleCopyVa}
              className="text-xs flex items-center justify-center gap-1.5 font-medium px-3 h-8 cursor-pointer rounded-[var(--fintech-radius-sm)] shrink-0"
            >
              {isCopiedVa ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>
                {isCopiedVa
                  ? t("treasury.invoices.checkout.copied", "Copied!")
                  : t("treasury.invoices.checkout.copyVa", "Copy Number")}
              </span>
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center font-sans leading-relaxed">
            {t(
              "treasury.invoices.checkout.transferVaPrompt",
              "Transfer exact amount to the Virtual Account number above."
            )}
          </p>

          <Button
            type="button"
            variant="default"
            chamfer="none"
            size="default"
            disabled={isConfirmingClaim}
            onClick={onConfirmClaim}
            className="w-full font-sans font-semibold text-xs h-11 flex items-center justify-center gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 rounded-[var(--fintech-radius-sm)] shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {isConfirmingClaim
                ? t("treasury.invoices.checkout.checkingStatus", "Checking Status...")
                : t("treasury.invoices.checkout.checkPaymentStatus", "Check Payment Status")}
            </span>
          </Button>
        </Panel>
      )}

      {/* 4. E-Wallet Mode */}
      {invoice.selectedMethod === "ewallet" && (
        <Panel className="bg-card border border-border/80 shadow-sm p-5 text-center space-y-4 max-w-sm sm:max-w-md mx-auto font-sans rounded-[var(--fintech-radius-md)]">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-foreground tracking-wide block">
              E-Wallet ({invoice.selectedBankCode || "E-Wallet"})
            </span>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {t("treasury.invoices.checkout.ewalletPrompt", "Complete payment in your e-wallet app:")}
            </p>
          </div>

          {invoice.checkoutUrl ? (
            <Button
              asChild
              variant="default"
              size="default"
              chamfer="none"
              className="w-full text-xs sm:text-sm font-semibold h-11 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 rounded-[var(--fintech-radius-sm)] shadow-xs flex items-center justify-center gap-1.5"
            >
              <a href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer">
                <span>
                  {t("treasury.invoices.checkout.openEwallet", {
                    wallet: invoice.selectedBankCode || "E-Wallet",
                  })}
                </span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
              </a>
            </Button>
          ) : (
            <div className="p-3 bg-muted/20 border border-border/60 text-xs text-muted-foreground rounded-[var(--fintech-radius-sm)]">
              E-wallet checkout link is being prepared.
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            chamfer="none"
            size="default"
            disabled={isConfirmingClaim}
            onClick={onConfirmClaim}
            className="w-full text-xs font-medium h-11 flex items-center justify-center gap-2 cursor-pointer rounded-[var(--fintech-radius-sm)]"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{t("treasury.invoices.checkout.checkPaymentStatus", "Check Payment Status")}</span>
          </Button>
        </Panel>
      )}

      {/* Sandbox Test Mode Simulation */}
      {invoice.isTestMode && (
        <div className="max-w-sm sm:max-w-md mx-auto p-3 bg-muted/40 border border-border/80 rounded-[var(--fintech-radius-sm)] flex items-center justify-between gap-2 font-sans">
          <span className="text-xs text-foreground font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Sandbox Mode</span>
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            disabled={isSimulating}
            onClick={onSimulatePayment}
            className="h-7 text-xs font-medium border-border/80 hover:bg-muted/50 rounded-[var(--fintech-radius-sm)] cursor-pointer"
          >
            <span>
              {isSimulating
                ? t("treasury.invoices.checkout.simulating", "Simulating...")
                : t("treasury.invoices.checkout.simulateBtn", "Simulate Payment")}
            </span>
          </Button>
        </div>
      )}

      {/* Footer Controls: Cancel Invoice */}
      <div className="max-w-sm sm:max-w-md mx-auto flex items-center justify-between gap-3 text-xs font-sans pt-2">
        <button
          type="button"
          onClick={onBackToCheckout}
          className="text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        >
          {i18n.language === "id" ? "← Rincian Tagihan" : "← Invoice Breakdown"}
        </button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          chamfer="none"
          disabled={isCancelling}
          onClick={onCancelInvoice}
          className="h-8 text-xs font-sans text-destructive hover:bg-destructive/10 border-destructive/30 px-3 cursor-pointer rounded-[var(--fintech-radius-sm)] font-medium"
        >
          {isCancelling
            ? t("treasury.invoices.checkout.cancelling", "Cancelling...")
            : t("treasury.invoices.checkout.cancelInvoice", "Cancel Invoice")}
        </Button>
      </div>
    </div>
  );
}
