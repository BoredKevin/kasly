import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, Button, Badge } from "@boredkevin/ui";
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
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          chamfer="dual"
          onClick={onBackToCheckout}
          className="h-8 text-xs font-sans font-medium px-2.5 flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{i18n.language === "id" ? "Rincian Tagihan" : "Invoice Details"}</span>
        </Button>

        <Badge
          variant="warning"
          className="font-mono text-[11px] px-2.5 py-0.5 font-bold"
        >
          {t("treasury.invoices.checkout.pending", "PENDING")}
        </Badge>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2 rounded">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Prominent Countdown Timer Header (ESB Inspired) */}
      <Card
        cornerLines={false}
        className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-4 sm:p-5"
      >
        <ExpiryCountdownTimer expiresAt={invoice.expiresAt} />
      </Card>

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
                variant="cyber"
                chamfer="dual"
                size="default"
                disabled={isConfirmingClaim}
                onClick={onConfirmClaim}
                className="flex-1 font-sans font-bold text-xs sm:text-sm h-11 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
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
                chamfer="dual"
                size="default"
                disabled={isDownloading}
                onClick={() => void handleDownloadQr()}
                title={t("treasury.invoices.checkout.downloadQr", "Download QR")}
                className="w-12 h-11 px-0 flex items-center justify-center font-sans border-border/80 hover:border-primary/50 cursor-pointer shrink-0"
              >
                <Download className={`w-4 h-4 ${isDownloading ? "animate-bounce" : ""}`} />
              </Button>
            </div>
          )}

          {/* Gateway external link (if Borderpay hosted redirect available) */}
          {invoice.payUrl && !isTemanQris && (
            <div className="max-w-sm sm:max-w-md mx-auto">
              <Button
                asChild
                variant="ghost"
                size="sm"
                chamfer="dual"
                className="w-full text-xs font-sans text-muted-foreground hover:text-foreground"
              >
                <a href={invoice.payUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  <span>
                    {i18n.language === "id" ? "Buka Halaman Gateway" : "Open Gateway Page"}
                  </span>
                </a>
              </Button>
            </div>
          )}

          {/* 3. Interactive Guide: "How to Pay" with Dual Phone Modes */}
          <PaymentInstructionsGuide />
        </div>
      )}

      {/* 3. Virtual Account Mode (Fallback if customer chose VA) */}
      {invoice.selectedMethod === "va" && (
        <Card
          cornerLines={false}
          className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-4 sm:p-5 space-y-4 max-w-sm sm:max-w-md mx-auto"
        >
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>Virtual Account Bank</span>
            </span>
            <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5 border-primary/40 text-primary bg-primary/10 font-bold">
              {invoice.vaBank || "Virtual Account"}
            </Badge>
          </div>

          <div className="p-4 bg-background/80 border border-border/80 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                {t("treasury.invoices.checkout.vaNumber", "VA Number")}
              </span>
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-foreground tracking-wider block mt-0.5">
                {invoice.vaNumber || "---"}
              </span>
            </div>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="dual"
              onClick={handleCopyVa}
              className="text-xs flex items-center justify-center gap-1.5 font-mono px-3 h-8 cursor-pointer shrink-0"
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

          <p className="text-[11px] text-muted-foreground text-center font-mono leading-relaxed">
            {t(
              "treasury.invoices.checkout.transferVaPrompt",
              "Transfer exact amount to the Virtual Account number above."
            )}
          </p>

          <Button
            type="button"
            variant="cyber"
            chamfer="dual"
            size="default"
            disabled={isConfirmingClaim}
            onClick={onConfirmClaim}
            className="w-full font-mono font-bold text-xs h-11 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              {isConfirmingClaim
                ? t("treasury.invoices.checkout.checkingStatus", "Checking Status...")
                : t("treasury.invoices.checkout.checkPaymentStatus", "Check Payment Status")}
            </span>
          </Button>
        </Card>
      )}

      {/* 4. E-Wallet Mode */}
      {invoice.selectedMethod === "ewallet" && (
        <Card
          cornerLines={false}
          className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-5 text-center space-y-4 max-w-sm sm:max-w-md mx-auto"
        >
          <div className="space-y-1">
            <span className="text-xs font-bold font-mono text-foreground tracking-wide block">
              E-Wallet ({invoice.selectedBankCode || "E-Wallet"})
            </span>
            <p className="text-xs text-muted-foreground font-mono max-w-xs mx-auto">
              {t("treasury.invoices.checkout.ewalletPrompt", "Complete payment in your e-wallet app:")}
            </p>
          </div>

          {invoice.checkoutUrl ? (
            <Button
              asChild
              variant="cyber"
              size="default"
              chamfer="dual"
              className="w-full text-xs sm:text-sm font-mono font-bold h-11 cursor-pointer"
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
            <div className="p-3 bg-muted/20 border border-border/60 text-xs font-mono text-muted-foreground rounded">
              E-wallet checkout link is being prepared.
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            chamfer="dual"
            size="default"
            disabled={isConfirmingClaim}
            onClick={onConfirmClaim}
            className="w-full font-mono text-xs h-10 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{t("treasury.invoices.checkout.checkPaymentStatus", "Check Payment Status")}</span>
          </Button>
        </Card>
      )}

      {/* Sandbox Test Mode Simulation */}
      {invoice.isTestMode && (
        <div className="max-w-sm sm:max-w-md mx-auto p-3 bg-violet-500/10 border border-violet-500/30 rounded-md flex items-center justify-between gap-2 font-sans">
          <span className="text-xs text-violet-300 font-medium">Sandbox Mode</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            chamfer="dual"
            disabled={isSimulating}
            onClick={onSimulatePayment}
            className="text-xs font-sans border-violet-500/40 text-violet-200 hover:bg-violet-500/20 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 mr-1 text-violet-400" />
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
          className="text-xs font-sans text-primary hover:underline cursor-pointer"
        >
          {i18n.language === "id" ? "← Rincian Tagihan" : "← Invoice Breakdown"}
        </button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          chamfer="dual"
          disabled={isCancelling}
          onClick={onCancelInvoice}
          className="h-7 text-xs font-sans text-destructive hover:bg-destructive/10 border-destructive/30 px-2 cursor-pointer"
        >
          {isCancelling
            ? t("treasury.invoices.checkout.cancelling", "Cancelling...")
            : t("treasury.invoices.checkout.cancelInvoice", "Cancel Invoice")}
        </Button>
      </div>
    </div>
  );
}
