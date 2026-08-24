import { useState } from "react";
import { useQuery } from "convex/react";
import { useLocation } from "wouter";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useActiveWorkspace } from "../../../contexts";
import { TreasurySidebar, TreasuryTab } from "./TreasurySidebar";
import { FundOverviewPane } from "./FundOverviewPane";
import { LedgerPane } from "./LedgerPane";
import { MyKeysPane } from "./MyKeysPane";
import { AdminPane } from "./AdminPane";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { CreateDueEventModal } from "./CreateDueEventModal";
import { GenerateKeyModal } from "./GenerateKeyModal";
import { CreateFundModal } from "./CreateFundModal";
import {
  Landmark,
  ChevronDown,
  Plus,
  PenLine,
} from "lucide-react";
import { Button, Badge } from "@boredkevin/ui";

import { TreasuryErrorBoundary } from "./TreasuryErrorBoundary";

interface TreasuryViewProps {
  activeTab?: TreasuryTab;
  onTabChange?: (tab: TreasuryTab) => void;
}

export function TreasuryView({
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
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

  const getTabFromLocation = (loc: string): TreasuryTab => {
    if (loc === "/treasury/ledger") return "ledger";
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
  const [isDueEventOpen, setIsDueEventOpen] = useState(false);
  const [isKeyGenOpen, setIsKeyGenOpen] = useState(false);
  const [isCreateFundOpen, setIsCreateFundOpen] = useState(false);

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

  // Safety fallback for tab permissions
  const safeCurrentTab =
    currentTab === "admin" && !canAdmin
      ? "overview"
      : currentTab === "keys" && !canSign
        ? "overview"
        : currentTab;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Treasury Header & Mobile Fund Switcher */}
      <div className="flex flex-col gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Treasury & Ledger
          </h2>
          <p className="text-xs text-muted-foreground">
            Append-only cryptographically chained ledger, balance reconciliation, and key management
          </p>
        </div>

        {/* Mobile Fund Switcher Bar */}
        <div className="md:hidden p-3 bg-card/80 backdrop-blur-md border border-border/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/20 border border-primary/40 text-primary">
                <Landmark className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-mono tracking-wider text-muted-foreground uppercase">
                Active Fund
              </span>
            </div>
            {activeFund && (
              <Badge
                variant="secondary"
                className="text-[9px] font-mono px-1.5 py-0.5 bg-primary/15 text-primary border-primary/30"
              >
                {activeFund.currency}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {funds && funds.length > 0 ? (
              <div className="relative flex-1 min-w-0">
                <select
                  value={activeFundId ?? ""}
                  onChange={(e) => {
                    setSelectedFundId(e.target.value as Id<"funds">);
                  }}
                  className="w-full h-8 px-2.5 pr-8 bg-background border border-border text-xs text-foreground font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer truncate"
                >
                  {funds.map((fund) => (
                    <option key={fund._id} value={fund._id}>
                      {fund.name} ({fund.currency})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none text-muted-foreground" />
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-1 font-mono flex-1">
                No funds
              </div>
            )}

            {canSign && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={() => setIsRecordPaymentOpen(true)}
                className="h-8 text-xs px-2.5 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>Record</span>
              </Button>
            )}

            {canAdmin && (
              <Button
                type="button"
                variant="cyber"
                size="sm"
                chamfer="dual"
                onClick={() => setIsCreateFundOpen(true)}
                className="h-8 text-xs px-2.5 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Responsive Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Left Desktop Sticky Sidebar */}
        <div className="hidden md:block md:sticky md:top-24">
          <TreasurySidebar
            activeTab={safeCurrentTab}
            onSelectTab={handleSelectTab}
            activeOrgId={effectiveOrgId}
            activeFundId={activeFundId}
            onSelectFund={setSelectedFundId}
            onOpenRecordPayment={() => setIsRecordPaymentOpen(true)}
            onOpenDueEvent={() => setIsDueEventOpen(true)}
            onOpenCreateFund={() => setIsCreateFundOpen(true)}
          />
        </div>

        {/* Right Active Tab Pane */}
        <div className="min-w-0 w-full space-y-6">
          <TreasuryErrorBoundary>
            {safeCurrentTab === "overview" && (
              <div className="animate-in fade-in duration-200">
                <FundOverviewPane
                  fundId={activeFundId}
                  organizationId={effectiveOrgId}
                  onNavigateToLedger={() => setLocation("/treasury/ledger")}
                  onOpenRecordPayment={() => setIsRecordPaymentOpen(true)}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                />
              </div>
            )}

            {safeCurrentTab === "ledger" && (
              <div className="animate-in fade-in duration-200">
                <LedgerPane
                  fundId={activeFundId}
                  organizationId={effectiveOrgId}
                  onOpenRecordPayment={() => setIsRecordPaymentOpen(true)}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                />
              </div>
            )}

            {safeCurrentTab === "keys" && canSign && (
              <div className="animate-in fade-in duration-200">
                <MyKeysPane
                  organizationId={effectiveOrgId}
                  onOpenKeyGen={() => setIsKeyGenOpen(true)}
                />
              </div>
            )}

            {safeCurrentTab === "admin" && canAdmin && (
              <div className="animate-in fade-in duration-200">
                <AdminPane
                  organizationId={effectiveOrgId}
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
            onClose={() => setIsRecordPaymentOpen(false)}
            organizationId={effectiveOrgId}
            defaultFundId={activeFundId}
            onOpenKeyGen={() => setIsKeyGenOpen(true)}
          />

          <CreateDueEventModal
            isOpen={isDueEventOpen}
            onClose={() => setIsDueEventOpen(false)}
          />

          <GenerateKeyModal
            isOpen={isKeyGenOpen}
            onClose={() => setIsKeyGenOpen(false)}
            organizationId={effectiveOrgId}
          />
        </>
      )}

      {canAdmin && (
        <CreateFundModal
          isOpen={isCreateFundOpen}
          onClose={() => setIsCreateFundOpen(false)}
          organizationId={effectiveOrgId}
          onSuccess={(newFundId) => {
            setSelectedFundId(newFundId);
          }}
        />
      )}
    </div>
  );
}
