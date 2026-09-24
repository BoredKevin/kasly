import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import {
  Receipt,
  Plus,
  ExternalLink,
  Copy,
  Check,
  CreditCard,
  Search,
} from "lucide-react";
import { CreateCustomInvoiceModal } from "./CreateCustomInvoiceModal";
import { CreateInvoiceModal } from "./CreateInvoiceModal";

interface InvoicesPaneProps {
  organizationId: Id<"organizations">;
  activeFundId: Id<"funds"> | null;
}

export function InvoicesPane({
  organizationId,
  activeFundId,
}: InvoicesPaneProps) {
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isDuesModalOpen, setIsDuesModalOpen] = useState(false);
  const [copiedInvoiceNumber, setCopiedInvoiceNumber] = useState<string | null>(null);

  const myMembership = useQuery(api.members.getMyMembership, { organizationId });
  const invoices = useQuery(api.treasury.borderpay.listInvoices, {
    organizationId,
    fundId: activeFundId || undefined,
    status: statusFilter,
  });

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const filteredInvoices = (invoices || []).filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.payerName.toLowerCase().includes(q) ||
      inv.title.toLowerCase().includes(q)
    );
  });

  const handleCopyLink = (invoiceNumber: string) => {
    const url = `${window.location.origin}/invoice/${invoiceNumber}`;
    void navigator.clipboard.writeText(url);
    setCopiedInvoiceNumber(invoiceNumber);
    setTimeout(() => setCopiedInvoiceNumber(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="success" className="font-mono text-[10px] px-2 py-0.5">
            PAID
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="warning" className="font-mono text-[10px] px-2 py-0.5">
            PENDING
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="destructive" className="font-mono text-[10px] px-2 py-0.5">
            CANCELLED
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="destructive" className="font-mono text-[10px] px-2 py-0.5">
            EXPIRED
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
            DRAFT
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card telemetry="TREASURY.INVOICES" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {t("treasury.invoices.title")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("treasury.invoices.subtitle")}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeFundId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsDuesModalOpen(true)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.payNow")}</span>
                </Button>
              )}

              {canManage && activeFundId && (
                <Button
                  type="button"
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={() => setIsCustomModalOpen(true)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.createCustomBtn")}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/40 mt-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, payer, title..."
                className="w-full h-8 pl-8 pr-3 bg-muted/20 border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted-foreground text-[10px] uppercase">
                {t("treasury.invoices.filterStatus")}:
              </span>
              {(["all", "pending", "paid", "expired", "cancelled"] as const).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={statusFilter === s ? "secondary" : "outline"}
                  size="sm"
                  chamfer="dual"
                  onClick={() => setStatusFilter(s)}
                  className={`h-7 px-2 text-[10px] uppercase ${
                    statusFilter === s ? "border-primary/50 text-primary font-bold" : "text-muted-foreground"
                  }`}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {invoices === undefined ? (
            <div className="py-12 text-center text-xs text-muted-foreground animate-pulse font-mono">
              Loading invoices list...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground font-mono">
              {t("treasury.invoices.noInvoices")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/70 text-[10px] font-mono uppercase text-muted-foreground">
                    <th className="py-2.5 px-3">{t("treasury.invoices.invoiceNumber")}</th>
                    <th className="py-2.5 px-3">{t("treasury.invoices.titleCol")}</th>
                    <th className="py-2.5 px-3">{t("treasury.invoices.payer")}</th>
                    <th className="py-2.5 px-3 text-right">{t("treasury.invoices.total")}</th>
                    <th className="py-2.5 px-3">{t("treasury.invoices.status")}</th>
                    <th className="py-2.5 px-3">{t("treasury.invoices.date")}</th>
                    <th className="py-2.5 px-3 text-right">{t("treasury.invoices.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv._id}
                      className="hover:bg-muted/10 transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-semibold text-primary">
                        <Link
                          href={`/invoice/${inv.invoiceNumber}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          <span>{inv.invoiceNumber}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate text-foreground">
                        {inv.title}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {inv.payerName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-foreground">
                        {inv.currency} {inv.totalAmount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">{getStatusBadge(inv.status)}</td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            chamfer="dual"
                            title={t("treasury.invoices.copyLink")}
                            onClick={() => handleCopyLink(inv.invoiceNumber)}
                            className="h-7 w-7 p-0 flex items-center justify-center text-xs"
                          >
                            {copiedInvoiceNumber === inv.invoiceNumber ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>

                          <Button
                            asChild
                            variant="cyber"
                            size="sm"
                            chamfer="dual"
                            className="h-7 px-2 text-[11px]"
                          >
                            <Link href={`/invoice/${inv.invoiceNumber}`}>
                              {t("treasury.invoices.openInvoice")}
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {activeFundId && (
        <>
          <CreateInvoiceModal
            isOpen={isDuesModalOpen}
            onClose={() => setIsDuesModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
          />
          <CreateCustomInvoiceModal
            isOpen={isCustomModalOpen}
            onClose={() => setIsCustomModalOpen(false)}
            organizationId={organizationId}
            fundId={activeFundId}
          />
        </>
      )}
    </div>
  );
}
