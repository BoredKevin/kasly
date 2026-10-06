import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import { DuesMemberItem, DuesEventItem, DuesCellItem } from "../types/dues";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import { StatusPill } from "../../../ui/StatusPill";
import { Button } from "@boredkevin/ui";
import {
  CheckCircle2,
  Receipt,
  ExternalLink,
} from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";

interface MemberDuesSheetProps {
  isOpen: boolean;
  onClose: () => void;
  member: DuesMemberItem | null;
  events: DuesEventItem[];
  cellMap: Map<string, DuesCellItem>;
  currency?: string;
  canManage?: boolean;
  canSign?: boolean;
  fundId?: Id<"funds"> | null;
  onOpenCreateInvoice?: (prefill: { userId: Id<"users">; periodCount: number }) => void;
  onOpenRecordPayment?: (prefill: {
    userId: Id<"users">;
    duesEventId?: Id<"duesEvents">;
    periodCount: number;
    fundId?: Id<"funds">;
  }) => void;
  onOpenEntryDetails?: (entryId: Id<"ledgerEntries">) => void;
  onOpenInvoiceDetails?: (invoiceId: Id<"invoices">) => void;
}

export function MemberDuesSheet({
  isOpen,
  onClose,
  member,
  events,
  cellMap,
  currency = "IDR",
  canManage = false,
  canSign = false,
  fundId,
  onOpenCreateInvoice,
  onOpenRecordPayment,
  onOpenEntryDetails,
  onOpenInvoiceDetails,
}: MemberDuesSheetProps) {
  const { t } = useTranslation();
  const { money: formatMoney, date: formatDate } = useFormat();

  // Resolved list of events with member's cell status
  const memberEvents = useMemo(() => {
    if (!member) return [];
    return events.map((event) => {
      const cell = cellMap.get(`${member._id}_${event._id}`);
      return {
        event,
        cell,
        isPaid: Boolean(cell?.hasPaid),
        isWaived: Boolean(cell?.isWaived),
        isInvoiced: Boolean(cell?.invoiceId && !cell?.hasPaid),
        isUnpaid: Boolean(!cell?.hasPaid && !cell?.isWaived && !cell?.invoiceId),
      };
    });
  }, [member, events, cellMap]);

  const unpaidItems = useMemo(
    () => memberEvents.filter((item) => item.isUnpaid || item.isInvoiced),
    [memberEvents]
  );

  const totalOwed = useMemo(
    () => unpaidItems.reduce((acc, curr) => acc + curr.event.amount, 0),
    [unpaidItems]
  );

  if (!member) return null;

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={member.nickname || member.name}
      description={member.nickname ? member.name : member.email || t("organization.member")}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Member Profile & Status Header */}
        <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-md)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
              {member.image ? (
                <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                <span>{(member.nickname || member.name).charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">
                {member.nickname || member.name}
              </p>
              {member.email && (
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              )}
            </div>
          </div>

          <div>
            {member.unpaidPeriodsCount > 0 ? (
              <StatusPill tone="warning">
                {member.unpaidPeriodsCount}{" "}
                {t("treasury.dues.unpaid", "unpaid").toLowerCase()}
              </StatusPill>
            ) : (
              <StatusPill tone="success">
                {t("treasury.dues.paid", "Paid up")}
              </StatusPill>
            )}
          </div>
        </div>

        {/* Quick Outstanding Summary */}
        {member.unpaidPeriodsCount > 0 && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-[var(--fintech-radius-md)] flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-amber-300 font-medium">
                {t("treasury.overview.outstandingDuesTitle", "Outstanding Dues")}
              </p>
              <p className="text-lg font-bold text-foreground font-mono">
                {formatMoney(totalOwed, currency)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {member.unpaidPeriodsCount} {t("treasury.dues.unpaid", "cycle(s) due")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
              {canManage && onOpenCreateInvoice && (
                <Button
                  type="button"
                  variant="cyber"
                  chamfer="none"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenCreateInvoice({
                      userId: member.userId,
                      periodCount: member.unpaidPeriodsCount,
                    });
                  }}
                  className="h-8 text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{t("treasury.invoices.createDuesBtn", "Invoice All")}</span>
                </Button>
              )}

              {canSign && onOpenRecordPayment && (
                <Button
                  type="button"
                  variant="outline"
                  chamfer="none"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenRecordPayment({
                      userId: member.userId,
                      periodCount: member.unpaidPeriodsCount,
                      fundId: fundId ?? undefined,
                    });
                  }}
                  className="h-8 text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t("treasury.invoices.actionRecordManual", "Record Cash")}</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Cycles Timeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("treasury.dues.timelineTitle", "Dues Cycles")} ({memberEvents.length})
          </h4>

          {memberEvents.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {t("treasury.dues.noCycles", "No recorded dues cycles for this fund.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/80 rounded-[var(--fintech-radius-md)] overflow-hidden max-h-[360px] overflow-y-auto">
              {memberEvents.map(({ event, cell, isPaid, isWaived, isInvoiced, isUnpaid }) => (
                <div
                  key={event._id}
                  className="p-3 bg-card/60 hover:bg-card/90 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">
                        {event.periodLabel}
                      </span>
                      {isPaid && (
                        <StatusPill tone="success">
                          {isWaived
                            ? t("treasury.dues.waived", "Waived")
                            : t("treasury.dues.paid", "Paid")}
                        </StatusPill>
                      )}
                      {isInvoiced && (
                        <StatusPill tone="warning">
                          {t("treasury.invoices.cellInvoiced", "Invoiced")}
                        </StatusPill>
                      )}
                      {isUnpaid && (
                        <StatusPill tone="danger">
                          {t("treasury.dues.unpaid", "Unpaid")}
                        </StatusPill>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{formatMoney(event.amount, currency)}</span>
                      <span>·</span>
                      <span>Due {formatDate(event.dueDate)}</span>
                      {cell?.paidAt && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400/90 font-mono">
                            Paid {formatDate(cell.paidAt)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions per cycle */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPaid && cell?.ledgerEntryId && onOpenEntryDetails && (
                      <Button
                        type="button"
                        variant="ghost"
                        chamfer="none"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onOpenEntryDetails(cell.ledgerEntryId!);
                        }}
                        className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
                        title="View Ledger Proof"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="hidden sm:inline">Proof</span>
                      </Button>
                    )}

                    {isInvoiced && cell?.invoiceId && onOpenInvoiceDetails && (
                      <Button
                        type="button"
                        variant="outline"
                        chamfer="none"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onOpenInvoiceDetails(cell.invoiceId!);
                        }}
                        className="h-7 text-xs px-2 text-amber-300 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer flex items-center gap-1"
                      >
                        <Receipt className="w-3 h-3" />
                        <span>Invoice</span>
                      </Button>
                    )}

                    {isUnpaid && (
                      <div className="flex items-center gap-1">
                        {canManage && onOpenCreateInvoice && (
                          <Button
                            type="button"
                            variant="cyber"
                            chamfer="none"
                            size="sm"
                            onClick={() => {
                              onClose();
                              onOpenCreateInvoice({
                                userId: member.userId,
                                periodCount: 1,
                              });
                            }}
                            className="h-7 text-xs px-2 cursor-pointer flex items-center gap-1"
                            title="Generate Invoice Link"
                          >
                            <Receipt className="w-3 h-3" />
                            <span className="hidden sm:inline">Invoice</span>
                          </Button>
                        )}

                        {canSign && onOpenRecordPayment && (
                          <Button
                            type="button"
                            variant="outline"
                            chamfer="none"
                            size="sm"
                            onClick={() => {
                              onClose();
                              onOpenRecordPayment({
                                userId: member.userId,
                                duesEventId: event._id,
                                periodCount: 1,
                                fundId: fundId ?? undefined,
                              });
                            }}
                            className="h-7 text-xs px-2 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1"
                            title="Record Cash Payment"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Pay</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
