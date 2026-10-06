import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id, Doc } from "../../../../convex/_generated/dataModel";
import { StatCard } from "../../../ui/StatCard";
import { EmptyState } from "../../../ui/EmptyState";
import { ResponsiveDialog } from "../../../ui/ResponsiveDialog";
import { ConfirmDialog } from "../../../ui/ConfirmDialog";
import { Button } from "@boredkevin/ui";
import {
  CheckCircle2,
  CreditCard,
  ArrowRight,
  Landmark,
  Download,
  Users,
  CalendarPlus,
} from "lucide-react";
import { useFormat } from "../../../hooks/useFormat";
import { DuesMemberItem, DuesEventItem, DuesCellItem } from "../types/dues";
import { MemberDuesList } from "./MemberDuesList";
import { MemberDuesSheet } from "./MemberDuesSheet";
// Note: DuesGrid is temporarily disabled per user request
// import { DuesGrid } from "./DuesGrid";
import { ExportDuesModal } from "./ExportDuesModal";
import { CreateInvoiceModal } from "../components/CreateInvoiceModal";
import { InvoiceDetailsModal } from "../invoices/InvoiceDetailsModal";
import { EditInvoiceModal } from "../invoices/EditInvoiceModal";

interface DuesSpreadsheetPaneProps {
  organizationId: Id<"organizations">;
  organizationName?: string;
  fundId: Id<"funds"> | null;
  fundName?: string;
  currency?: string;
  onOpenRecordPayment: (prefill?: {
    userId?: Id<"users">;
    duesEventId?: Id<"duesEvents">;
    periodCount?: number;
    fundId?: Id<"funds">;
  }) => void;
  onOpenEntryDetails?: (entryId: Id<"ledgerEntries">) => void;
  onOpenAdminTab?: () => void;
  onOpenCreateDues?: () => void;
  onOpenBulkDues?: () => void;
}

export function DuesSpreadsheetPane({
  organizationId,
  organizationName,
  fundId,
  fundName,
  currency = "IDR",
  onOpenRecordPayment,
  onOpenEntryDetails,
  onOpenAdminTab,
  onOpenCreateDues,
  onOpenBulkDues,
}: DuesSpreadsheetPaneProps) {
  const { t } = useTranslation();
  const { money: formatMoney } = useFormat();

  // Grid view is temporarily disabled per user request, defaulting to list/members view
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedMemberForSheet, setSelectedMemberForSheet] = useState<DuesMemberItem | null>(null);

  // Invoice CRUD integration state
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoicePrefillUserId, setInvoicePrefillUserId] = useState<Id<"users"> | undefined>(undefined);
  const [invoicePrefillPeriodCount, setInvoicePrefillPeriodCount] = useState<number | undefined>(undefined);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<Id<"invoices"> | null>(null);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<Doc<"invoices"> | null>(null);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Doc<"invoices"> | null>(null);
  const [isCancellingInvoice, setIsCancellingInvoice] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Unpaid cell action target
  const [unpaidCellActionTarget, setUnpaidCellActionTarget] = useState<{
    member: DuesMemberItem;
    event: DuesEventItem;
  } | null>(null);

  const spreadsheet = useQuery(
    api.treasury.dues.getDuesSpreadsheet,
    organizationId && fundId
      ? {
          organizationId,
          fundId,
        }
      : "skip"
  );

  const duesSummary = useQuery(
    api.treasury.dues.getDuesSummary,
    organizationId && fundId
      ? {
          organizationId,
          fundId,
        }
      : "skip"
  );

  const myMembership = useQuery(api.members.getMyMembership, {
    organizationId,
  });

  const canManage = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  const selectedInvoice = useQuery(
    api.treasury.borderpay.getInvoiceById,
    selectedInvoiceId ? { invoiceId: selectedInvoiceId } : "skip"
  );

  const cancelInvoice = useMutation(api.treasury.borderpay.cancelInvoice);

  const handleConfirmCancel = async () => {
    if (!invoiceToCancel) return;
    setIsCancellingInvoice(true);
    setCancelError(null);
    try {
      await cancelInvoice({ invoiceNumber: invoiceToCancel.invoiceNumber });
      setInvoiceToCancel(null);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel invoice");
    } finally {
      setIsCancellingInvoice(false);
    }
  };

  // Cell lookup map
  const cellMap = useMemo(() => {
    const map = new Map<string, DuesCellItem>();
    if (spreadsheet?.cells) {
      for (const cell of spreadsheet.cells) {
        map.set(`${cell.memberId}_${cell.duesEventId}`, cell);
      }
    }
    return map;
  }, [spreadsheet]);

  if (!fundId) {
    return (
      <EmptyState
        icon={<Landmark className="w-8 h-8" />}
        title={t("treasury.funds.noFundSelected", "No Fund Selected")}
        description={t(
          "treasury.funds.selectFundPrompt",
          "Please select or create a fund account to view member dues."
        )}
      />
    );
  }

  if (spreadsheet === undefined || duesSummary === undefined) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-24 bg-card/60 rounded-[var(--fintech-radius-md)] border border-border" />
          <div className="h-24 bg-card/60 rounded-[var(--fintech-radius-md)] border border-border" />
        </div>
        <div className="h-96 bg-card/60 rounded-[var(--fintech-radius-md)] border border-border" />
      </div>
    );
  }

  const events: DuesEventItem[] = spreadsheet.events;
  const members: DuesMemberItem[] = spreadsheet.members;

  return (
    <div className="space-y-5">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard
          label={t("treasury.dues.scheduleConfig", "Recurring Schedule")}
          value={
            duesSummary.config?.isEnabled
              ? duesSummary.config.intervalType === "weekly"
                ? "Weekly Dues"
                : duesSummary.config.intervalType === "monthly"
                ? "Monthly Dues"
                : `Every ${duesSummary.config.intervalValue}d`
              : "Schedule Paused"
          }
          hint={
            <div className="flex items-center justify-between">
              <span>
                {duesSummary.config
                  ? `${formatMoney(duesSummary.config.amount, currency)} / member`
                  : "No active schedule"}
              </span>
              {canManage && onOpenAdminTab && (
                <button
                  type="button"
                  onClick={onOpenAdminTab}
                  className="text-xs text-primary hover:underline cursor-pointer font-medium ml-2"
                >
                  {t("treasury.admin.configure", "Configure")}
                </button>
              )}
            </div>
          }
        />

        <StatCard
          label={t("treasury.overview.outstandingDuesTitle", "Outstanding Members")}
          value={`${duesSummary.totalUnpaidMemberships}`}
          hint={`Across ${duesSummary.totalEvents} recorded cycles`}
        />
      </div>

      {/* Header with Title and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {t("treasury.dues.title", "Member Dues")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("treasury.dues.description", "Track and manage dues collection for this fund.")}
          </p>
        </div>

        {/* Action buttons (Grid view is disabled for now) */}
        <div className="flex items-center gap-2">
          {fundName && (
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              size="sm"
              onClick={() => setIsExportModalOpen(true)}
              disabled={events.length === 0}
              className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
              title="Export dues to PDF or JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("treasury.dues.export", "Export")}</span>
            </Button>
          )}

          {canSign && onOpenBulkDues && (
            <Button
              type="button"
              variant="cyber"
              chamfer="none"
              size="sm"
              onClick={onOpenBulkDues}
              className="h-8 text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
              title="Record dues payments for multiple members in batch"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bulk Entry</span>
            </Button>
          )}

          {canManage && onOpenCreateDues && (
            <Button
              type="button"
              variant="outline"
              chamfer="none"
              size="sm"
              onClick={onOpenCreateDues}
              className="h-8 text-xs flex items-center gap-1.5 cursor-pointer"
              title={t("treasury.dues.manualCreateCycle", "Create Cycle")}
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t("treasury.dues.manualCreateCycle", "Create Cycle")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main View Area: Member List (Grid view disabled for now) */}
      <MemberDuesList
        members={members}
        events={events}
        cellMap={cellMap}
        currency={currency}
        canManage={canManage}
        onSelectMember={(member) => setSelectedMemberForSheet(member)}
        onOpenCreateInvoice={(prefill) => {
          setInvoicePrefillUserId(prefill.userId);
          setInvoicePrefillPeriodCount(prefill.periodCount);
          setIsInvoiceModalOpen(true);
        }}
      />

      {/* Member Dues Sheet */}
      <MemberDuesSheet
        isOpen={Boolean(selectedMemberForSheet)}
        onClose={() => setSelectedMemberForSheet(null)}
        member={selectedMemberForSheet}
        events={events}
        cellMap={cellMap}
        currency={currency}
        canManage={canManage}
        canSign={canSign}
        fundId={fundId}
        onOpenCreateInvoice={(prefill) => {
          setInvoicePrefillUserId(prefill.userId);
          setInvoicePrefillPeriodCount(prefill.periodCount);
          setIsInvoiceModalOpen(true);
        }}
        onOpenRecordPayment={(prefill) => {
          onOpenRecordPayment(prefill);
        }}
        onOpenEntryDetails={onOpenEntryDetails}
        onOpenInvoiceDetails={(invId) => setSelectedInvoiceId(invId)}
      />

      {/* Export Dues Modal */}
      {fundName && (
        <ExportDuesModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          fundName={fundName}
          organizationName={organizationName}
          currency={currency}
          events={events}
          members={members}
          cellMap={cellMap}
          summary={
            duesSummary
              ? {
                  totalUnpaidMemberships: duesSummary.totalUnpaidMemberships,
                  totalEvents: duesSummary.totalEvents,
                  config: duesSummary.config,
                }
              : undefined
          }
        />
      )}

      {/* Create Dues Invoice Modal */}
      {fundId && (
        <CreateInvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setInvoicePrefillUserId(undefined);
            setInvoicePrefillPeriodCount(undefined);
          }}
          organizationId={organizationId}
          fundId={fundId}
          targetUserId={invoicePrefillUserId}
          prefillPeriodCount={invoicePrefillPeriodCount}
          initialMode="admin"
        />
      )}

      {/* Invoice Details Modal */}
      <InvoiceDetailsModal
        isOpen={Boolean(selectedInvoiceId && selectedInvoice)}
        onClose={() => setSelectedInvoiceId(null)}
        invoice={selectedInvoice || null}
        canManage={canManage}
        onEdit={(inv) => {
          setSelectedInvoiceId(null);
          setSelectedInvoiceForEdit(inv);
        }}
        onCancel={(inv) => {
          setSelectedInvoiceId(null);
          setInvoiceToCancel(inv);
        }}
      />

      {/* Edit Invoice Modal */}
      <EditInvoiceModal
        isOpen={Boolean(selectedInvoiceForEdit)}
        onClose={() => setSelectedInvoiceForEdit(null)}
        invoice={selectedInvoiceForEdit}
      />

      {/* Cancel Invoice ConfirmDialog */}
      <ConfirmDialog
        isOpen={Boolean(invoiceToCancel)}
        onClose={() => {
          setInvoiceToCancel(null);
          setCancelError(null);
        }}
        onConfirm={handleConfirmCancel}
        title={t("treasury.invoices.cancelConfirmTitle", "Cancel Invoice")}
        description={
          invoiceToCancel
            ? t(
                "treasury.invoices.cancelConfirmDesc",
                `Are you sure you want to cancel invoice ${invoiceToCancel.invoiceNumber}? Reserved dues cycles will be released.`,
                { number: invoiceToCancel.invoiceNumber }
              )
            : ""
        }
        confirmText={
          isCancellingInvoice
            ? t("treasury.invoices.cancelling", "Cancelling...")
            : t("treasury.invoices.confirmCancel", "Yes, Cancel Invoice")
        }
        variant="danger"
        error={cancelError}
        isLoading={isCancellingInvoice}
      />

      {/* Unpaid Cell Action Selection ResponsiveDialog */}
      <ResponsiveDialog
        isOpen={Boolean(unpaidCellActionTarget)}
        onClose={() => setUnpaidCellActionTarget(null)}
        title={
          unpaidCellActionTarget
            ? `Dues Action: ${unpaidCellActionTarget.member.nickname || unpaidCellActionTarget.member.name}`
            : "Dues Action"
        }
        description={
          unpaidCellActionTarget
            ? `${unpaidCellActionTarget.event.periodLabel} · ${formatMoney(unpaidCellActionTarget.event.amount, currency)}`
            : undefined
        }
        maxWidth="sm"
      >
        <div className="space-y-3 pt-1">
          {/* Option 1: Create Online Dues Invoice */}
          <button
            type="button"
            onClick={() => {
              const target = unpaidCellActionTarget;
              setUnpaidCellActionTarget(null);
              if (target) {
                setInvoicePrefillUserId(target.member.userId);
                setInvoicePrefillPeriodCount(1);
                setIsInvoiceModalOpen(true);
              }
            }}
            className="w-full p-3.5 bg-card hover:bg-muted/30 border border-primary/30 hover:border-primary rounded-[var(--fintech-radius-md)] text-left transition-all flex items-start justify-between gap-3 cursor-pointer group"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {t("treasury.invoices.actionCreateInvoice", "Create Online Dues Invoice")}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {t(
                  "treasury.invoices.actionCreateInvoiceDesc",
                  "Generate a shareable QRIS or Virtual Account invoice link for this cycle."
                )}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </button>

          {/* Option 2: Record Manual Cash Payment */}
          {canSign && (
            <button
              type="button"
              onClick={() => {
                const target = unpaidCellActionTarget;
                setUnpaidCellActionTarget(null);
                if (target) {
                  onOpenRecordPayment({
                    userId: target.member.userId,
                    duesEventId: target.event._id,
                    periodCount: 1,
                    fundId: fundId ?? undefined,
                  });
                }
              }}
              className="w-full p-3.5 bg-card hover:bg-muted/30 border border-emerald-500/30 hover:border-emerald-500 rounded-[var(--fintech-radius-md)] text-left transition-all flex items-start justify-between gap-3 cursor-pointer group"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                    {t("treasury.invoices.actionRecordManual", "Record Manual Cash Payment")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t(
                    "treasury.invoices.actionRecordManualDesc",
                    "Sign and commit cash or bank transfer credit directly to the ledger."
                  )}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
            </button>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              chamfer="none"
              onClick={() => setUnpaidCellActionTarget(null)}
              className="text-xs cursor-pointer"
            >
              {t("common.cancel", "Cancel")}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </div>
  );
}
