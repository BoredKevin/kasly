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
  CardFooter,
  Button,
  ConstellationsBackground,
} from "@boredkevin/ui";
import { XCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { InvoiceCheckoutView } from "./invoice/views/InvoiceCheckoutView";
import { InvoicePaymentView } from "./invoice/views/InvoicePaymentView";
import { InvoicePaidView } from "./invoice/views/InvoicePaidView";
import { InvoiceAwaitingView } from "./invoice/views/InvoiceAwaitingView";

export interface InvoicePaymentPageProps {
  invoiceNumber: string;
  initialView?: "checkout" | "payment";
}

export function InvoicePaymentPage({
  invoiceNumber,
  initialView,
}: InvoicePaymentPageProps) {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const isPayRoute = location.endsWith("/pay");

  const invoice = useQuery(api.treasury.borderpay.getInvoice, { invoiceNumber });
  const publicMethods = useQuery(
    api.treasury.borderpay.getPublicPaymentMethods,
    invoice ? { organizationId: invoice.organizationId } : "skip"
  );

  const initiatePayment = useAction(api.treasury.borderpay.initiatePayment);
  const simulatePayment = useAction(api.treasury.borderpay.simulatePayment);
  const confirmCustomerPayment = useAction(api.treasury.borderpay.confirmCustomerPayment);
  const cancelInvoice = useMutation(api.treasury.borderpay.cancelInvoice);
  const syncCheckoutMethods = useAction(api.treasury.borderpay.syncCheckoutPaymentMethods);

  const [isConfirmingClaim, setIsConfirmingClaim] = useState(false);

  // Sync methods when viewing draft
  useEffect(() => {
    if (invoice && invoice.status === "draft") {
      void syncCheckoutMethods({ invoiceNumber });
    }
  }, [invoice, invoiceNumber, syncCheckoutMethods]);

  // View state: "checkout" vs "payment"
  const [userViewOverride, setUserViewOverride] = useState<"checkout" | "payment" | null>(null);

  const activeView: "checkout" | "payment" =
    userViewOverride ??
    (initialView ??
      (isPayRoute || (invoice?.status === "pending" && !invoice?.isAwaitingConfirmation)
        ? "payment"
        : "checkout"));

  const [selectedMethod, setSelectedMethod] = useState<"qris" | "va" | "ewallet">("qris");
  const [selectedBank, setSelectedBank] = useState<string>("BNI");
  const [selectedWallet, setSelectedWallet] = useState<string>("DANA");

  const [isInitiating, setIsInitiating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [hasSyncedMethod, setHasSyncedMethod] = useState(false);

  // Sync pre-selected method if already chosen on invoice
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

  // Calculate upfront fee preview based on current selection
  const calculateFeePreview = () => {
    if (!invoice) return 0;

    if (selectedMethod === "qris") {
      const qris = publicMethods?.qris;
      const feeCfg = qris?.fee;

      if (qris?.gateway === "temanqris" || feeCfg?.isCustom) {
        const flat = Number(feeCfg?.flat ?? 0);
        const percent = Number(feeCfg?.percent ?? 0);
        return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
      }

      if (!feeCfg) return 0;

      const threshold = Number(feeCfg.threshold ?? 100000);
      const lowPct = Number(feeCfg.lowAmountPercent ?? 0.7) / 100;
      const lowFixed = Number(feeCfg.lowAmountFixed ?? 290);
      const highPct = Number(feeCfg.highAmountPercent ?? 1.0) / 100;

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
      if (!bank && !publicMethods) return 0;
      const percent = Number(bank?.fee?.percent ?? 0);
      const flat = Number(bank?.fee?.flat ?? 4200);
      return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
    }
    if (selectedMethod === "ewallet") {
      const wallet = publicMethods?.ewallet?.wallets?.find(
        (w: any) => w.code.toUpperCase() === selectedWallet.toUpperCase()
      );
      if (!wallet && !publicMethods) return 0;
      const percent = Number(wallet?.fee?.percent ?? 2);
      const flat = Number(wallet?.fee?.flat ?? 0);
      return Math.ceil(invoice.subtotal * (percent / 100)) + flat;
    }
    return 0;
  };

  const previewFee =
    invoice?.status === "pending" || invoice?.status === "paid"
      ? invoice.gatewayFee
      : calculateFeePreview();

  const previewTotal = (invoice?.subtotal ?? 0) + previewFee;

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

      setUserViewOverride("payment");
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

  const handleConfirmClaim = async () => {
    setIsConfirmingClaim(true);
    setErrorMessage(null);
    try {
      await confirmCustomerPayment({ invoiceNumber });
      setUserViewOverride("checkout");
      setLocation(`/invoice/${invoiceNumber}`);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Gagal mengonfirmasi pembayaran."
      );
    } finally {
      setIsConfirmingClaim(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (
      !window.confirm(
        t(
          "treasury.invoices.checkout.cancelConfirm",
          "Are you sure you want to cancel this invoice payment?"
        )
      )
    )
      return;
    setIsCancelling(true);
    setErrorMessage(null);
    try {
      await cancelInvoice({ invoiceNumber });
      setUserViewOverride("checkout");
      setLocation(`/invoice/${invoiceNumber}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to cancel invoice.");
    } finally {
      setIsCancelling(false);
    }
  };

  // Generate official PDF receipt
  const handleDownloadPdf = () => {
    if (!invoice) return;
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(invoice.organizationName, 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Official Payment Receipt", 14, 26);
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 14, 32);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 14, 38);
    doc.text(
      `Date: ${new Date(invoice.paidAt || invoice.createdAt).toLocaleString()}`,
      14,
      44
    );

    // Customer details
    doc.text(`Billed To: ${invoice.payerName}`, 140, 26);
    if (invoice.payerEmail) {
      doc.text(`Email: ${invoice.payerEmail}`, 140, 32);
    }
    doc.text(`Fund: ${invoice.fundName}`, 140, 38);

    // Items table
    const tableBody = [];
    if (invoice.periodLabels && invoice.periodLabels.length > 0) {
      invoice.periodLabels.forEach((period: string, idx: number) => {
        const itemAmount = invoice.subtotal / invoice.periodLabels!.length;
        tableBody.push([
          `${idx + 1}`,
          `Membership Dues - ${period}`,
          `Rp ${itemAmount.toLocaleString()}`,
        ]);
      });
    } else {
      tableBody.push(["1", invoice.title, `Rp ${invoice.subtotal.toLocaleString()}`]);
    }

    tableBody.push([
      "",
      "Payment Gateway Service Fee",
      `Rp ${invoice.gatewayFee.toLocaleString()}`,
    ]);
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
        <Card
          cornerLines={false}
          className="relative z-10 max-w-md w-full bg-card/90 border border-border shadow-2xl"
        >
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <CardTitle className="text-base font-semibold">Invoice Not Found</CardTitle>
            </div>
            <CardDescription className="text-xs font-mono">
              The invoice reference{" "}
              <span className="font-bold text-foreground">{invoiceNumber}</span> does
              not exist or has been deleted.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              asChild
              variant="outline"
              size="sm"
              chamfer="none"
              className="w-full text-xs"
            >
              <Link href="/treasury/invoices">Back to Invoices</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isAwaitingConfirmation = Boolean(
    invoice?.isAwaitingConfirmation && invoice?.status === "pending"
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground flex items-center justify-center p-3 sm:p-4 selection:bg-primary/20">
      <ConstellationsBackground particleCount={30} lineOpacity={0.12} starSize={1.5} />

      <div className="relative z-10 w-full max-w-lg py-4 sm:py-6">
        {/* State 1: Paid */}
        {isPaid ? (
          <InvoicePaidView invoice={invoice} onDownloadPdf={handleDownloadPdf} />
        ) : isAwaitingConfirmation ? (
          /* State 2: Awaiting Confirmation */
          <InvoiceAwaitingView
            invoice={invoice}
            onBackToCheckout={() => {
              setUserViewOverride("checkout");
              setLocation(`/invoice/${invoiceNumber}`);
            }}
            onSimulatePayment={() => void handleSimulatePayment()}
            isSimulating={isSimulating}
          />
        ) : activeView === "payment" ? (
          /* State 3: Dedicated QRIS / Payment Screen */
          <InvoicePaymentView
            invoice={invoice}
            onBackToCheckout={() => {
              setUserViewOverride("checkout");
              setLocation(`/invoice/${invoiceNumber}`);
            }}
            onConfirmClaim={() => void handleConfirmClaim()}
            isConfirmingClaim={isConfirmingClaim}
            onSimulatePayment={() => void handleSimulatePayment()}
            isSimulating={isSimulating}
            onCancelInvoice={() => void handleCancelInvoice()}
            isCancelling={isCancelling}
            errorMessage={errorMessage}
          />
        ) : (
          /* State 4: Checkout & Order Review Screen */
          <InvoiceCheckoutView
            invoice={invoice}
            publicMethods={publicMethods}
            selectedMethod={selectedMethod}
            setSelectedMethod={setSelectedMethod}
            selectedBank={selectedBank}
            setSelectedBank={setSelectedBank}
            selectedWallet={selectedWallet}
            setSelectedWallet={setSelectedWallet}
            previewFee={previewFee}
            previewTotal={previewTotal}
            isInitiating={isInitiating}
            errorMessage={errorMessage}
            onInitiatePayment={() => void handleInitiatePayment()}
          />
        )}
      </div>
    </div>
  );
}
