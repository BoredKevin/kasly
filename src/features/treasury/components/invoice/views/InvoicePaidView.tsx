import { useTranslation } from "react-i18next";
import { Button } from "@boredkevin/ui";
import { Panel } from "../../../../../ui";
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
      <div className="flex items-center justify-between pb-1 max-w-sm sm:max-w-md mx-auto">
        <Button
          asChild
          variant="ghost"
          size="sm"
          chamfer="none"
          className="h-8 text-xs font-sans font-medium px-2 text-muted-foreground hover:text-foreground cursor-pointer rounded-[var(--fintech-radius-sm)]"
        >
          <Link href="/treasury/invoices">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            <span>Invoices</span>
          </Link>
        </Button>
      </div>

      <Panel className="bg-card border border-emerald-500/30 shadow-sm text-center p-6 sm:p-8 space-y-4 max-w-sm sm:max-w-md mx-auto rounded-[var(--fintech-radius-md)]">
        <div className="inline-flex p-3 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/30">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-emerald-400 font-sans tracking-tight">
            {t("treasury.invoices.checkout.paidSuccessTitle", "PAYMENT CONFIRMED")}
          </h3>
          <p className="text-xs text-muted-foreground font-sans max-w-xs mx-auto">
            {t(
              "treasury.invoices.checkout.paidSuccessDesc",
              "Your payment has been verified and settled to the organization treasury ledger."
            )}
          </p>
        </div>

        <div className="p-3.5 bg-muted/20 border border-border/60 text-xs font-sans space-y-1.5 rounded-[var(--fintech-radius-sm)] text-left">
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
            <span className="font-bold text-foreground font-mono">#{invoice.invoiceNumber}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="default"
          size="default"
          chamfer="none"
          onClick={onDownloadPdf}
          className="w-full text-xs font-sans font-semibold flex items-center justify-center gap-2 h-11 bg-primary text-primary-foreground hover:bg-primary/90 rounded-[var(--fintech-radius-sm)] shadow-xs cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>{t("treasury.invoices.checkout.downloadReceipt", "Download Official Receipt (PDF)")}</span>
        </Button>
      </Panel>
    </div>
  );
}
