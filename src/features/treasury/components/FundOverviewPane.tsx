import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Panel } from "../../../ui/Panel";
import { EmptyState } from "../../../ui/EmptyState";
import { Button } from "@boredkevin/ui";
import {
  ScrollText,
  ArrowRight,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import { LedgerTimeline } from "./LedgerTimeline";
import { CreateInvoiceModal } from "./CreateInvoiceModal";
import { UnifiedMobileFinancialHero } from "./UnifiedMobileFinancialHero";

interface FundOverviewPaneProps {
  fundId: Id<"funds"> | null;
  organizationId: Id<"organizations">;
  funds?: Array<{
    _id: Id<"funds">;
    name: string;
    currency: string;
    isArchived?: boolean;
  }>;
  onSelectFund?: (fundId: Id<"funds">) => void;
  onNavigateToLedger: () => void;
  onOpenRecordPayment: () => void;
  onOpenKeyGen?: () => void;
  onOpenCreateFund?: () => void;
}

export function FundOverviewPane({
  fundId,
  organizationId,
  funds,
  onSelectFund,
  onNavigateToLedger,
  onOpenRecordPayment,
  onOpenKeyGen,
  onOpenCreateFund,
}: FundOverviewPaneProps) {
  const { t } = useTranslation();
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const fund = useQuery(
    api.treasury.funds.get,
    fundId ? { fundId } : "skip"
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    organizationId ? { organizationId } : "skip"
  );

  const myUnpaidPeriods = useQuery(
    api.treasury.dues.getMemberUnpaidPeriods,
    organizationId && fundId && myMembership?.userId
      ? { organizationId, fundId, userId: myMembership.userId }
      : "skip"
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  const canAdmin = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_TREASURY")
  );

  if (!fundId) {
    return (
      <EmptyState
        icon={<Wallet className="w-8 h-8" />}
        title={t("treasury.sidebar.noFundsFound", "No Fund Selected")}
        description={t("treasury.overview.description", "Select or create a fund to view its treasury overview.")}
      />
    );
  }

  const isFrozen = Boolean(fund?.isFrozen);

  return (
    <div className="space-y-6">
      {/* Critical Tamper Alert Banner */}
      {isFrozen && (
        <Panel className="bg-destructive/10 border-destructive/50 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-destructive/20 border border-destructive/40 text-destructive-foreground rounded-[var(--fintech-radius-sm)]">
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-400">
                Ledger Tamper Detected
              </h3>
              <p className="text-xs text-rose-300/80">
                Cryptographic verification failed during ledger replay. Balance updates and new entries are locked.
              </p>
            </div>
          </div>
          <div className="p-3 bg-black/40 border border-destructive/30 rounded-[var(--fintech-radius-sm)] text-xs text-rose-300 font-mono leading-relaxed">
            {fund?.integrityError || "Hash mismatch or chain linkage broken in ledger history."}
          </div>
        </Panel>
      )}

      {/* 1. Unified Financial Hero Card */}
      <UnifiedMobileFinancialHero
        fund={fund}
        funds={funds}
        activeFundId={fundId}
        onSelectFund={onSelectFund ?? (() => {})}
        unpaidPeriods={myUnpaidPeriods}
        canSign={canSign}
        canAdmin={canAdmin}
        onOpenPayDues={() => setIsCreateInvoiceOpen(true)}
        onOpenRecordPayment={onOpenRecordPayment}
        onOpenCreateFund={onOpenCreateFund}
      />

      {/* 2. Recent Activity Panel */}
      <Panel className="p-0 overflow-hidden">
        <div className="py-3 px-4 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-primary/10 border border-primary/20 text-primary rounded-[var(--fintech-radius-sm)]">
              <ScrollText className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("treasury.overview.recentActivity", "Recent Activity")}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            chamfer="none"
            onClick={onNavigateToLedger}
            className="h-7 text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium px-2"
          >
            <span>{t("treasury.overview.viewFullLedger", "Buku Kas Lengkap")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="p-2 sm:p-3">
          <LedgerTimeline
            fundId={fundId}
            organizationId={organizationId}
            limit={5}
            variant="compact"
            showPagination={false}
            onOpenRecordPayment={onOpenRecordPayment}
            onOpenKeyGen={onOpenKeyGen}
            emptyMessage="No ledger entries recorded for this fund yet."
          />
        </div>
      </Panel>

      {fundId && (
        <CreateInvoiceModal
          isOpen={isCreateInvoiceOpen}
          onClose={() => setIsCreateInvoiceOpen(false)}
          organizationId={organizationId}
          fundId={fundId}
        />
      )}
    </div>
  );
}
