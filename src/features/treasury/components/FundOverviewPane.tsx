import { useState } from "react";
import { useQuery } from "convex/react";
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
} from "@boredkevin/ui";
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
      <Card telemetry="TREASURY.NO_FUND" cornerLines className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <div className="inline-flex p-3 bg-muted/40 border border-border/60 text-muted-foreground rounded-full">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground">{t("treasury.sidebar.noFundsFound")}</p>
            <p className="text-xs text-muted-foreground">
              {t("treasury.overview.description")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isFrozen = Boolean(fund?.isFrozen);

  return (
    <div className="space-y-6">
      {/* Critical Tamper Alert Banner */}
      {isFrozen && (
        <Card telemetry="TREASURY.INTEGRITY_ALERT" cornerLines className="bg-destructive/10 border-destructive/50 shadow-xl animate-in fade-in duration-200">
          <CardHeader className="pb-3 border-b border-destructive/30">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-destructive/20 border border-destructive/40 text-destructive-foreground">
                <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-red-400">
                  Ledger Tamper Detected
                </CardTitle>
                <CardDescription className="text-xs text-red-300/80">
                  Cryptographic verification failed during ledger replay. Balance updates and new entries are locked.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-3 font-mono text-xs text-red-300 break-words space-y-2">
            <p className="font-bold uppercase tracking-wider text-[10px] text-red-400">
              Integrity Diagnostic Log
            </p>
            <p className="p-2.5 bg-black/40 border border-destructive/30 leading-relaxed">
              {fund?.integrityError || "Hash mismatch or chain linkage broken in ledger history."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 1. Unified Financial Hero Card (Dues Hero + Compact Saldo Kas) */}
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

      {/* 2. Flat & Clean Recent Activity Card (Compact Ledger Feed) */}
      <Card cornerLines={false} className="bg-card/80 backdrop-blur-md border border-border/70 shadow-sm">
        <CardHeader className="py-2.5 px-3.5 sm:py-3 sm:px-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 border border-primary/20 text-primary">
                <ScrollText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <CardTitle className="text-xs sm:text-sm font-semibold">
                {t("treasury.overview.recentActivity")}
              </CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              chamfer="dual"
              onClick={onNavigateToLedger}
              className="h-6 sm:h-7 text-[11px] sm:text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-mono px-1.5 sm:px-2"
            >
              <span>{t("treasury.overview.viewFullLedger")}</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-2 sm:p-3">
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
        </CardContent>
      </Card>

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
