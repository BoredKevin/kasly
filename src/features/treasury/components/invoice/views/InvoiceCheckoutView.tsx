import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Card, Button } from "@boredkevin/ui";
import {
  ArrowLeft,
  QrCode,
  Building,
  Wallet,
  Check,
  ChevronDown,
  ChevronUp,
  Receipt,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";

export interface InvoiceCheckoutViewProps {
  invoice: any;
  publicMethods: any;
  selectedMethod: "qris" | "va" | "ewallet";
  setSelectedMethod: (method: "qris" | "va" | "ewallet") => void;
  selectedBank: string;
  setSelectedBank: (bank: string) => void;
  selectedWallet: string;
  setSelectedWallet: (wallet: string) => void;
  previewFee: number;
  previewTotal: number;
  isInitiating: boolean;
  errorMessage: string | null;
  onInitiatePayment: () => void;
}

export function InvoiceCheckoutView({
  invoice,
  publicMethods,
  selectedMethod,
  setSelectedMethod,
  selectedBank,
  setSelectedBank,
  selectedWallet,
  setSelectedWallet,
  previewFee,
  previewTotal,
  isInitiating,
  errorMessage,
  onInitiatePayment,
}: InvoiceCheckoutViewProps) {
  const { t } = useTranslation();

  const [validationError, setValidationError] = useState<string | null>(null);

  // Floating summary expandable bottom sheet
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const isQrisAvailable = Boolean(publicMethods?.qris?.enabled !== false);
  const isVaAvailable = Boolean(
    publicMethods?.va?.enabled &&
    publicMethods.va.banks &&
    publicMethods.va.banks.length > 0
  );
  const isEwalletAvailable = Boolean(
    publicMethods?.ewallet?.enabled &&
    publicMethods.ewallet.wallets &&
    publicMethods.ewallet.wallets.length > 0
  );

  const availableMethodsCount =
    (isQrisAvailable ? 1 : 0) +
    (isVaAvailable ? 1 : 0) +
    (isEwalletAvailable ? 1 : 0);

  const handlePayClick = () => {
    setValidationError(null);
    onInitiatePayment();
  };

  return (
    <div className="space-y-4 pb-36 sm:pb-44 animate-in fade-in duration-200">
      {/* Top Bar: Back Link & Telemetry */}
      <div className="flex items-center justify-between gap-2 pb-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          chamfer="dual"
          className="h-8 text-xs font-mono px-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Link href="/treasury/invoices">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Invoices</span>
          </Link>
        </Button>

        <div className="text-right">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
            {invoice.organizationName}
          </span>
          <span className="font-mono text-xs font-semibold text-foreground">
            {invoice.fundName}
          </span>
        </div>
      </div>

      {/* Errors */}
      {(errorMessage || validationError) && (
        <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2 rounded">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage || validationError}</span>
        </div>
      )}

      {/* Order Origin & Bill Items Card */}
      <Card
        cornerLines={false}
        className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex items-center justify-between pb-1 border-b border-border/40">
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.invoices.checkout.orderedFrom", "You are paying")}</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            #{invoice.invoiceNumber}
          </span>
        </div>

        <div className="p-3 bg-background/60 border border-border/60 rounded-md space-y-1 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">
              {invoice.organizationName}
            </span>
            {invoice.payerName && (
              <span className="text-xs font-semibold text-foreground">
                {invoice.payerName}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center justify-between">
            <span>
              {invoice.fundName}
            </span>
            {invoice.payerEmail && (
              <span className="opacity-80 text-[10px]">{invoice.payerEmail}</span>
            )}
          </div>
        </div>

        {/* Itemized Line Items */}
        <div className="space-y-2 pt-1 font-mono text-xs">
          {invoice.periodLabels && invoice.periodLabels.length > 0 ? (
            invoice.periodLabels.map((label: string, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0 gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 bg-primary/10 border border-primary/20 text-primary shrink-0 rounded">
                    <CalendarDays className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-foreground break-words leading-tight">
                    {t("treasury.invoices.checkout.duesPeriod", { label })}
                  </span>
                </div>
                <span className="font-bold text-foreground shrink-0">
                  {invoice.currency}{" "}
                  {(invoice.subtotal / invoice.periodLabels!.length).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between py-1.5 border-b border-border/30 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 bg-primary/10 border border-primary/20 text-primary shrink-0 rounded">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <span className="text-foreground break-words leading-tight">{invoice.title}</span>
              </div>
              <span className="font-bold text-foreground shrink-0">
                {invoice.currency} {invoice.subtotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* 3. Payment Method Selector */}
      <Card
        cornerLines={false}
        className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-4 sm:p-5 space-y-4"
      >
        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider block">
          {t("treasury.invoices.checkout.selectMethod", "Choose Payment Method")}
        </span>

        {availableMethodsCount > 0 ? (
          <div className="space-y-2.5">
            {/* Option A: QRIS (Primary Recommendation) */}
            {isQrisAvailable && (
              <div
                onClick={() => setSelectedMethod("qris")}
                className={`p-3.5 border rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedMethod === "qris"
                  ? "bg-primary/15 border-primary shadow-sm ring-1 ring-primary/40"
                  : "bg-background/60 border-border/60 hover:border-border hover:bg-muted/20"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center ${selectedMethod === "qris"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground">QRIS</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-emerald-500/30 rounded font-mono">
                        Tunggu Konfirmasi
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      BCA, GoPay, OVO, Dana, ShopeePay, m-Banking
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === "qris"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/60"
                    }`}
                >
                  {selectedMethod === "qris" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            )}

            {/* Option B: Virtual Account */}
            {isVaAvailable && (
              <div
                onClick={() => setSelectedMethod("va")}
                className={`p-3.5 border rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedMethod === "va"
                  ? "bg-primary/15 border-primary shadow-sm ring-1 ring-primary/40"
                  : "bg-background/60 border-border/60 hover:border-border hover:bg-muted/20"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center ${selectedMethod === "va"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-foreground block">
                      Virtual Account <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                        Instant
                      </span>
                    </span>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Transfer via ATM, Mobile, atau Internet Banking
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === "va"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/60"
                    }`}
                >
                  {selectedMethod === "va" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            )}

            {/* Sub-selector for VA Banks if selected */}
            {selectedMethod === "va" && isVaAvailable && publicMethods?.va?.banks && (
              <div className="p-3 bg-muted/20 border border-border/60 rounded-md space-y-2 mt-2 ml-4">
                <span className="text-[11px] font-mono text-muted-foreground block">
                  {t("treasury.invoices.checkout.selectBank", "Select Bank")}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {publicMethods.va.banks.map((b: any) => (
                    <button
                      type="button"
                      key={b.code}
                      onClick={() => setSelectedBank(b.code)}
                      className={`p-2 border text-left rounded text-xs font-mono cursor-pointer transition-all ${selectedBank.toUpperCase() === b.code.toUpperCase()
                        ? "bg-primary/20 border-primary text-foreground font-bold"
                        : "bg-background/80 border-border/60 text-muted-foreground hover:border-border"
                        }`}
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Option C: E-Wallet */}
            {isEwalletAvailable && (
              <div
                onClick={() => setSelectedMethod("ewallet")}
                className={`p-3.5 border rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedMethod === "ewallet"
                  ? "bg-primary/15 border-primary shadow-sm ring-1 ring-primary/40"
                  : "bg-background/60 border-border/60 hover:border-border hover:bg-muted/20"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-md flex items-center justify-center ${selectedMethod === "ewallet"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-foreground block">
                      E-Wallet <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                        Instant
                      </span>
                    </span>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      ShopeePay, Dana, OVO, LinkAja
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedMethod === "ewallet"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/60"
                    }`}
                >
                  {selectedMethod === "ewallet" && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </div>
            )}

            {/* Sub-selector for E-Wallet if selected */}
            {selectedMethod === "ewallet" && isEwalletAvailable && publicMethods?.ewallet?.wallets && (
              <div className="p-3 bg-muted/20 border border-border/60 rounded-md space-y-2 mt-2 ml-4">
                <span className="text-[11px] font-mono text-muted-foreground block">
                  {t("treasury.invoices.checkout.selectWallet", "Select E-Wallet")}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {publicMethods.ewallet.wallets.map((w: any) => (
                    <button
                      type="button"
                      key={w.code}
                      onClick={() => setSelectedWallet(w.code)}
                      className={`p-2 border text-left rounded text-xs font-mono cursor-pointer transition-all ${selectedWallet.toUpperCase() === w.code.toUpperCase()
                        ? "bg-primary/20 border-primary text-foreground font-bold"
                        : "bg-background/80 border-border/60 text-muted-foreground hover:border-border"
                        }`}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-muted/20 border border-border/60 text-center space-y-1 font-mono text-xs text-muted-foreground rounded">
            No payment methods available.
          </div>
        )}
      </Card>

      {/* 4. Floating Mobile Bottom Sheet / Sticky Footer (ESB Inspired) */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:px-6 sm:py-4.5 bg-background/90 dark:bg-[#0a0a0d]/92 backdrop-blur-2xl border-t border-border/80 shadow-[0_-10px_35px_rgba(0,0,0,0.7)]"
            style={{
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="max-w-lg mx-auto space-y-3">
              {/* Collapsible details breakdown */}
              {isBreakdownOpen && (
                <div
                  className="p-3.5 sm:p-4 bg-background/95 border border-border/80 rounded-lg font-mono text-xs space-y-2 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-150"
                  style={{
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                  }}
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("treasury.invoices.checkout.subtotal", "Subtotal")}</span>
                    <span className="font-semibold">{invoice.currency} {invoice.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("treasury.invoices.checkout.adminFee", "Gateway Fee")}</span>
                    <span className="font-semibold">
                      {previewFee === 0
                        ? `Rp 0 (${t("treasury.invoices.checkout.freeFee", "Free")})`
                        : `${invoice.currency} ${previewFee.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/50 flex justify-between font-bold text-foreground text-sm">
                    <span>{t("treasury.invoices.checkout.totalPay", "Total Payment")}</span>
                    <span className="text-primary">{invoice.currency} {previewTotal.toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Action Row */}
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
                  className="text-left cursor-pointer group font-mono py-1 px-1 focus:outline-none"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="font-sans font-medium">{t("treasury.invoices.checkout.totalPay", "Payment Total")}</span>
                    {isBreakdownOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                    )}
                  </div>
                  <div className="text-base sm:text-xl font-extrabold text-foreground font-mono tracking-tight mt-0.5">
                    {invoice.currency} {previewTotal.toLocaleString()}
                  </div>
                </button>

                <div className="p-1 sm:p-1.5">
                  <Button
                    type="button"
                    variant="cyber"
                    chamfer="dual"
                    size="default"
                    disabled={isInitiating || availableMethodsCount === 0}
                    onClick={handlePayClick}
                    className="font-sans font-bold text-xs sm:text-sm px-7 sm:px-9 h-12 shrink-0 cursor-pointer shadow-xl tracking-wide flex items-center justify-center gap-2"
                  >
                    <span>
                      {isInitiating
                        ? t("treasury.invoices.checkout.generating", "Connecting...")
                        : t("treasury.invoices.checkout.continueToPayment", "Continue Payment")}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
