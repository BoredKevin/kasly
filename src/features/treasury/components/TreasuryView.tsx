import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useActiveWorkspace } from "../../../contexts";
import { TreasurySidebar, TreasuryTab } from "./TreasurySidebar";
import { FundOverviewPane } from "./FundOverviewPane";
import { LedgerPane } from "./LedgerPane";
import { DuesSpreadsheetPane } from "./DuesSpreadsheetPane";
import { MyKeysPane } from "./MyKeysPane";
import { AdminPane } from "./AdminPane";
import { InvoicesPane } from "./InvoicesPane";
import { BulkDuesEntryPane } from "./BulkDuesEntryPane";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { CreateDueEventModal } from "./CreateDueEventModal";
import { CreateManualDuesModal } from "./CreateManualDuesModal";
import { GenerateKeyModal } from "./GenerateKeyModal";
import { CreateFundModal } from "./CreateFundModal";
import { SharedEntryPage } from "./SharedEntryPage";
import { Landmark } from "lucide-react";

import { TreasuryErrorBoundary } from "./TreasuryErrorBoundary";

interface TreasuryViewProps {
  activeTab?: TreasuryTab | "entry";
  onTabChange?: (tab: TreasuryTab) => void;
  entryIdentifier?: string;
}

export function TreasuryView({
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
  entryIdentifier,
}: TreasuryViewProps = {}) {
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const orgs = useQuery(api.organizations.listMine);
  const { activeOrgId, setActiveOrgId, activeFundId: workspaceFundId, setActiveFundId } = useActiveWorkspace();

  // If user has orgs but activeOrgId is not set, select the first one
  useEffect(() => {
    if (orgs && orgs.length > 0) {
      if (!activeOrgId || !orgs.some((o) => o._id === activeOrgId)) {
        setActiveOrgId(orgs[0]._id);
      }
    }
  }, [orgs, activeOrgId, setActiveOrgId]);

  const effectiveOrgId = activeOrgId ?? orgs?.[0]?._id;

  const funds = useQuery(
    api.treasury.funds.list,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  // Derive active fund: prioritize workspace selection if present in funds list, otherwise pick first active
  const activeFundId =
    workspaceFundId && funds?.some((f) => f._id === workspaceFundId && !f.isArchived)
      ? workspaceFundId
      : (funds?.find((f) => !f.isArchived)?._id ?? funds?.[0]?._id ?? null);

  useEffect(() => {
    if (activeFundId && activeFundId !== workspaceFundId) {
      setActiveFundId(activeFundId);
    }
  }, [activeFundId, workspaceFundId, setActiveFundId]);

  const activeFund = funds?.find((f) => f._id === activeFundId);

  const entries = useQuery(
    api.treasury.ledger.listEntries,
    activeFundId ? { fundId: activeFundId, limit: 100 } : "skip"
  );

  const getTabFromLocation = (loc: string): TreasuryTab | "entry" => {
    if (loc.startsWith("/tx/") || entryIdentifier) return "entry";
    if (loc === "/treasury/ledger") return "ledger";
    if (loc === "/treasury/dues") return "dues";
    if (loc === "/treasury/bulk-dues" || loc === "/treasury/dues/bulk") return "bulk-dues";
    if (loc === "/treasury/invoices") return "invoices";
    if (loc === "/treasury/keys") return "keys";
    if (loc === "/treasury/admin") return "admin";
    return "overview";
  };

  const currentTab = controlledTab ?? getTabFromLocation(location);
  const handleSelectTab = (tab: TreasuryTab) => {
    if (controlledOnTabChange) {
      controlledOnTabChange(tab);
    }
  };

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

  // Modals state
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [recordPaymentPrefill, setRecordPaymentPrefill] = useState<{
    initialMode?: "manual" | "dues";
    userId?: Id<"users"> | null;
    duesEventId?: Id<"duesEvents"> | null;
    periodCount?: number;
    fundId?: Id<"funds"> | null;
  } | null>(null);

  const [isDueEventOpen, setIsDueEventOpen] = useState(false);
  const [isCreateDuesModalOpen, setIsCreateDuesModalOpen] = useState(false);
  const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
  const [isCreateFundOpen, setIsCreateFundOpen] = useState(false);

  const handleOpenRecordPayment = (prefill?: {
    userId?: Id<"users">;
    duesEventId?: Id<"duesEvents">;
    periodCount?: number;
    fundId?: Id<"funds">;
  }) => {
    if (prefill) {
      setRecordPaymentPrefill({
        initialMode: "dues",
        userId: prefill.userId,
        duesEventId: prefill.duesEventId,
        periodCount: prefill.periodCount ?? 1,
        fundId: prefill.fundId ?? activeFundId ?? undefined,
      });
    } else {
      setRecordPaymentPrefill({
        initialMode: "manual",
        fundId: activeFundId ?? undefined,
      });
    }
    setIsRecordPaymentOpen(true);
  };

  const handleInspectEntryById = (entryId: Id<"ledgerEntries">) => {
    const found = entries?.find((e) => e._id === entryId);
    if (found) {
      setLocation(`/tx/${found.entryHash}`);
    } else {
      setLocation(`/tx/${entryId}`);
    }
  };

  if (orgs === undefined || (effectiveOrgId && funds === undefined)) {
    return (
      <div className="w-full flex items-center justify-center py-20 text-muted-foreground text-sm font-mono animate-pulse">
        Loading treasury workspace...
      </div>
    );
  }

  if (!effectiveOrgId || orgs.length === 0) {
    return (
      <div className="w-full text-center py-20 space-y-4">
        <Landmark className="w-12 h-12 text-muted-foreground mx-auto opacity-50" />
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-foreground">No Organization Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You must join or create an organization before accessing the Treasury system.
          </p>
        </div>
      </div>
    );
  }

  // Resolved tab: if on a tab user lacks permission for, fallback to overview
  const safeCurrentTab: TreasuryTab | "entry" =
    (currentTab === "keys" && !canSign) ||
    (currentTab === "admin" && !canAdmin)
      ? "overview"
      : currentTab;

  return (
    <div className="w-full space-y-6">
      {/* Treasury Header (Desktop) */}
      <div className="hidden md:flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {t("nav.treasury") || "Treasury & Ledger"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {activeFund ? `${activeFund.name} (${activeFund.currency})` : "Community treasury workspace"}
          </p>
        </div>
      </div>

      {/* Main Treasury Layout: Left Sidebar + Right Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Left Sticky Sidebar (Desktop Only) */}
        <div className="hidden md:block sticky top-20 space-y-4">
          <TreasurySidebar
            activeOrgId={effectiveOrgId}
            activeTab={safeCurrentTab === "entry" ? "ledger" : safeCurrentTab}
            onSelectTab={(tab) => {
              handleSelectTab(tab);
              if (tab === "overview") setLocation("/treasury");
              if (tab === "ledger") setLocation("/treasury/ledger");
              if (tab === "dues") setLocation("/treasury/dues");
              if (tab === "bulk-dues") setLocation("/treasury/bulk-dues");
              if (tab === "invoices") setLocation("/treasury/invoices");
              if (tab === "keys") setLocation("/treasury/keys");
              if (tab === "admin") setLocation("/treasury/admin");
            }}
            activeFundId={activeFundId}
            onOpenRecordPayment={handleOpenRecordPayment}
            onOpenDueEvent={() => setIsDueEventOpen(true)}
            onOpenCreateFund={() => setIsCreateFundOpen(true)}
          />
        </div>

        {/* Right Active Tab Pane */}
        <div className="min-w-0 w-full space-y-6">
          <TreasuryErrorBoundary>
            {safeCurrentTab === "entry" && (
              <div>
                <SharedEntryPage
                  identifier={entryIdentifier ?? location.split("/").pop() ?? ""}
                  isAuthenticated={true}
                />
              </div>
            )}

            {safeCurrentTab === "overview" && (
              <div>
                <FundOverviewPane
                  fundId={activeFundId}
                  organizationId={effectiveOrgId}
                  funds={funds}
                  onSelectFund={setActiveFundId}
                  onNavigateToLedger={() => setLocation("/treasury/ledger")}
                  onOpenRecordPayment={() => handleOpenRecordPayment()}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                  onOpenCreateFund={() => setIsCreateFundOpen(true)}
                />
              </div>
            )}

            {safeCurrentTab === "ledger" && (
              <div>
                <LedgerPane
                  fundId={activeFundId}
                  organizationId={effectiveOrgId}
                  onOpenRecordPayment={() => handleOpenRecordPayment()}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                />
              </div>
            )}

            {safeCurrentTab === "dues" && (
              <div>
                <DuesSpreadsheetPane
                  organizationId={effectiveOrgId}
                  organizationName={orgs?.find((o) => o._id === effectiveOrgId)?.name}
                  fundId={activeFundId}
                  fundName={activeFund?.name}
                  currency={activeFund?.currency}
                  onOpenRecordPayment={handleOpenRecordPayment}
                  onOpenEntryDetails={handleInspectEntryById}
                  onOpenAdminTab={() => setLocation("/treasury/admin")}
                  onOpenCreateDues={() => setIsCreateDuesModalOpen(true)}
                  onOpenBulkDues={() => {
                    handleSelectTab("bulk-dues");
                    setLocation("/treasury/bulk-dues");
                  }}
                />
              </div>
            )}

            {safeCurrentTab === "bulk-dues" && canSign && (
              <div>
                <BulkDuesEntryPane
                  organizationId={effectiveOrgId}
                  initialFundId={activeFundId}
                  onNavigateBack={() => {
                    handleSelectTab("dues");
                    setLocation("/treasury/dues");
                  }}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                  onInspectEntry={handleInspectEntryById}
                />
              </div>
            )}

            {safeCurrentTab === "invoices" && (
              <div>
                <InvoicesPane
                  organizationId={effectiveOrgId}
                  activeFundId={activeFundId}
                />
              </div>
            )}

            {safeCurrentTab === "keys" && canSign && (
              <div>
                <MyKeysPane
                  organizationId={effectiveOrgId}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                />
              </div>
            )}

            {safeCurrentTab === "admin" && canAdmin && (
              <div>
                <AdminPane
                  organizationId={effectiveOrgId}
                  activeFundId={activeFundId}
                  onOpenCreateFund={() => setIsCreateFundOpen(true)}
                />
              </div>
            )}
          </TreasuryErrorBoundary>
        </div>
      </div>

      {/* Modals */}
      {canSign && (
        <>
          <RecordPaymentModal
            isOpen={isRecordPaymentOpen}
            onClose={() => {
              setIsRecordPaymentOpen(false);
              setRecordPaymentPrefill(null);
            }}
            organizationId={effectiveOrgId}
            defaultFundId={recordPaymentPrefill?.fundId ?? activeFundId}
            initialMode={recordPaymentPrefill?.initialMode ?? "manual"}
            prefillUserId={recordPaymentPrefill?.userId}
            prefillDuesEventId={recordPaymentPrefill?.duesEventId}
            prefillPeriodCount={recordPaymentPrefill?.periodCount ?? 1}
            onOpenKeyGen={() => setIsKeyGenOpen(true)}
          />

          <CreateDueEventModal
            isOpen={isDueEventOpen}
            onClose={() => setIsDueEventOpen(false)}
            organizationId={effectiveOrgId}
            fundId={activeFundId}
            onOpenDuesTab={() => {
              handleSelectTab("dues");
              setLocation("/treasury/dues");
            }}
          />

          <GenerateKeyModal
            isOpen={isKeyGenOpen}
            onClose={() => setIsKeyGenOpen(false)}
            organizationId={effectiveOrgId}
            onSuccess={() => {
              handleSelectTab("keys");
              setLocation("/treasury/keys");
            }}
          />
        </>
      )}

      {canAdmin && (
        <>
          <CreateFundModal
            isOpen={isCreateFundOpen}
            onClose={() => setIsCreateFundOpen(false)}
            organizationId={effectiveOrgId}
            onSuccess={(newFundId) => {
              setActiveFundId(newFundId);
            }}
          />

          <CreateManualDuesModal
            isOpen={isCreateDuesModalOpen}
            onClose={() => setIsCreateDuesModalOpen(false)}
            organizationId={effectiveOrgId}
            defaultFundId={activeFundId}
          />
        </>
      )}
    </div>
  );
}
