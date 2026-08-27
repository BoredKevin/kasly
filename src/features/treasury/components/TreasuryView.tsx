import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useActiveWorkspace } from "../../../contexts";
import { TreasurySidebar, TreasuryTab } from "./TreasurySidebar";
import { FundOverviewPane } from "./FundOverviewPane";
import { LedgerPane } from "./LedgerPane";
import { DuesSpreadsheetPane } from "./DuesSpreadsheetPane";
import { MyKeysPane } from "./MyKeysPane";
import { AdminPane } from "./AdminPane";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { CreateDueEventModal } from "./CreateDueEventModal";
import { CreateManualDuesModal } from "./CreateManualDuesModal";
import { GenerateKeyModal } from "./GenerateKeyModal";
import { CreateFundModal } from "./CreateFundModal";
import { SharedEntryPage } from "./SharedEntryPage";
import { Landmark, PenLine } from "lucide-react";
import { Button } from "@boredkevin/ui";

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
  const [location, setLocation] = useLocation();
  const orgs = useQuery(api.organizations.listMine);
  const { activeOrgId, setActiveOrgId } = useActiveWorkspace();

  // If user has orgs but activeOrgId is not set, select the first one
  if (orgs && orgs.length > 0 && !activeOrgId) {
    setActiveOrgId(orgs[0]._id);
  }

  const effectiveOrgId = activeOrgId ?? orgs?.[0]?._id;

  const funds = useQuery(
    api.treasury.funds.list,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    effectiveOrgId ? { organizationId: effectiveOrgId } : "skip"
  );
  const [selectedFundId, setSelectedFundId] = useState<Id<"funds"> | null>(null);

  // Derive active fund: prioritize user selection if still present in funds list, otherwise pick first active
  const activeFundId =
    selectedFundId && funds?.some((f) => f._id === selectedFundId)
      ? selectedFundId
      : (funds?.find((f) => !f.isArchived)?._id ?? funds?.[0]?._id ?? null);

  const activeFund = funds?.find((f) => f._id === activeFundId);

  const entries = useQuery(
    api.treasury.ledger.listEntries,
    activeFundId ? { fundId: activeFundId, limit: 100 } : "skip"
  );

  const getTabFromLocation = (loc: string): TreasuryTab | "entry" => {
    if (loc.startsWith("/tx/") || entryIdentifier) return "entry";
    if (loc === "/treasury/ledger") return "ledger";
    if (loc === "/treasury/dues") return "dues";
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
  } | null>(null);

  const [isDueEventOpen, setIsDueEventOpen] = useState(false);
  const [isCreateDuesModalOpen, setIsCreateDuesModalOpen] = useState(false);
  const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
  const [isCreateFundOpen, setIsCreateFundOpen] = useState(false);

  const handleOpenRecordPayment = (prefill?: {
    userId?: Id<"users">;
    duesEventId?: Id<"duesEvents">;
    periodCount?: number;
  }) => {
    if (prefill) {
      setRecordPaymentPrefill({
        initialMode: "dues",
        userId: prefill.userId,
        duesEventId: prefill.duesEventId,
        periodCount: prefill.periodCount ?? 1,
      });
    } else {
      setRecordPaymentPrefill({
        initialMode: "manual",
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

  // Active Fund Quick Info
  const isFundArchived = Boolean(activeFund?.isArchived);

  // Resolved tab: if on a tab user lacks permission for, fallback to overview
  const safeCurrentTab: TreasuryTab | "entry" =
    (currentTab === "keys" && !canSign) ||
    (currentTab === "admin" && !canAdmin)
      ? "overview"
      : currentTab;

  return (
    <div className="space-y-6">
      {/* Mobile Top Navigation & Fund Picker */}
      <div className="md:hidden flex flex-col gap-3">
        {/* Horizontal Navigation Pills with Active Highlight */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              handleSelectTab("overview");
              setLocation("/treasury");
            }}
            className={`px-3 py-1.5 border whitespace-nowrap transition-all cursor-pointer ${
              safeCurrentTab === "overview"
                ? "bg-primary/20 text-primary border-primary/50 font-bold"
                : "bg-muted/20 text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            Overview
          </button>

          <button
            type="button"
            onClick={() => {
              handleSelectTab("ledger");
              setLocation("/treasury/ledger");
            }}
            className={`px-3 py-1.5 border whitespace-nowrap transition-all cursor-pointer ${
              safeCurrentTab === "ledger"
                ? "bg-primary/20 text-primary border-primary/50 font-bold"
                : "bg-muted/20 text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            Ledger
          </button>

          <button
            type="button"
            onClick={() => {
              handleSelectTab("dues");
              setLocation("/treasury/dues");
            }}
            className={`px-3 py-1.5 border whitespace-nowrap transition-all cursor-pointer ${
              safeCurrentTab === "dues"
                ? "bg-primary/20 text-primary border-primary/50 font-bold"
                : "bg-muted/20 text-muted-foreground border-border/60 hover:text-foreground"
            }`}
          >
            Dues & Payments
          </button>

          {canSign && (
            <button
              type="button"
              onClick={() => {
                handleSelectTab("keys");
                setLocation("/treasury/keys");
              }}
              className={`px-3 py-1.5 border whitespace-nowrap transition-all cursor-pointer ${
                safeCurrentTab === "keys"
                  ? "bg-primary/20 text-primary border-primary/50 font-bold"
                  : "bg-muted/20 text-muted-foreground border-border/60 hover:text-foreground"
              }`}
            >
              My Keys
            </button>
          )}

          {canAdmin && (
            <button
              type="button"
              onClick={() => {
                handleSelectTab("admin");
                setLocation("/treasury/admin");
              }}
              className={`px-3 py-1.5 border whitespace-nowrap transition-all cursor-pointer ${
                safeCurrentTab === "admin"
                  ? "bg-primary/20 text-primary border-primary/50 font-bold"
                  : "bg-muted/20 text-muted-foreground border-border/60 hover:text-foreground"
              }`}
            >
              Administration
            </button>
          )}
        </div>

        {/* Mobile Compact Fund Switcher Bar */}
        {funds && funds.length > 0 && (
          <div className="flex items-center justify-between gap-2 p-2 bg-muted/20 border border-border/70 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase font-mono text-muted-foreground shrink-0">
                Fund:
              </span>
              <select
                value={activeFundId ?? ""}
                onChange={(e) => setSelectedFundId(e.target.value as Id<"funds">)}
                className="bg-transparent text-foreground font-semibold text-xs border-none focus:outline-none truncate cursor-pointer"
              >
                {funds.map((f) => (
                  <option key={f._id} value={f._id} className="bg-popover text-popover-foreground">
                    {f.name} ({f.currency}) {f.isArchived ? "[Archived]" : ""}
                  </option>
                ))}
              </select>
            </div>

            {canSign && !isFundArchived && (
              <Button
                variant="default"
                size="sm"
                chamfer="dual"
                onClick={() => handleOpenRecordPayment()}
                className="h-7 px-2.5 text-[11px] font-mono shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <PenLine className="w-3 h-3" />
                <span>Record</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Treasury Layout: Left Sidebar + Right Content Area */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Left Sticky Sidebar (Desktop Only) */}
        <div className="hidden md:block sticky top-24 space-y-4">
          <TreasurySidebar
            activeOrgId={effectiveOrgId}
            activeTab={safeCurrentTab === "entry" ? "ledger" : safeCurrentTab}
            onSelectTab={(tab) => {
              handleSelectTab(tab);
              if (tab === "overview") setLocation("/treasury");
              if (tab === "ledger") setLocation("/treasury/ledger");
              if (tab === "dues") setLocation("/treasury/dues");
              if (tab === "keys") setLocation("/treasury/keys");
              if (tab === "admin") setLocation("/treasury/admin");
            }}
            activeFundId={activeFundId}
            onSelectFund={setSelectedFundId}
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
                  onNavigateToLedger={() => setLocation("/treasury/ledger")}
                  onOpenRecordPayment={() => handleOpenRecordPayment()}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
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
            defaultFundId={activeFundId}
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
              setSelectedFundId(newFundId);
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
