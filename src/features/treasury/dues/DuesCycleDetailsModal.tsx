import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button, Input } from "@boredkevin/ui";
import { ResponsiveDialog, StatusPill } from "../../../ui";
import { useFormat } from "../../../hooks/useFormat";
import {
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Search,
  UserPlus,
  Users,
  Loader2,
  ExternalLink,
} from "lucide-react";

export interface DuesCycleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  fundId: Id<"funds">;
  duesEventId: Id<"duesEvents"> | null;
  currency?: string;
  canManage?: boolean;
  canSign?: boolean;
  onOpenRecordPayment?: (prefill: {
    userId: Id<"users">;
    duesEventId: Id<"duesEvents">;
    fundId: Id<"funds">;
  }) => void;
  onOpenCreateInvoice?: (prefill: {
    userId: Id<"users">;
    periodCount: number;
  }) => void;
  onOpenInvoiceDetails?: (invoiceId: Id<"invoices">) => void;
}

export function DuesCycleDetailsModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  duesEventId,
  currency = "IDR",
  canManage = false,
  canSign = false,
  onOpenRecordPayment,
  onOpenCreateInvoice,
  onOpenInvoiceDetails,
}: DuesCycleDetailsModalProps) {
  const { t } = useTranslation();
  const { money: formatMoney, dateTime: formatDateTime } = useFormat();

  const details = useQuery(
    api.treasury.dues.getDuesEventDetails,
    isOpen && duesEventId
      ? { organizationId, fundId, duesEventId }
      : "skip"
  );

  const syncMembersMutation = useMutation(api.treasury.dues.syncCycleMembers);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchMember, setSearchMember] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "unpaid">("all");

  const handleSyncMembers = async () => {
    if (!duesEventId) return;
    setIsSyncing(true);
    try {
      await syncMembersMutation({
        organizationId,
        fundId,
        duesEventId,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sync members.");
    } finally {
      setIsSyncing(false);
    }
  };

  const members = details?.members;
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m) => {
      if (filterStatus === "paid" && !m.hasPaid) return false;
      if (filterStatus === "unpaid" && m.hasPaid) return false;

      if (!searchMember.trim()) return true;
      const q = searchMember.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        (m.nickname && m.nickname.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    });
  }, [members, searchMember, filterStatus]);

  if (!isOpen || !duesEventId) return null;

  const event = details?.event;
  const stats = details?.stats;

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={event ? `${t("treasury.dues.cycleDetailsModalTitle", "Cycle Details")}: ${event.periodLabel}` : "Cycle Details"}
      description={event ? `Due date: ${formatDateTime(event.dueDate)}` : ""}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {/* Top Summary Cards */}
        {details ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-card border border-border rounded-[var(--fintech-radius-sm)]">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                {t("treasury.dues.amountPerMember", "Rate / Member")}
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {formatMoney(event?.amount ?? 0, currency)}
              </span>
            </div>

            <div className="p-3 bg-card border border-border rounded-[var(--fintech-radius-sm)]">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Collection Ratio
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {event?.paidCount} / {event?.totalMembers}
                </span>
                <span className="text-xs text-muted-foreground">({stats?.collectionRate}%)</span>
              </div>
            </div>

            <div className="p-3 bg-card border border-border rounded-[var(--fintech-radius-sm)]">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Total Collected
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {formatMoney(stats?.totalCollectedAmount ?? 0, currency)}
              </span>
            </div>

            <div className="p-3 bg-card border border-border rounded-[var(--fintech-radius-sm)]">
              <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                Target Potential
              </span>
              <span className="text-sm font-bold text-foreground font-mono">
                {formatMoney(stats?.totalExpectedAmount ?? 0, currency)}
              </span>
            </div>
          </div>
        ) : (
          <div className="h-20 bg-card animate-pulse rounded-[var(--fintech-radius-sm)]" />
        )}

        {/* Member Roster Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-semibold text-foreground">
              Member Payment Roster ({details?.members.length ?? 0})
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                onClick={() => void handleSyncMembers()}
                disabled={isSyncing}
                className="h-7 text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                title="Ensure all active organization members are assigned to this cycle"
              >
                {isSyncing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <UserPlus className="w-3 h-3 text-primary" />
                )}
                <span>Sync Active Roster</span>
              </Button>
            )}

            <div className="flex items-center border border-border rounded-[var(--fintech-radius-sm)] bg-card overflow-hidden h-7">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`px-2 text-[11px] font-mono cursor-pointer transition-colors ${
                  filterStatus === "all" ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("paid")}
                className={`px-2 text-[11px] font-mono border-l border-border cursor-pointer transition-colors ${
                  filterStatus === "paid" ? "bg-emerald-500/20 text-emerald-400 font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("unpaid")}
                className={`px-2 text-[11px] font-mono border-l border-border cursor-pointer transition-colors ${
                  filterStatus === "unpaid" ? "bg-amber-500/20 text-amber-400 font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search member in this cycle..."
            value={searchMember}
            onChange={(e) => setSearchMember(e.target.value)}
            chamfer="none"
            className="pl-8 h-8 text-xs font-sans w-full"
          />
        </div>

        {/* Member Rows Table / Feed */}
        <div className="border border-border rounded-[var(--fintech-radius-sm)] overflow-hidden max-h-80 overflow-y-auto divide-y divide-border/40 bg-card/40">
          {filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No members matching filter.
            </div>
          ) : (
            filteredMembers.map((m) => {
              const hasPaid = m.hasPaid;
              return (
                <div
                  key={m._id}
                  className="p-2.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                        hasPaid
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {hasPaid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {m.nickname || m.name}
                        </span>
                        {m.nickname && (
                          <span className="text-[11px] text-muted-foreground truncate">
                            ({m.name})
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono truncate">
                        {hasPaid
                          ? m.isWaived
                            ? "Waived obligation"
                            : `Paid ${m.paidAt ? formatDateTime(m.paidAt) : ""}`
                          : "Outstanding balance"}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill tone={hasPaid ? "success" : "warning"} dot>
                      {hasPaid ? (m.isWaived ? "WAIVED" : "PAID") : "UNPAID"}
                    </StatusPill>

                    {!hasPaid && (
                      <div className="flex items-center gap-1">
                        {onOpenCreateInvoice && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            chamfer="none"
                            onClick={() => {
                              onClose();
                              onOpenCreateInvoice({
                                userId: m.userId,
                                periodCount: 1,
                              });
                            }}
                            className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                            title="Generate payment invoice link"
                          >
                            <CreditCard className="w-3 h-3 text-primary" />
                            <span className="hidden sm:inline">Invoice</span>
                          </Button>
                        )}

                        {canSign && onOpenRecordPayment && (
                          <Button
                            type="button"
                            variant="cyber"
                            size="sm"
                            chamfer="none"
                            onClick={() => {
                              onClose();
                              onOpenRecordPayment({
                                userId: m.userId,
                                duesEventId,
                                fundId,
                              });
                            }}
                            className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1 font-semibold"
                            title="Record manual cash payment"
                          >
                            <Coins className="w-3 h-3" />
                            <span className="hidden sm:inline">Pay</span>
                          </Button>
                        )}
                      </div>
                    )}

                    {m.invoiceId && onOpenInvoiceDetails && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenInvoiceDetails(m.invoiceId!);
                        }}
                        className="text-[10px] text-primary hover:underline flex items-center gap-0.5 cursor-pointer font-mono"
                      >
                        <span>Inv</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-border/60 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            chamfer="none"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            {t("common.close", "Close")}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
