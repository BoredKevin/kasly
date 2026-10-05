import { useTranslation } from "react-i18next";
import { Card, Button } from "@boredkevin/ui";
import { CheckCircle2, Download, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export interface InvoicePaidViewProps {
  invoice: any;
  onDownloadPdf: () => void;
}

export function InvoicePaidView({ invoice, onDownloadPdf }: InvoicePaidViewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between pb-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          chamfer="none"
          className="h-8 text-xs font-mono px-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Link href="/treasury/invoices">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Invoices</span>
          </Link>
        </Button>
      </div>

      <Card
        cornerLines={false}
        className="bg-card/90 backdrop-blur-md border border-emerald-500/40 shadow-2xl text-center p-6 sm:p-8 space-y-4 max-w-sm sm:max-w-md mx-auto"
      >
        <div className="inline-flex p-3 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/40">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-emerald-400 font-mono tracking-tight">
            {t("treasury.invoices.checkout.paidSuccessTitle", "PAYMENT CONFIRMED")}
          </h3>
          <p className="text-xs text-muted-foreground font-mono max-w-xs mx-auto">
            {t(
              "treasury.invoices.checkout.paidSuccessDesc",
              "Your payment has been verified and settled to the organization treasury ledger."
            )}
          </p>
        </div>

        <div className="p-3.5 bg-background/60 border border-border/60 text-xs font-mono space-y-1.5 rounded-md text-left">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("treasury.invoices.checkout.totalPay", "Total Amount")}</span>
            <span className="font-bold text-foreground">
              {invoice.currency} {invoice.totalAmount.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>{t("treasury.invoices.checkout.paidAt", "Paid At")}</span>
            <span>{new Date(invoice.paidAt || invoice.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Invoice No</span>
            <span className="font-bold text-foreground">#{invoice.invoiceNumber}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="cyber"
          size="default"
          chamfer="none"
          onClick={onDownloadPdf}
          className="w-full text-xs font-mono flex items-center justify-center gap-2 h-11 cursor-pointer shadow-lg"
        >
          <Download className="w-4 h-4" />
          <span>{t("treasury.invoices.checkout.downloadReceipt", "Download Official Receipt (PDF)")}</span>
        </Button>
      </Card>
    </div>
  );
}
