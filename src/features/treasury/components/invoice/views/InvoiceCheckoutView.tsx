import { useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button, Badge } from "@boredkevin/ui";
import { Panel } from "../../../../../ui";
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
  ShieldCheck,
  User,
  Copy,
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

const BANK_BRAND_THEMES: Record<
  string,
  { bg: string; text: string; border: string; fullName: string }
> = {
  BCA: {
    bg: "bg-blue-600/15",
    text: "text-blue-400",
    border: "border-blue-500/40",
    fullName: "Bank Central Asia",
  },
  BNI: {
    bg: "bg-teal-600/15",
    text: "text-teal-400",
    border: "border-teal-500/40",
    fullName: "Bank Negara Indonesia",
  },
  BRI: {
    bg: "bg-sky-600/15",
    text: "text-sky-400",
    border: "border-sky-500/40",
    fullName: "Bank Rakyat Indonesia",
  },
  MANDIRI: {
    bg: "bg-amber-600/15",
    text: "text-amber-400",
    border: "border-amber-500/40",
    fullName: "Bank Mandiri",
  },
  PERMATA: {
    bg: "bg-emerald-600/15",
    text: "text-emerald-400",
    border: "border-emerald-500/40",
    fullName: "Bank Permata",
  },
  CIMB: {
    bg: "bg-rose-600/15",
    text: "text-rose-400",
    border: "border-rose-500/40",
    fullName: "CIMB Niaga",
  },
  SAHABAT_SAMPOERNA: {
    bg: "bg-purple-600/15",
    text: "text-purple-400",
    border: "border-purple-500/40",
    fullName: "Bank Sahabat Sampoerna",
  },
};

const WALLET_BRAND_THEMES: Record<
  string,
  { bg: string; text: string; border: string; fullName: string }
> = {
  DANA: {
    bg: "bg-sky-500/15",
    text: "text-sky-400",
    border: "border-sky-500/40",
    fullName: "DANA Digital Wallet",
  },
  OVO: {
    bg: "bg-purple-600/15",
    text: "text-purple-400",
    border: "border-purple-500/40",
    fullName: "OVO Payment",
  },
  SHOPEEPAY: {
    bg: "bg-orange-500/15",
    text: "text-orange-400",
    border: "border-orange-500/40",
    fullName: "ShopeePay",
  },
  LINKAJA: {
    bg: "bg-red-600/15",
    text: "text-red-400",
    border: "border-red-500/40",
    fullName: "LinkAja",
  },
};

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
  const [isCopiedInvoice, setIsCopiedInvoice] = useState(false);

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

  const handleCopyInvoiceNumber = () => {
    void navigator.clipboard.writeText(invoice.invoiceNumber);
    setIsCopiedInvoice(true);
    setTimeout(() => setIsCopiedInvoice(false), 2000);
  };

  const handlePayClick = () => {
    setValidationError(null);
    onInitiatePayment();
  };

  return (
    <div className="space-y-4 pb-36 sm:pb-44 animate-in fade-in duration-200">
      {/* Top Bar: Back Link & Verified SSL Security Badge */}
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
            <span>{t("treasury.invoices.checkout.backToInvoices", "Daftar Faktur")}</span>
          </Link>
        </Button>

        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Checkout Aman SSL 256-Bit</span>
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
      <Panel className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-4 sm:p-5 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-primary" />
            <span>{t("treasury.invoices.checkout.orderedFrom", "Rincian Tagihan")}</span>
          </span>

          {/* Interactive Invoice Number Pill */}
          <button
            type="button"
            onClick={handleCopyInvoiceNumber}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 px-2 py-0.5 rounded border border-border/60 transition-colors cursor-pointer"
            title="Salin nomor faktur"
          >
            <span>#{invoice.invoiceNumber}</span>
            {isCopiedInvoice ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 opacity-60" />
            )}
          </button>
        </div>

        {/* Structured 2-Column Issuer & Billed To Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
          {/* Box A: Penerbit / Organisasi */}
          <div className="p-3 bg-background/60 border border-border/60 rounded-md space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <Building className="w-3 h-3 text-primary" />
                <span>{t("treasury.invoices.checkout.issuer", "Penerbit Organisasi")}</span>
              </span>
              <Badge
                variant="outline"
                className="text-[9px] py-0 px-1 bg-primary/10 text-primary border-primary/30"
              >
                Terverifikasi
              </Badge>
            </div>
            <div className="text-xs font-bold text-foreground truncate" title={invoice.organizationName}>
              {invoice.organizationName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="opacity-70">Pos Kas:</span>
              <span className="font-semibold text-foreground/90 truncate">{invoice.fundName}</span>
            </div>
          </div>

          {/* Box B: Ditagihkan Kepada */}
          <div className="p-3 bg-background/60 border border-border/60 rounded-md space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                <User className="w-3 h-3 text-primary" />
                <span>{t("treasury.invoices.checkout.billedTo", "Ditagihkan Kepada")}</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-sans">
                Anggota
              </span>
            </div>
            <div className="text-xs font-bold text-foreground truncate" title={invoice.payerName}>
              {invoice.payerName || "Pelanggan / Anggota"}
            </div>
            <div className="text-[11px] text-muted-foreground truncate" title={invoice.payerEmail || ""}>
              {invoice.payerEmail || "Tanpa email"}
            </div>
          </div>
        </div>

        {/* Itemized Line Items */}
        <div className="space-y-2 pt-2 border-t border-border/40 font-mono text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
            Item Tagihan
          </span>

          {invoice.periodLabels && invoice.periodLabels.length > 0 ? (
            invoice.periodLabels.map((label: string, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0 gap-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 bg-primary/10 border border-primary/20 text-primary shrink-0 rounded">
                    <CalendarDays className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-foreground break-words leading-tight">
                    {t("treasury.invoices.checkout.duesPeriod", { label })}
                  </span>
                </div>
                <span className="font-bold text-foreground shrink-0 tabular-nums">
                  {invoice.currency}{" "}
                  {(invoice.subtotal / invoice.periodLabels!.length).toLocaleString()}
                </span>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between py-2 border-b border-border/30 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1 bg-primary/10 border border-primary/20 text-primary shrink-0 rounded">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <span className="text-foreground break-words leading-tight">{invoice.title}</span>
              </div>
              <span className="font-bold text-foreground shrink-0 tabular-nums">
                {invoice.currency} {invoice.subtotal.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </Panel>

      {/* Payment Method Selector */}
      <Panel className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md p-4 sm:p-5 space-y-4">
        <span className="text-xs font-mono font-bold text-foreground uppercase tracking-wider block">
          {t("treasury.invoices.checkout.selectMethod", "Pilih Metode Pembayaran")}
        </span>

        {availableMethodsCount > 0 ? (
          <div className="space-y-3">
            {/* Option A: QRIS (Primary Instant Recommendation) */}
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
                    className={`w-10 h-10 rounded-md flex items-center justify-center ${selectedMethod === "qris"
                      ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                      : "bg-muted text-muted-foreground"
                      }`}
                  >
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-foreground">
                        QRIS
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded font-mono">
                        Tunggu Konfirmasi
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      Semua Pembayaran
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedMethod === "qris"
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
              <div className="space-y-2">
                <div
                  onClick={() => setSelectedMethod("va")}
                  className={`p-3.5 border rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedMethod === "va"
                    ? "bg-primary/15 border-primary shadow-sm ring-1 ring-primary/40"
                    : "bg-background/60 border-border/60 hover:border-border hover:bg-muted/20"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center ${selectedMethod === "va"
                        ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                        : "bg-muted text-muted-foreground"
                        }`}
                    >
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-foreground">
                          Virtual Account Bank
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                          Instan
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        Transfer via bank
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedMethod === "va"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/60"
                      }`}
                  >
                    {selectedMethod === "va" && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* Tactical Bank Tiles Grid if VA selected */}
                {selectedMethod === "va" && publicMethods?.va?.banks && (
                  <div className="p-3 bg-muted/20 border border-border/60 rounded-md space-y-2.5 animate-in slide-in-from-top-1 duration-150">
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold block uppercase tracking-wider">
                      {t("treasury.invoices.checkout.selectBank", "Pilih Bank Tujuan")}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {publicMethods.va.banks.map((b: any) => {
                        const bankKey = b.code.toUpperCase();
                        const theme = BANK_BRAND_THEMES[bankKey];
                        const isSelected = selectedBank.toUpperCase() === bankKey;

                        return (
                          <button
                            type="button"
                            key={b.code}
                            onClick={() => setSelectedBank(b.code)}
                            className={`p-2.5 border rounded-lg text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${isSelected
                              ? "bg-primary/20 border-primary shadow-sm ring-1 ring-primary/40 text-foreground"
                              : "bg-background/80 border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-10 h-7 rounded font-mono font-black text-[10px] flex items-center justify-center border shrink-0 ${theme?.bg || "bg-muted/40"
                                  } ${theme?.text || "text-foreground"} ${theme?.border || "border-border/60"
                                  }`}
                              >
                                {b.code.toUpperCase().slice(0, 4)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-bold text-foreground block truncate">
                                  {b.name}
                                </span>
                                <span className="text-[10px] font-sans text-muted-foreground block truncate">
                                  {theme?.fullName || "Virtual Account"}
                                </span>
                              </div>
                            </div>

                            <div
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40"
                                }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Option C: E-Wallet */}
            {isEwalletAvailable && (
              <div className="space-y-2">
                <div
                  onClick={() => setSelectedMethod("ewallet")}
                  className={`p-3.5 border rounded-lg transition-all cursor-pointer flex items-center justify-between gap-3 ${selectedMethod === "ewallet"
                    ? "bg-primary/15 border-primary shadow-sm ring-1 ring-primary/40"
                    : "bg-background/60 border-border/60 hover:border-border hover:bg-muted/20"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-md flex items-center justify-center ${selectedMethod === "ewallet"
                        ? "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/20"
                        : "bg-muted text-muted-foreground"
                        }`}
                    >
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-foreground">
                          Dompet Digital (E-Wallet)
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono">
                          Instan
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        DANA, OVO, ShopeePay
                      </p>
                    </div>
                  </div>

                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${selectedMethod === "ewallet"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/60"
                      }`}
                  >
                    {selectedMethod === "ewallet" && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                {/* Sub-selector for E-Wallet if selected */}
                {selectedMethod === "ewallet" && publicMethods?.ewallet?.wallets && (
                  <div className="p-3 bg-muted/20 border border-border/60 rounded-md space-y-2.5 animate-in slide-in-from-top-1 duration-150">
                    <span className="text-[11px] font-mono text-muted-foreground font-semibold block uppercase tracking-wider">
                      {t("treasury.invoices.checkout.selectWallet", "Pilih Aplikasi E-Wallet")}
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {publicMethods.ewallet.wallets.map((w: any) => {
                        const walletKey = w.code.toUpperCase();
                        const theme = WALLET_BRAND_THEMES[walletKey];
                        const isSelected = selectedWallet.toUpperCase() === walletKey;

                        return (
                          <button
                            type="button"
                            key={w.code}
                            onClick={() => setSelectedWallet(w.code)}
                            className={`p-2.5 border rounded-lg text-left transition-all cursor-pointer flex items-center justify-between gap-2.5 ${isSelected
                              ? "bg-primary/20 border-primary shadow-sm ring-1 ring-primary/40 text-foreground"
                              : "bg-background/80 border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground"
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-10 h-7 rounded font-mono font-black text-[10px] flex items-center justify-center border shrink-0 ${theme?.bg || "bg-muted/40"
                                  } ${theme?.text || "text-foreground"} ${theme?.border || "border-border/60"
                                  }`}
                              >
                                {w.code.toUpperCase().slice(0, 4)}
                              </div>
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-bold text-foreground block truncate">
                                  {w.name}
                                </span>
                                <span className="text-[10px] font-sans text-muted-foreground block truncate">
                                  {theme?.fullName || "E-Wallet"}
                                </span>
                              </div>
                            </div>

                            <div
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground/40"
                                }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-muted/20 border border-border/60 text-center space-y-1 font-mono text-xs text-muted-foreground rounded">
            Tidak ada metode pembayaran yang tersedia saat ini.
          </div>
        )}
      </Panel>

      {/* Floating Sticky Bottom Sheet & Action Bar */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] px-4 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-background/95 dark:bg-[#0a0a0d]/95 backdrop-blur-2xl border-t border-border shadow-[0_-10px_35px_rgba(0,0,0,0.85)]"
            style={{
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            <div className="max-w-lg mx-auto w-full space-y-2.5">
              {/* Collapsible Fee Breakdown */}
              {isBreakdownOpen && (
                <div
                  className="p-3.5 sm:p-4 bg-background/95 border border-border/80 rounded-lg font-mono text-xs space-y-2 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-150"
                  style={{
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                  }}
                >
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("treasury.invoices.checkout.subtotal", "Subtotal Tagihan")}</span>
                    <span className="font-semibold tabular-nums">
                      {invoice.currency} {invoice.subtotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("treasury.invoices.checkout.adminFee", "Biaya Transaksi (Gateway)")}</span>
                    <span className="font-semibold tabular-nums">
                      {previewFee === 0
                        ? `Rp 0 (${t("treasury.invoices.checkout.freeFee", "Gratis")})`
                        : `${invoice.currency} ${previewFee.toLocaleString()}`}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/50 flex justify-between font-bold text-foreground text-sm">
                    <span>{t("treasury.invoices.checkout.totalPay", "Total Pembayaran")}</span>
                    <span className="text-primary tabular-nums">
                      {invoice.currency} {previewTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Row */}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
                  className="text-left cursor-pointer group font-mono py-1 px-1 focus:outline-none min-w-0"
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    <span className="font-sans font-medium">
                      {t("treasury.invoices.checkout.totalPay", "Total Pembayaran")}
                    </span>
                    {isBreakdownOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                    )}
                  </div>
                  <div className="text-base sm:text-xl font-extrabold text-foreground font-mono tracking-tight mt-0.5 truncate">
                    {invoice.currency} {previewTotal.toLocaleString()}
                  </div>
                </button>

                <div className="shrink-0">
                  <Button
                    type="button"
                    variant="cyber"
                    chamfer="dual"
                    size="default"
                    disabled={isInitiating || availableMethodsCount === 0}
                    onClick={handlePayClick}
                    className="font-sans font-bold text-xs sm:text-sm px-6 sm:px-8 h-12 cursor-pointer shadow-xl tracking-wide flex items-center justify-center gap-2"
                  >
                    <span>
                      {isInitiating
                        ? t("treasury.invoices.checkout.generating", "Memproses...")
                        : t("treasury.invoices.checkout.continueToPayment", "Lanjut Pembayaran")}
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
