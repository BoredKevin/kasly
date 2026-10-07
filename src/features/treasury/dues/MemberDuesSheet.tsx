import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Id } from "../../../../convex/_generated/dataModel";
import { DuesMemberItem, DuesEventItem, DuesCellItem } from "../types/dues";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import { StatusPill } from "../../../ui/StatusPill";
import { Button, Avatar, AvatarImage, AvatarFallback } from "@boredkevin/ui";
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
      title={t("treasury.dues.memberSheetTitle", "Detail Iuran Anggota")}
      description={t(
        "treasury.dues.memberSheetSubtitle",
        "Status kewajiban kas dan riwayat pembayaran anggota."
      )}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Member Profile & Status Card */}
        <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-md)]">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="w-10 h-10 border border-primary/25 shrink-0">
              {member.image && (
                <AvatarImage src={member.image} alt={member.name} className="object-cover" />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {(member.nickname || member.name).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-sm text-foreground truncate">
                {member.nickname || member.name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {member.nickname ? `${member.name} • ${member.email || ""}` : member.email || ""}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {member.unpaidPeriodsCount > 0 ? (
              <StatusPill tone="warning" className="text-xs font-semibold">
                {t("treasury.dues.unpaidCount", {
                  count: member.unpaidPeriodsCount,
                  defaultValue: `${member.unpaidPeriodsCount} Belum Lunas`,
                })}
              </StatusPill>
            ) : (
              <StatusPill tone="success" className="text-xs font-semibold">
                ✓ {t("treasury.dues.paid", "LUNAS")}
              </StatusPill>
            )}
          </div>
        </div>

        {/* Quick Outstanding Summary Card */}
        {member.unpaidPeriodsCount > 0 && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-[var(--fintech-radius-md)] space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs text-amber-300 font-medium tracking-wide">
                  {t("treasury.dues.totalOutstanding", "Total Tunggakan")}
                </span>
                <p className="text-xl sm:text-2xl font-bold text-foreground font-mono tabular-nums whitespace-nowrap mt-0.5">
                  {formatMoney(totalOwed, currency)}
                </p>
              </div>

              <StatusPill tone="warning" className="text-xs font-medium shrink-0">
                {t("treasury.overview.unpaidDues", {
                  count: member.unpaidPeriodsCount,
                  defaultValue: `${member.unpaidPeriodsCount} periode belum lunas`,
                })}
              </StatusPill>
            </div>

            {(canManage || canSign) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 border-t border-amber-500/20">
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
                    className="h-8.5 text-xs font-medium cursor-pointer w-full justify-center flex items-center gap-1.5"
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {t("treasury.dues.createInvoiceBtn", "Buat Faktur Tunggakan")}
                    </span>
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
                    className="h-8.5 text-xs font-medium cursor-pointer w-full justify-center flex items-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {t("treasury.dues.recordCashBtn", "Catat Bayar Tunai")}
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cycles Timeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t("treasury.dues.timelineTitle", "Siklus Iuran")} ({memberEvents.length})
          </h4>

          {memberEvents.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              {t("treasury.dues.noCycles", "Belum ada siklus penarikan iuran untuk kas ini.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60 border border-border/80 rounded-[var(--fintech-radius-md)] overflow-y-auto overflow-x-hidden max-h-[360px]">
              {memberEvents.map(({ event, cell, isPaid, isWaived, isInvoiced, isUnpaid }) => (
                <div
                  key={event._id}
                  className="p-3 bg-card/60 hover:bg-card/90 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground truncate">
                        {event.periodLabel}
                      </span>
                      {isPaid && (
                        <StatusPill tone="success" className="text-[10px] py-0 px-1.5">
                          {isWaived
                            ? t("treasury.dues.waived", "DIBEBASKAN")
                            : t("treasury.dues.paid", "LUNAS")}
                        </StatusPill>
                      )}
                      {isInvoiced && (
                        <StatusPill tone="warning" className="text-[10px] py-0 px-1.5">
                          {t("treasury.invoices.cellInvoiced", "Faktur Dibuat")}
                        </StatusPill>
                      )}
                      {isUnpaid && (
                        <StatusPill tone="danger" className="text-[10px] py-0 px-1.5">
                          {t("treasury.dues.unpaid", "BELUM LUNAS")}
                        </StatusPill>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span className="font-mono tabular-nums">{formatMoney(event.amount, currency)}</span>
                      <span>·</span>
                      <span>
                        {t("treasury.overview.due", "Jatuh Tempo")} {formatDate(event.dueDate)}
                      </span>
                      {cell?.paidAt && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400/90 font-mono">
                            {t("treasury.dues.paidAt", "Dibayar")} {formatDate(cell.paidAt)}
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
                        title={t("treasury.dues.viewProofTitle", "Lihat Bukti Transaksi")}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="hidden sm:inline">
                          {t("treasury.dues.viewProof", "Bukti")}
                        </span>
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
                        title={t("treasury.invoices.openInvoice", "Buka Faktur")}
                      >
                        <Receipt className="w-3 h-3" />
                        <span>{t("treasury.dues.cycleInvoice", "Faktur")}</span>
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
                            title={t("treasury.dues.cycleInvoiceTitle", "Buat Faktur Siklus Ini")}
                          >
                            <Receipt className="w-3 h-3" />
                            <span className="hidden sm:inline">
                              {t("treasury.dues.cycleInvoice", "Faktur")}
                            </span>
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
                            title={t("treasury.dues.cyclePayTitle", "Catat Bayar Tunai Siklus Ini")}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="hidden sm:inline">
                              {t("treasury.dues.cyclePay", "Bayar")}
                            </span>
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
