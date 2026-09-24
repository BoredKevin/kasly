import { useState, useEffect } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { Link } from "wouter";
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
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface InvoicePaymentPageProps {
  invoiceNumber: string;
}

export function InvoicePaymentPage({ invoiceNumber }: InvoicePaymentPageProps) {
  const { t } = useTranslation();

  const invoice = useQuery(api.treasury.borderpay.getInvoice, { invoiceNumber });
  const publicMethods = useQuery(
    api.treasury.borderpay.getPublicPaymentMethods,
    invoice ? { organizationId: invoice.organizationId } : "skip"
  );

  const initiatePayment = useAction(api.treasury.borderpay.initiatePayment);
  const simulatePayment = useAction(api.treasury.borderpay.simulatePayment);
  const cancelInvoice = useMutation(api.treasury.borderpay.cancelInvoice);

  const [selectedMethod, setSelectedMethod] = useState<"qris" | "va" | "ewallet">("qris");
  const [selectedBank, setSelectedBank] = useState<string>("BNI");
  const [selectedWallet, setSelectedWallet] = useState<string>("DANA");

  const [isInitiating, setIsInitiating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
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

  // Expiry countdown timer
  useEffect(() => {
    if (!invoice?.expiresAt || invoice.status !== "pending") return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = invoice.expiresAt! - now;
      if (diff <= 0) {
        setRemainingTime("00:00");
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setRemainingTime(
          `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [invoice?.expiresAt, invoice?.status]);

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
        <Card telemetry="INVOICE.NOT_FOUND" cornerLines className="relative z-10 max-w-md w-full bg-card border-border shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <CardTitle className="text-base">Invoice Not Found</CardTitle>
            </div>
            <CardDescription className="text-xs">
              The invoice reference <span className="font-mono">{invoiceNumber}</span> does not exist or has been deleted.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline" size="sm" chamfer="dual" className="w-full text-xs">
              <Link href="/">Back to Kasly</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Calculate upfront fee preview based on current selection
  const calculateFeePreview = () => {
    if (selectedMethod === "qris") {
      if (invoice.subtotal < 100000) {
        return Math.ceil(invoice.subtotal * 0.007) + 290;
      } else {
        return Math.ceil(invoice.subtotal * 0.01);
      }
    }
    if (selectedMethod === "va") {
      const bank = publicMethods?.va?.banks?.find((b: any) => b.code === selectedBank);
      const percent = Number(bank?.fee?.percent ?? 0);
      const flat = Number(bank?.fee?.flat ?? 4200);
      return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
    }
    if (selectedMethod === "ewallet") {
      const wallet = publicMethods?.ewallet?.wallets?.find((w: any) => w.code === selectedWallet);
      const percent = Number(wallet?.fee?.percent ?? 2);
      const flat = Number(wallet?.fee?.flat ?? 0);
      return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
    }
    return 0;
  };

  const previewFee = invoice.status === "pending" || invoice.status === "paid"
    ? invoice.gatewayFee
    : calculateFeePreview();

  const previewTotal = invoice.subtotal + previewFee;

  const handleCopyVa = () => {
    if (invoice.vaNumber) {
      void navigator.clipboard.writeText(invoice.vaNumber);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
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
          ? window.location.href
          : undefined;

      await initiatePayment({
        invoiceNumber,
        method: selectedMethod,
        bankCode,
        returnUrl,
      });
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
    if (!window.confirm(t("treasury.invoices.checkout.cancelConfirm"))) return;
    setIsCancelling(true);
    setErrorMessage(null);
    try {
      await cancelInvoice({ invoiceNumber });
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
  const isCancelled = invoice.status === "cancelled";
  const isExpired = invoice.status === "expired";

  const qrImageUrl = invoice.qrString
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(invoice.qrString)}`
    : null;

  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-4 selection:bg-primary/20">
      <ConstellationsBackground particleCount={30} lineOpacity={0.12} starSize={1.5} />

      <div className="relative z-10 w-full max-w-xl py-6">
        <Card telemetry="INVOICE.PAYMENT" cornerLines className="bg-card border-border shadow-2xl">
          {/* Invoice Header */}
          <CardHeader className="pb-4 border-b border-border/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  {invoice.organizationName} • {invoice.fundName}
                </span>
                <CardTitle className="text-xl font-bold font-mono tracking-tight flex items-center gap-2">
                  <span>{invoice.invoiceNumber}</span>
                </CardTitle>
              </div>

              <div>
                {isPaid && (
                  <Badge variant="success" className="font-mono text-xs px-2.5 py-1 font-bold animate-pulse">
                    {t("treasury.invoices.checkout.paid")}
                  </Badge>
                )}
                {isPending && (
                  <Badge variant="warning" className="font-mono text-xs px-2.5 py-1 font-bold">
                    {t("treasury.invoices.checkout.pending")}
                  </Badge>
                )}
                {isDraft && (
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                    DRAFT
                  </Badge>
                )}
                {isCancelled && (
                  <Badge variant="destructive" className="font-mono text-xs px-2.5 py-1">
                    {t("treasury.invoices.checkout.cancelled")}
                  </Badge>
                )}
                {isExpired && (
                  <Badge variant="destructive" className="font-mono text-xs px-2.5 py-1">
                    {t("treasury.invoices.checkout.expired")}
                  </Badge>
                )}
              </div>
            </div>

            {/* Timestamps & Payer info */}
            <div className="grid grid-cols-2 gap-2 pt-3 text-xs font-mono text-muted-foreground border-t border-border/40 mt-3">
              <div>
                <span className="text-[10px] uppercase block">{t("treasury.invoices.checkout.billedTo")}</span>
                <span className="text-foreground font-semibold">{invoice.payerName}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase block">{t("treasury.invoices.checkout.issueDate")}</span>
                <span className="text-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-5">
            {errorMessage && (
              <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* PAID State Banner */}
            {isPaid && (
              <div className="p-4 bg-emerald-500/[0.08] border border-emerald-500/30 text-center space-y-3">
                <div className="inline-flex p-3 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-emerald-400 tracking-tight font-mono">
                    {t("treasury.invoices.checkout.paidSuccessTitle")}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    {t("treasury.invoices.checkout.paidSuccessDesc")}
                  </p>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="dual"
                    onClick={handleDownloadPdf}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("treasury.invoices.checkout.downloadReceipt")}</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Line Items Breakdown */}
            <div className="p-3 bg-muted/20 border border-border/70 space-y-2">
              <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                {t("treasury.invoices.checkout.lineItems")}
              </span>

              <div className="space-y-1.5 text-xs font-mono">
                {invoice.periodLabels && invoice.periodLabels.length > 0 ? (
                  invoice.periodLabels.map((label, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-border/30 last:border-b-0">
                      <span className="text-foreground">{t("treasury.invoices.checkout.duesPeriod", { label })}</span>
                      <span className="font-semibold text-foreground">
                        {invoice.currency} {(invoice.subtotal / invoice.periodLabels!.length).toLocaleString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between py-1 border-b border-border/30">
                    <span className="text-foreground">{invoice.title}</span>
                    <span className="font-semibold text-foreground">
                      {invoice.currency} {invoice.subtotal.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className="flex justify-between py-1 text-muted-foreground pt-2 border-t border-border/40">
                  <span>{t("treasury.invoices.checkout.subtotal")}</span>
                  <span>{invoice.currency} {invoice.subtotal.toLocaleString()}</span>
                </div>

                <div className="flex justify-between py-1 text-muted-foreground">
                  <span>{t("treasury.invoices.checkout.adminFee")}</span>
                  <span>{invoice.currency} {previewFee.toLocaleString()}</span>
                </div>

                <div className="flex justify-between py-2 text-sm font-bold text-primary border-t border-border/80">
                  <span>{t("treasury.invoices.checkout.totalPay")}</span>
                  <span>{invoice.currency} {previewTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* PENDING State: Payment Instructions */}
            {isPending && (
              <div className="space-y-4 pt-2 border-t border-border/60">
                {/* Expiry Bar */}
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs font-mono text-amber-300">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{t("treasury.invoices.checkout.expiresIn")}</span>
                  </div>
                  <span className="font-bold text-sm">{remainingTime || "--:--"}</span>
                </div>

                {/* QRIS Display */}
                {invoice.selectedMethod === "qris" && qrImageUrl && (
                  <div className="p-4 bg-muted/15 border border-border/60 text-center space-y-3">
                    <div className="inline-block p-3 bg-white rounded-lg border border-border shadow-md">
                      <img
                        src={qrImageUrl}
                        alt="QRIS Code"
                        className="w-56 h-56 mx-auto object-contain"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      {t("treasury.invoices.checkout.scanQrisPrompt")}
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      chamfer="dual"
                      className="text-xs"
                    >
                      <a href={qrImageUrl} download={`${invoice.invoiceNumber}-QRIS.png`}>
                        <Download className="w-3.5 h-3.5 mr-1" />
                        {t("treasury.invoices.checkout.downloadQr")}
                      </a>
                    </Button>
                  </div>
                )}

                {/* Virtual Account Display */}
                {invoice.selectedMethod === "va" && invoice.vaNumber && (
                  <div className="p-4 bg-muted/15 border border-border/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-mono">
                        {t("treasury.invoices.checkout.vaBank")}:
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {invoice.vaBank || "Virtual Account"}
                      </Badge>
                    </div>

                    <div className="p-3 bg-background border border-border flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                          {t("treasury.invoices.checkout.vaNumber")}
                        </span>
                        <span className="font-mono text-lg font-bold text-foreground tracking-wider">
                          {invoice.vaNumber}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="cyber"
                        size="sm"
                        chamfer="dual"
                        onClick={handleCopyVa}
                        className="text-xs flex items-center gap-1"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? t("treasury.invoices.checkout.copied") : t("treasury.invoices.checkout.copyVa")}</span>
                      </Button>
                    </div>

                    <p className="text-[11px] text-muted-foreground text-center">
                      {t("treasury.invoices.checkout.transferVaPrompt")}
                    </p>
                  </div>
                )}

                {/* E-Wallet Display */}
                {invoice.selectedMethod === "ewallet" && invoice.checkoutUrl && (
                  <div className="p-4 bg-muted/15 border border-border/60 text-center space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {t("treasury.invoices.checkout.ewalletPrompt")}
                    </p>
                    <Button
                      asChild
                      variant="cyber"
                      size="sm"
                      chamfer="dual"
                      className="text-xs font-semibold"
                    >
                      <a href={invoice.checkoutUrl} target="_blank" rel="noopener noreferrer">
                        <span>{t("treasury.invoices.checkout.openEwallet", { wallet: invoice.selectedBankCode || "E-Wallet" })}</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                      </a>
                    </Button>
                  </div>
                )}

                {/* Test Mode Simulation Trigger */}
                {invoice.isTestMode && (
                  <div className="p-3 bg-violet-500/10 border border-violet-500/30 flex items-center justify-between gap-2">
                    <div className="text-xs text-violet-300 font-mono">
                      <span>Sandbox Mode: Simulate real webhook</span>
                    </div>
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
                      <span>{isSimulating ? t("treasury.invoices.checkout.simulating") : t("treasury.invoices.checkout.simulateBtn")}</span>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* DRAFT State: Select Payment Method & Bank */}
            {isDraft && (
              <div className="space-y-4 pt-2 border-t border-border/60">
                <span className="text-xs font-semibold text-foreground block">
                  {t("treasury.invoices.checkout.selectMethod")}
                </span>

                {/* Method Options: QRIS, VA, E-Wallet */}
                <div className="grid grid-cols-3 gap-2">
                  <div
                    onClick={() => setSelectedMethod("qris")}
                    className={`p-3 border text-center transition-all cursor-pointer space-y-1 ${
                      selectedMethod === "qris"
                        ? "bg-primary/20 border-primary text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <QrCode className="w-5 h-5 mx-auto text-primary" />
                    <span className="text-xs font-semibold block">QRIS</span>
                  </div>

                  <div
                    onClick={() => setSelectedMethod("va")}
                    className={`p-3 border text-center transition-all cursor-pointer space-y-1 ${
                      selectedMethod === "va"
                        ? "bg-primary/20 border-primary text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <Building className="w-5 h-5 mx-auto text-primary" />
                    <span className="text-xs font-semibold block">Virtual Account</span>
                  </div>

                  <div
                    onClick={() => setSelectedMethod("ewallet")}
                    className={`p-3 border text-center transition-all cursor-pointer space-y-1 ${
                      selectedMethod === "ewallet"
                        ? "bg-primary/20 border-primary text-foreground"
                        : "bg-muted/20 border-border/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <Wallet className="w-5 h-5 mx-auto text-primary" />
                    <span className="text-xs font-semibold block">E-Wallet</span>
                  </div>
                </div>

                {/* Sub-selector for VA Bank */}
                {selectedMethod === "va" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("treasury.invoices.checkout.selectBank")}
                    </label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {(publicMethods?.va?.banks || [
                        { code: "BNI", name: "BNI" },
                        { code: "BCA", name: "BCA" },
                        { code: "MANDIRI", name: "Mandiri" },
                        { code: "BRI", name: "BRI" },
                      ]).map((b: any) => (
                        <option key={b.code} value={b.code}>
                          {b.name} (Fee: Rp {Number(b.fee?.flat ?? 4200).toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub-selector for E-Wallet */}
                {selectedMethod === "ewallet" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground block">
                      {t("treasury.invoices.checkout.selectWallet")}
                    </label>
                    <select
                      value={selectedWallet}
                      onChange={(e) => setSelectedWallet(e.target.value)}
                      className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      {(publicMethods?.ewallet?.wallets || [
                        { code: "DANA", name: "DANA" },
                        { code: "SHOPEE", name: "ShopeePay" },
                        { code: "OVO", name: "OVO" },
                      ]).map((w: any) => (
                        <option key={w.code} value={w.code}>
                          {w.name} (Fee: {w.fee?.percent ?? 2}%)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Generate Payment Button */}
                <Button
                  type="button"
                  variant="cyber"
                  chamfer="dual"
                  disabled={isInitiating}
                  onClick={() => {
                    void handleInitiatePayment();
                  }}
                  className="w-full text-xs font-semibold py-2.5 flex items-center justify-center gap-1.5"
                >
                  {isInitiating
                    ? t("treasury.invoices.checkout.generating")
                    : t("treasury.invoices.checkout.generatePayment", {
                        method: selectedMethod.toUpperCase(),
                      })}
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter className="pt-4 border-t border-border/80 flex justify-between items-center text-xs">
            <Button asChild variant="outline" size="sm" chamfer="dual">
              <Link href="/treasury/invoices">
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                <span>Invoices List</span>
              </Link>
            </Button>

            {isPending && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                disabled={isCancelling}
                onClick={() => {
                  void handleCancelInvoice();
                }}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                {isCancelling
                  ? t("treasury.invoices.checkout.cancelling")
                  : t("treasury.invoices.checkout.cancelInvoice")}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
