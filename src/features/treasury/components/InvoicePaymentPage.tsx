import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  ConstellationsBackground,
} from "@boredkevin/ui";
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  QrCode,
  Building,
  Wallet,
  Download,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  XCircle,
  Zap,
  ChevronDown,
  ChevronUp,
  Receipt,
  CalendarDays,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoicePaymentPageProps {
  invoiceNumber: string;
  initialView?: "checkout" | "payment";
}

export function InvoicePaymentPage({
  invoiceNumber,
  initialView,
}: InvoicePaymentPageProps) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const isPayRoute = location.endsWith("/pay");

  const invoice = useQuery(api.treasury.borderpay.getInvoice, { invoiceNumber });
  const publicMethods = useQuery(
    api.treasury.borderpay.getPublicPaymentMethods,
    invoice ? { organizationId: invoice.organizationId } : "skip"
  );

  const initiatePayment = useAction(api.treasury.borderpay.initiatePayment);
  const simulatePayment = useAction(api.treasury.borderpay.simulatePayment);
  const cancelInvoice = useMutation(api.treasury.borderpay.cancelInvoice);
  const syncCheckoutMethods = useAction(api.treasury.borderpay.syncCheckoutPaymentMethods);

  // When a customer visits checkout for an unpaid invoice, ensure live fees & methods are fetched
  useEffect(() => {
    if (invoice && invoice.status === "draft") {
      void syncCheckoutMethods({ invoiceNumber });
    }
  }, [invoice?.invoiceNumber, invoice?.status, syncCheckoutMethods]);

  // View state: "checkout" (Stripe-like order breakdown + method selection) vs "payment" (pure payment details & QR/VA)
  const [activeView, setActiveView] = useState<"checkout" | "payment">(() => {
    if (initialView) return initialView;
    if (isPayRoute) return "payment";
    return "checkout";
  });

  const [hasAutoSwitchedToPay, setHasAutoSwitchedToPay] = useState(false);
  useEffect(() => {
    if (isPayRoute) {
      setActiveView("payment");
    } else if (!initialView && invoice?.status === "pending" && !hasAutoSwitchedToPay) {
      setActiveView("payment");
      setHasAutoSwitchedToPay(true);
    }
  }, [isPayRoute, invoice?.status, hasAutoSwitchedToPay, initialView]);

  // Summary breakdown is shown immediately by default
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const [selectedMethod, setSelectedMethod] = useState<"qris" | "va" | "ewallet">("qris");
  const [selectedBank, setSelectedBank] = useState<string>("BNI");
  const [selectedWallet, setSelectedWallet] = useState<string>("DANA");

  const [isInitiating, setIsInitiating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCopiedVa, setIsCopiedVa] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>("");

  const [hasSyncedMethod, setHasSyncedMethod] = useState(false);

  // Sync selected method if already chosen on invoice
  if (invoice && !hasSyncedMethod) {
    if (invoice.selectedMethod) {
      setSelectedMethod(invoice.selectedMethod);
    }
    if (invoice.selectedBankCode) {
      if (invoice.selectedMethod === "va") {
        setSelectedBank(invoice.selectedBankCode);
      } else if (invoice.selectedMethod === "ewallet") {
        setSelectedWallet(invoice.selectedBankCode);
      }
    }
    setHasSyncedMethod(true);
  }

  // Expiry countdown timer (properly formatted for days, hours, minutes, and seconds)
  useEffect(() => {
    if (!invoice?.expiresAt || invoice.status !== "pending") return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = invoice.expiresAt! - now;
      if (diff <= 0) {
        setRemainingTime(i18n.language === "id" ? "Kedaluwarsa" : "Expired");
      } else {
        const totalSeconds = Math.floor(diff / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const pad = (n: number) => String(n).padStart(2, "0");

        if (days > 0) {
          const daysText = i18n.language === "id" ? "hari" : "d";
          setRemainingTime(`${days} ${daysText} ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
        } else if (hours > 0) {
          setRemainingTime(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
        } else {
          setRemainingTime(`${pad(minutes)}:${pad(seconds)}`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [invoice?.expiresAt, invoice?.status, i18n.language]);

  if (invoice === undefined) {
    return (
      <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <ConstellationsBackground particleCount={30} lineOpacity={0.12} starSize={1.5} />
        <div className="relative z-10 font-mono text-xs text-muted-foreground animate-pulse">
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (invoice === null) {
    return (
      <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <ConstellationsBackground particleCount={30} lineOpacity={0.12} starSize={1.5} />
        <Card cornerLines={false} className="relative z-10 max-w-md w-full bg-card/90 border border-border shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <CardTitle className="text-base font-semibold">Invoice Not Found</CardTitle>
            </div>
            <CardDescription className="text-xs font-mono">
              The invoice reference <span className="font-bold text-foreground">{invoiceNumber}</span> does not exist or has been deleted.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm" chamfer="dual" className="w-full text-xs">
              <Link href="/treasury/invoices">Back to Invoices</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Calculate upfront fee preview based on current selection
  const calculateFeePreview = () => {
    if (!invoice) return 0;

    if (selectedMethod === "qris") {
      const feeCfg = publicMethods?.qris?.fee;
      const threshold = Number(feeCfg?.threshold ?? 100000);
      const lowPct = Number(feeCfg?.lowAmountPercent ?? 0.7) / 100;
      const lowFixed = Number(feeCfg?.lowAmountFixed ?? 290);
      const highPct = Number(feeCfg?.highAmountPercent ?? 1.0) / 100;

      if (invoice.subtotal < threshold) {
        return Math.ceil(invoice.subtotal * lowPct) + lowFixed;
      } else {
        return Math.ceil(invoice.subtotal * highPct);
      }
    }
    if (selectedMethod === "va") {
      const bank = publicMethods?.va?.banks?.find(
        (b: any) => b.code.toUpperCase() === selectedBank.toUpperCase()
      );
      const percent = Number(bank?.fee?.percent ?? 0);
      const flat = Number(bank?.fee?.flat ?? 4200);
      return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
    }
    if (selectedMethod === "ewallet") {
      const wallet = publicMethods?.ewallet?.wallets?.find(
        (w: any) => w.code.toUpperCase() === selectedWallet.toUpperCase()
      );
      const percent = Number(wallet?.fee?.percent ?? 2);
      const flat = Number(wallet?.fee?.flat ?? 0);
      return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
    }
    return 0;
  };

  const qrisFeeEstimate = invoice
    ? (invoice.subtotal < Number(publicMethods?.qris?.fee?.threshold ?? 100000)
        ? Math.ceil(invoice.subtotal * (Number(publicMethods?.qris?.fee?.lowAmountPercent ?? 0.7) / 100)) +
          Number(publicMethods?.qris?.fee?.lowAmountFixed ?? 290)
        : Math.ceil(invoice.subtotal * (Number(publicMethods?.qris?.fee?.highAmountPercent ?? 1.0) / 100)))
    : 0;

  const previewFee = invoice.status === "pending" || invoice.status === "paid"
    ? invoice.gatewayFee
    : calculateFeePreview();

  const previewTotal = invoice.subtotal + previewFee;

  const handleCopyVa = () => {
    if (invoice.vaNumber) {
      void navigator.clipboard.writeText(invoice.vaNumber);
      setIsCopiedVa(true);
      setTimeout(() => setIsCopiedVa(false), 2000);
    }
  };

  const handleInitiatePayment = async () => {
    setIsInitiating(true);
    setErrorMessage(null);
    try {
      const bankCode =
        selectedMethod === "va"
          ? selectedBank
          : selectedMethod === "ewallet"
            ? selectedWallet
            : undefined;

      const returnUrl =
        window.location.protocol === "https:"
          ? `${window.location.origin}/invoice/${invoiceNumber}/pay`
          : undefined;

      await initiatePayment({
        invoiceNumber,
        method: selectedMethod,
        bankCode,
        returnUrl,
      });

      setActiveView("payment");
      setLocation(`/invoice/${invoiceNumber}/pay`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to initiate payment.");
    } finally {
      setIsInitiating(false);
    }
  };

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    setErrorMessage(null);
    try {
      await simulatePayment({ invoiceNumber });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!window.confirm(t("treasury.invoices.checkout.cancelConfirm", "Are you sure you want to cancel this invoice payment?"))) return;
    setIsCancelling(true);
    setErrorMessage(null);
    try {
      await cancelInvoice({ invoiceNumber });
      setActiveView("checkout");
      setLocation(`/invoice/${invoiceNumber}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel invoice.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Generate official PDF receipt
  const handleDownloadPdf = () => {
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(invoice.organizationName, 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Official Payment Receipt", 14, 26);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 14, 32);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 14, 38);
    doc.text(`Date: ${new Date(invoice.paidAt || invoice.createdAt).toLocaleString()}`, 14, 44);

    // Customer details
    doc.text(`Billed To: ${invoice.payerName}`, 140, 26);
    if (invoice.payerEmail) {
      doc.text(`Email: ${invoice.payerEmail}`, 140, 32);
    }
    doc.text(`Fund: ${invoice.fundName}`, 140, 38);

    // Items table
    const tableBody = [];
    if (invoice.periodLabels && invoice.periodLabels.length > 0) {
      invoice.periodLabels.forEach((period, idx) => {
        const itemAmount = invoice.subtotal / invoice.periodLabels!.length;
        tableBody.push([`${idx + 1}`, `Membership Dues - ${period}`, `Rp ${itemAmount.toLocaleString()}`]);
      });
    } else {
      tableBody.push(["1", invoice.title, `Rp ${invoice.subtotal.toLocaleString()}`]);
    }

    tableBody.push(["", "Payment Gateway Service Fee", `Rp ${invoice.gatewayFee.toLocaleString()}`]);
    tableBody.push(["", "TOTAL PAID", `Rp ${invoice.totalAmount.toLocaleString()}`]);

    autoTable(doc, {
      startY: 50,
      head: [["#", "Description", "Amount (IDR)"]],
      body: tableBody,
      theme: "striped",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [40, 40, 40] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "Cryptographically verified & settled to Kasly Cryptographic Ledger Engine.",
      14,
      finalY + 15
    );

    doc.save(`${invoice.invoiceNumber}-Receipt.pdf`);
  };

  const isPending = invoice.status === "pending";
  const isPaid = invoice.status === "paid";
  const isDraft = invoice.status === "draft";

  const qrImageUrl = invoice.qrString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(invoice.qrString)}`
    : null;

  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-3 sm:p-4 selection:bg-primary/20">
      <ConstellationsBackground particleCount={30} lineOpacity={0.12} starSize={1.5} />

      <div className="relative z-10 w-full max-w-lg py-4 sm:py-6">
        {/* ========================================================================= */}
        {/* VIEW 2: DEDICATED PAYMENT DETAILS & QR / VA SCREEN                        */}
        {/* ========================================================================= */}
        {activeView === "payment" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Top Navigation & Invoice Identity */}
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                chamfer="dual"
                onClick={() => {
                  setActiveView("checkout");
                  setIsSummaryExpanded(true);
                  setLocation(`/invoice/${invoiceNumber}`);
                }}
                className="h-8 text-xs font-mono px-2.5 flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{i18n.language === "id" ? "Rincian Tagihan" : "Invoice Details"}</span>
              </Button>

              <Badge
                variant={isPaid ? "success" : isPending ? "warning" : "outline"}
                className="font-mono text-xs px-2.5 py-0.5 font-bold"
              >
                {isPaid
                  ? t("treasury.invoices.checkout.paid")
                  : isPending
                    ? t("treasury.invoices.checkout.pending")
                    : invoice.status.toUpperCase()}
              </Badge>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* If Already Paid */}
            {isPaid ? (
              <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-emerald-500/30 shadow-lg text-center p-6 space-y-4">
                <div className="inline-flex p-3 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-emerald-400 font-mono tracking-tight">
                    {t("treasury.invoices.checkout.paidSuccessTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto font-mono">
                    {t("treasury.invoices.checkout.paidSuccessDesc")}
                  </p>
                </div>

                <div className="p-3 bg-background/60 border border-border/60 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("treasury.invoices.checkout.totalPay")}</span>
                    <span className="font-bold text-foreground">
                      {invoice.currency} {invoice.totalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t("treasury.invoices.checkout.paidAt")}</span>
                    <span>{new Date(invoice.paidAt || Date.now()).toLocaleString()}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="cyber"
                  size="default"
                  chamfer="dual"
                  onClick={handleDownloadPdf}
                  className="w-full text-xs font-mono flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{t("treasury.invoices.checkout.downloadReceipt")}</span>
                </Button>
              </Card>
            ) : (
              <>
                {/* 1. Dedicated Total Card & Expiry Bar */}
                <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md overflow-hidden">
                  <CardContent className="p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                          {t("treasury.invoices.checkout.totalPay")}
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <span className="text-xs font-mono font-bold text-primary">
                            {invoice.currency}
                          </span>
                          <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-foreground">
                            {invoice.totalAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Expiry Bar (Displays hours and days properly!) */}
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-300">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[11px] uppercase tracking-wider">
                          {t("treasury.invoices.checkout.expiresIn")}
                        </span>
                      </div>
                      <span className="font-bold text-xs sm:text-sm tracking-wide">
                        {remainingTime || "--:--"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. Payment Details (QRIS / Virtual Account / E-Wallet) */}
                <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md overflow-hidden">
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* QRIS View */}
                    {invoice.selectedMethod === "qris" && (
                      <div className="text-center space-y-3.5">
                        <div className="space-y-1">
                          <span className="text-xs font-bold font-mono text-foreground tracking-wide block">
                            QRIS
                          </span>
                          <p className="text-[11px] text-muted-foreground font-mono max-w-xs mx-auto">
                            {t("treasury.invoices.checkout.scanQrisPrompt")}
                          </p>
                        </div>

                        {qrImageUrl ? (
                          <div className="inline-block p-4 bg-white rounded-xl border border-border/80 shadow-xl">
                            <img
                              src={qrImageUrl}
                              alt="QRIS Code"
                              className="w-56 h-56 mx-auto object-contain"
                            />
                          </div>
                        ) : (
                          <div className="p-12 text-center text-xs font-mono text-muted-foreground animate-pulse">
                            Generating QR Code...
                          </div>
                        )}

                        {qrImageUrl && (
                          <div>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              chamfer="dual"
                              className="text-xs font-mono"
                            >
                              <a href={qrImageUrl} download={`${invoice.invoiceNumber}-QRIS.png`}>
                                <Download className="w-3.5 h-3.5 mr-1.5" />
                                {t("treasury.invoices.checkout.downloadQr")}
                              </a>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Virtual Account View */}
                    {invoice.selectedMethod === "va" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                          <span className="text-xs font-mono text-muted-foreground">
                            Bank :
                          </span>
                          <Badge variant="outline" className="font-mono text-xs px-2.5 py-0.5 border-primary/40 text-primary bg-primary/10 font-bold">
                            {invoice.vaBank || selectedBank || "Virtual Account"}
                          </Badge>
                        </div>

                        <div className="p-3.5 sm:p-4 bg-background/80 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                              {t("treasury.invoices.checkout.vaNumber")}
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
                            className="text-xs flex items-center justify-center gap-1.5 font-mono px-3 h-8 cursor-pointer shrink-0 shadow-sm"
                          >
                            {isCopiedVa ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {isCopiedVa
                                ? t("treasury.invoices.checkout.copied")
                                : t("treasury.invoices.checkout.copyVa")}
                            </span>
                          </Button>
                        </div>

                        <p className="text-[11px] text-muted-foreground text-center font-mono leading-relaxed pt-1">
                          {t("treasury.invoices.checkout.transferVaPrompt")}
                        </p>
                      </div>
                    )}

                    {/* E-Wallet View */}
                    {invoice.selectedMethod === "ewallet" && (
                      <div className="text-center space-y-3.5 py-2">
                        <div className="space-y-1">
                          <span className="text-xs font-bold font-mono text-foreground tracking-wide block">
                            E-Wallet ({invoice.selectedBankCode || selectedWallet})
                          </span>
                          <p className="text-xs text-muted-foreground font-mono max-w-xs mx-auto">
                            {t("treasury.invoices.checkout.ewalletPrompt")}
                          </p>
                        </div>

                        {invoice.checkoutUrl ? (
                          <Button
                            asChild
                            variant="cyber"
                            size="default"
                            chamfer="dual"
                            className="w-full text-xs sm:text-sm font-mono font-bold h-11"
                          >
                            <a href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer">
                              <span>
                                {t("treasury.invoices.checkout.openEwallet", {
                                  wallet: invoice.selectedBankCode || selectedWallet,
                                })}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                            </a>
                          </Button>
                        ) : (
                          <div className="p-3 bg-muted/20 border border-border/60 text-xs font-mono text-muted-foreground">
                            Link pembayaran aplikasi dompet digital sedang disiapkan.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Test Mode Simulation Trigger */}
                    {invoice.isTestMode && (
                      <div className="p-3 bg-violet-500/10 border border-violet-500/30 flex items-center justify-between gap-2 mt-2">
                        <span className="text-xs text-violet-300 font-mono">Sandbox Mode</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          chamfer="dual"
                          disabled={isSimulating}
                          onClick={() => {
                            void handleSimulatePayment();
                          }}
                          className="text-xs border-violet-500/40 text-violet-200 hover:bg-violet-500/20"
                        >
                          <Zap className="w-3.5 h-3.5 mr-1 text-violet-400" />
                          <span>
                            {isSimulating
                              ? t("treasury.invoices.checkout.simulating")
                              : t("treasury.invoices.checkout.simulateBtn")}
                          </span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Footer Controls: Live Status & Cancel */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pt-1">

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      chamfer="dual"
                      onClick={() => {
                        setActiveView("checkout");
                        setIsSummaryExpanded(true);
                        setLocation(`/invoice/${invoiceNumber}`);
                      }}
                      className="h-7 text-xs text-primary hover:underline px-2"
                    >
                      {i18n.language === "id" ? "Rincian Tagihan" : "Invoice Breakdown"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      chamfer="dual"
                      disabled={isCancelling}
                      onClick={() => {
                        void handleCancelInvoice();
                      }}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 px-2"
                    >
                      {isCancelling
                        ? t("treasury.invoices.checkout.cancelling")
                        : t("treasury.invoices.checkout.cancelInvoice")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: STRIPE-STYLE MOBILE INVOICE CHECKOUT                              */}
        {/* ========================================================================= */}
        {activeView === "checkout" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Top Bar: Back Link + Merchant Identity */}
            <div className="flex items-center justify-between gap-2 pb-2">
              <Button asChild variant="ghost" size="sm" chamfer="dual" className="h-8 text-xs font-mono px-2 text-muted-foreground hover:text-foreground">
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

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Stripe-style Collapsible Order Summary */}
            <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md overflow-hidden">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                      {t("treasury.invoices.checkout.totalPay")}
                    </span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xs font-mono font-bold text-primary">
                        {invoice.currency}
                      </span>
                      <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-foreground">
                        {previewTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="dual"
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                    className="h-8 text-xs font-mono px-3 flex items-center gap-1.5 border-border/80 hover:border-primary/40 cursor-pointer"
                  >
                    <span>
                      {isSummaryExpanded
                        ? (i18n.language === "id" ? "Sembunyikan" : "Hide")
                        : (i18n.language === "id" ? "Rincian Tagihan" : "Details")}
                    </span>
                    {isSummaryExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>

                {/* Collapsible Stripe-Style Breakdown */}
                {isSummaryExpanded && (
                  <div className="pt-3 border-t border-border/50 space-y-3 font-mono text-xs animate-in fade-in duration-150">
                    <div className="space-y-2">
                      {invoice.periodLabels && invoice.periodLabels.length > 0 ? (
                        invoice.periodLabels.map((label, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-b-0 gap-3"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="p-1 bg-primary/10 border border-primary/20 text-primary shrink-0">
                                <CalendarDays className="w-3.5 h-3.5" />
                              </div>
                              <span className="text-foreground break-words leading-tight">
                                {t("treasury.invoices.checkout.duesPeriod", { label })}
                              </span>
                            </div>
                            <span className="font-semibold text-foreground shrink-0 font-mono">
                              {invoice.currency}{" "}
                              {(invoice.subtotal / invoice.periodLabels!.length).toLocaleString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center justify-between py-1.5 border-b border-border/30 gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="p-1 bg-primary/10 border border-primary/20 text-primary shrink-0">
                              <Receipt className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-foreground break-words leading-tight">{invoice.title}</span>
                          </div>
                          <span className="font-semibold text-foreground shrink-0 font-mono">
                            {invoice.currency} {invoice.subtotal.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/40 space-y-1.5 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>{t("treasury.invoices.checkout.subtotal")}</span>
                        <span className="text-foreground">
                          {invoice.currency} {invoice.subtotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("treasury.invoices.checkout.adminFee")}</span>
                        <span className="text-foreground">
                          {invoice.currency} {previewFee.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border/40 font-bold text-foreground">
                        <span>{t("treasury.invoices.checkout.totalPay")}</span>
                        <span className="text-primary font-mono">
                          {invoice.currency} {previewTotal.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border/30 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("treasury.invoices.checkout.billedTo")}: {invoice.payerName}</span>
                      <span>{new Date(invoice.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* If Invoice Already Has Pending Payment */}
            {isPending && (
              <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-amber-500/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-mono text-xs">
                    <Clock className="w-4 h-4" />
                    <span>{t("treasury.invoices.checkout.pending")}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-300">
                    {remainingTime}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="cyber"
                  chamfer="dual"
                  size="default"
                  onClick={() => {
                    setActiveView("payment");
                    setLocation(`/invoice/${invoiceNumber}/pay`);
                  }}
                  className="w-full text-xs font-mono font-bold h-11 flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>
                    {i18n.language === "id"
                      ? "Buka Halaman Pembayaran & QR Code →"
                      : "Open Payment Screen & QR Code →"}
                  </span>
                </Button>
              </Card>
            )}

            {/* If Invoice is Paid */}
            {isPaid && (
              <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-emerald-500/30 p-5 text-center space-y-3">
                <div className="inline-flex p-2.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-mono font-bold text-emerald-400 text-sm">
                    {t("treasury.invoices.checkout.paidSuccessTitle")}
                  </h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    {t("treasury.invoices.checkout.paidSuccessDesc")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={handleDownloadPdf}
                  className="text-xs font-mono"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  <span>{t("treasury.invoices.checkout.downloadReceipt")}</span>
                </Button>
              </Card>
            )}

            {/* Payment Method Selector (For Draft Invoices) */}
            {isDraft && (
              <Card cornerLines={false} className="bg-card/90 backdrop-blur-md border border-border/80 shadow-md">
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <span className="text-xs font-semibold text-foreground block font-mono">
                    {t("treasury.invoices.checkout.selectMethod")}
                  </span>

                  {/* Method Tabs: QRIS, VA, E-Wallet */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMethod("qris")}
                      className={`p-3 border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${selectedMethod === "qris"
                        ? "bg-primary/20 border-primary text-foreground shadow-sm ring-1 ring-primary/40"
                        : "bg-muted/15 border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30"
                        }`}
                    >
                      <QrCode className={`w-5 h-5 ${selectedMethod === "qris" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-mono font-bold">QRIS</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        +Rp {qrisFeeEstimate.toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod("va")}
                      className={`p-3 border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${selectedMethod === "va"
                        ? "bg-primary/20 border-primary text-foreground shadow-sm ring-1 ring-primary/40"
                        : "bg-muted/15 border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30"
                        }`}
                    >
                      <Building className={`w-5 h-5 ${selectedMethod === "va" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-mono font-bold">Virtual Account</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        +Rp {Number(publicMethods?.va?.banks?.[0]?.fee?.flat ?? 4200).toLocaleString()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMethod("ewallet")}
                      className={`p-3 border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${selectedMethod === "ewallet"
                        ? "bg-primary/20 border-primary text-foreground shadow-sm ring-1 ring-primary/40"
                        : "bg-muted/15 border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30"
                        }`}
                    >
                      <Wallet className={`w-5 h-5 ${selectedMethod === "ewallet" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="text-xs font-mono font-bold">E-Wallet</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        +{Number(publicMethods?.ewallet?.wallets?.[0]?.fee?.percent ?? 2)}%
                      </span>
                    </button>
                  </div>

                  {/* Sub-selector for Virtual Account */}
                  {selectedMethod === "va" && (
                    <div className="p-3 bg-muted/15 border border-border/60 space-y-2">
                      <label className="text-xs font-medium text-foreground block font-mono">
                        {t("treasury.invoices.checkout.selectBank")}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(publicMethods?.va?.banks && publicMethods.va.banks.length > 0
                          ? publicMethods.va.banks
                          : [
                              { code: "BNI", name: "BNI", fee: { flat: 4200, percent: 0 } },
                              { code: "BCA", name: "BCA", fee: { flat: 4200, percent: 0 } },
                              { code: "MANDIRI", name: "Mandiri", fee: { flat: 4200, percent: 0 } },
                              { code: "BRI", name: "BRI", fee: { flat: 4200, percent: 0 } },
                            ]
                        ).map((b: any) => {
                          const bankFee = invoice
                            ? Math.ceil(invoice.subtotal * (Number(b.fee?.percent ?? 0) / 100)) +
                              Number(b.fee?.flat ?? 4200)
                            : 4200;
                          return (
                            <button
                              type="button"
                              key={b.code}
                              onClick={() => setSelectedBank(b.code)}
                              className={`p-2 border text-left flex items-center justify-between text-xs font-mono transition-all cursor-pointer ${
                                selectedBank.toUpperCase() === b.code.toUpperCase()
                                  ? "bg-primary/20 border-primary text-foreground font-bold"
                                  : "bg-background/80 border-border/60 text-muted-foreground hover:border-border"
                              }`}
                            >
                              <span>{b.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                +Rp {bankFee.toLocaleString()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sub-selector for E-Wallet */}
                  {selectedMethod === "ewallet" && (
                    <div className="p-3 bg-muted/15 border border-border/60 space-y-2">
                      <label className="text-xs font-medium text-foreground block font-mono">
                        {t("treasury.invoices.checkout.selectWallet")}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(publicMethods?.ewallet?.wallets && publicMethods.ewallet.wallets.length > 0
                          ? publicMethods.ewallet.wallets
                          : [
                              { code: "DANA", name: "DANA", fee: { percent: 2, flat: 0 } },
                              { code: "SHOPEE", name: "ShopeePay", fee: { percent: 2, flat: 0 } },
                              { code: "OVO", name: "OVO", fee: { percent: 2, flat: 0 } },
                            ]
                        ).map((w: any) => {
                          const walletFee = invoice
                            ? Math.ceil(invoice.subtotal * (Number(w.fee?.percent ?? 2) / 100)) +
                              Number(w.fee?.flat ?? 0)
                            : 0;
                          return (
                            <button
                              type="button"
                              key={w.code}
                              onClick={() => setSelectedWallet(w.code)}
                              className={`p-2 border text-center text-xs font-mono transition-all cursor-pointer ${
                                selectedWallet.toUpperCase() === w.code.toUpperCase()
                                  ? "bg-primary/20 border-primary text-foreground font-bold"
                                  : "bg-background/80 border-border/60 text-muted-foreground hover:border-border"
                              }`}
                            >
                              <div>{w.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                +Rp {walletFee.toLocaleString()}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Big Primary Pay CTA */}
                  <Button
                    type="button"
                    variant="cyber"
                    chamfer="dual"
                    size="default"
                    disabled={isInitiating}
                    onClick={() => {
                      void handleInitiatePayment();
                    }}
                    className="w-full text-sm font-mono font-bold h-12 flex items-center justify-center gap-2 cursor-pointer shadow-lg mt-2"
                  >
                    <span>
                      {isInitiating
                        ? t("treasury.invoices.checkout.generating")
                        : `${t("treasury.invoices.checkout.generatePayment", {
                          method: selectedMethod.toUpperCase(),
                        })} • ${invoice.currency} ${previewTotal.toLocaleString()}`}
                    </span>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
