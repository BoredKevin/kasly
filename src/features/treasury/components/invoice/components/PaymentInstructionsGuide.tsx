import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Panel } from "../../../../../ui";
import {
  Smartphone,
  ScanLine,
  Image as ImageIcon,
  CheckCircle2,
  CreditCard,
  Camera,
} from "lucide-react";

export function PaymentInstructionsGuide() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"same" | "other">("same");

  return (
    <Panel className="p-4 sm:p-5 bg-card border border-border/80 rounded-[var(--fintech-radius-md)] shadow-sm space-y-4 max-w-sm sm:max-w-md mx-auto font-sans">
      {/* Header & Section Title */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <h4 className="font-sans text-sm font-semibold text-foreground">
          {t("treasury.invoices.checkout.howToPay", "How to Pay:")}
        </h4>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-sm)] gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("same")}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-sans font-medium rounded-[var(--fintech-radius-sm)] transition-colors cursor-pointer ${
            activeTab === "same"
              ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Smartphone className={`w-3.5 h-3.5 ${activeTab === "same" ? "text-primary" : "text-muted-foreground"}`} />
          <span className="truncate">{t("treasury.invoices.checkout.samePhoneTab", "Pay with same phone")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("other")}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-sans font-medium rounded-[var(--fintech-radius-sm)] transition-colors cursor-pointer ${
            activeTab === "other"
              ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Camera className={`w-3.5 h-3.5 ${activeTab === "other" ? "text-primary" : "text-muted-foreground"}`} />
          <span className="truncate">{t("treasury.invoices.checkout.otherPhoneTab", "Pay with other phone")}</span>
        </button>
      </div>

      {/* Step by Step List */}
      <div className="space-y-3.5 pt-1 font-sans">
        {activeTab === "same" ? (
          <>
            {/* Step 1: Download / Screenshot */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  1. {t("treasury.invoices.checkout.samePhoneStep1Title", "Download or Screenshot QRIS")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.samePhoneStep1Desc", "Click the 'Download QR' button below or take a screenshot.")}
                </p>
              </div>
            </div>

            {/* Step 2: Open App */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Smartphone className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  2. {t("treasury.invoices.checkout.samePhoneStep2Title", "Open m-Banking or E-Wallet")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.samePhoneStep2Desc", "Open BCA Mobile, Livin' by Mandiri, GoPay, OVO, Dana, ShopeePay, etc.")}
                </p>
              </div>
            </div>

            {/* Step 3: Scan from Gallery */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <ScanLine className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  3. {t("treasury.invoices.checkout.samePhoneStep3Title", "Scan from Gallery")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.samePhoneStep3Desc", "Select QRIS menu, tap the Gallery photo icon and choose the QR code image.")}
                </p>
              </div>
            </div>

            {/* Step 4: Verify & Pay */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  4. {t("treasury.invoices.checkout.samePhoneStep4Title", "Verify Details & Pay")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.samePhoneStep4Desc", "Verify recipient and amount, then enter your PIN to confirm payment.")}
                </p>
              </div>
            </div>

            {/* Step 5: Check Status */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  5. {t("treasury.invoices.checkout.samePhoneStep5Title", "Click Check Payment Status")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.samePhoneStep5Desc", "Return here and tap 'Check Payment Status' button.")}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Mode 2: Other Phone - Step 1 */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <ScanLine className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  1. {t("treasury.invoices.checkout.otherPhoneStep1Title", "Open QR Payment")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.otherPhoneStep1Desc", "Open QR payment scanner in your favorite m-banking or e-wallet app.")}
                </p>
              </div>
            </div>

            {/* Step 2: Scan */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Camera className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  2. {t("treasury.invoices.checkout.otherPhoneStep2Title", "Scan QR Code")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.otherPhoneStep2Desc", "Point your phone camera directly at the QR code displayed above.")}
                </p>
              </div>
            </div>

            {/* Step 3: Check & Pay */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  3. {t("treasury.invoices.checkout.otherPhoneStep3Title", "Check Details & Pay")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.otherPhoneStep3Desc", "Verify transaction details and complete payment in your app.")}
                </p>
              </div>
            </div>

            {/* Step 4: Check Status */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 text-xs font-sans">
                <p className="font-semibold text-foreground text-xs sm:text-[13px]">
                  4. {t("treasury.invoices.checkout.otherPhoneStep4Title", "Click Check Payment Status")}
                </p>
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                  {t("treasury.invoices.checkout.otherPhoneStep4Desc", "Click 'Check Payment Status' after your payment succeeds.")}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
