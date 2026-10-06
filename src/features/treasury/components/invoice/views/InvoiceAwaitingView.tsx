import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@boredkevin/ui";
import { Panel, StatusPill } from "../../../../../ui";
import { Clock, ExternalLink, Zap, ArrowLeft } from "lucide-react";

export interface InvoiceAwaitingViewProps {
  invoice: any;
  onBackToCheckout: () => void;
  onSimulatePayment: () => void;
  isSimulating: boolean;
}

export function InvoiceAwaitingView({
  invoice,
  onBackToCheckout,
  onSimulatePayment,
  isSimulating,
}: InvoiceAwaitingViewProps) {
  const { t, i18n } = useTranslation();
  const [showQrAgain, setShowQrAgain] = useState(false);

  const qrImageUrl = invoice.qrString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(invoice.qrString)}`
    : null;

  const isTemanQris = Boolean(
    invoice?.gatewayProvider === "temanqris" || invoice?.payUrl?.includes("temanqris")
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-1 max-w-sm sm:max-w-md mx-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          chamfer="none"
          onClick={onBackToCheckout}
          className="h-8 text-xs font-sans font-medium px-2 text-muted-foreground hover:text-foreground cursor-pointer rounded-[var(--fintech-radius-sm)]"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          <span>{i18n.language === "id" ? "Rincian Tagihan" : "Invoice Details"}</span>
        </Button>
      </div>

      <Panel className="bg-card border border-amber-500/30 shadow-sm text-center p-6 sm:p-8 space-y-4 max-w-sm sm:max-w-md mx-auto rounded-[var(--fintech-radius-md)]">
        <div className="inline-flex p-3 bg-amber-500/15 text-amber-400 rounded-full border border-amber-500/30">
          <Clock className="w-8 h-8" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-amber-400 font-sans tracking-tight">
            {t("treasury.invoices.checkout.awaitingConfirmationTitle", "AWAITING CONFIRMATION")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto font-sans leading-relaxed">
            {t(
              "treasury.invoices.checkout.awaitingConfirmationDesc",
              "Your payment confirmation has been received. The verification process typically takes between 10 minutes to 24 hours."
            )}
          </p>
        </div>

        <div className="p-3.5 bg-muted/20 border border-border/60 text-xs font-sans space-y-1.5 rounded-[var(--fintech-radius-sm)] text-left">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("treasury.invoices.checkout.totalPay", "Total Payment")}</span>
            <span className="font-bold text-foreground">
              {invoice.currency} {invoice.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("treasury.invoices.checkout.awaitingConfirmationAt", "Confirmation Time")}</span>
            <span>
              {new Date(invoice.awaitingConfirmationAt || invoice.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Status</span>
            <StatusPill tone="warning">
              {t("treasury.invoices.checkout.awaitingConfirmationStatus", "Waiting Confirmation")}
            </StatusPill>
          </div>
        </div>

        <div className="space-y-2 pt-1 font-sans">
          {invoice.payUrl && !isTemanQris && (
            <Button
              asChild
              variant="outline"
              size="sm"
              chamfer="none"
              className="w-full text-xs font-sans text-muted-foreground hover:text-foreground border-border/80 rounded-[var(--fintech-radius-sm)]"
            >
              <a href={invoice.payUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                <span>
                  {i18n.language === "id" ? "Buka Halaman Gateway" : "Open Gateway Page"}
                </span>
              </a>
            </Button>
          )}

          {invoice.isTestMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              disabled={isSimulating}
              onClick={onSimulatePayment}
              className="w-full text-xs font-sans text-amber-500 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer rounded-[var(--fintech-radius-sm)]"
            >
              <Zap className="w-3.5 h-3.5 mr-1" />
              <span>
                {isSimulating
                  ? t("treasury.invoices.checkout.simulating", "Simulating...")
                  : t("treasury.invoices.checkout.simulateBtn", "Simulate Payment")}
              </span>
            </Button>
          )}

          {invoice.selectedMethod === "qris" && qrImageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              chamfer="none"
              onClick={() => setShowQrAgain(!showQrAgain)}
              className="w-full text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer rounded-[var(--fintech-radius-sm)]"
            >
              <span>
                {showQrAgain
                  ? t("treasury.invoices.checkout.hideQrAgain", "Hide QR Code")
                  : t("treasury.invoices.checkout.showQrAgain", "View QR Code Again")}
              </span>
            </Button>
          )}
        </div>

        {showQrAgain && invoice.selectedMethod === "qris" && qrImageUrl && (
          <div className="pt-3 border-t border-border/40 text-center animate-in fade-in duration-200">
            <div className="inline-block p-3 bg-white rounded-xl border border-border/80 shadow-sm">
              <img
                src={qrImageUrl}
                alt="QRIS Code"
                className="w-44 h-44 mx-auto object-contain"
              />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
