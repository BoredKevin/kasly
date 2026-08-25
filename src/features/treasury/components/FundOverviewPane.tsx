import { useQuery } from "convex/react";
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
  ScrollText,
  ArrowRight,
  PenLine,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import { LedgerTimeline } from "./LedgerTimeline";

interface FundOverviewPaneProps {
  fundId: Id<"funds"> | null;
  organizationId: Id<"organizations">;
  onNavigateToLedger: () => void;
  onOpenRecordPayment: () => void;
  onOpenKeyGen?: () => void;
}

export function FundOverviewPane({
  fundId,
  organizationId,
  onNavigateToLedger,
  onOpenRecordPayment,
  onOpenKeyGen,
}: FundOverviewPaneProps) {
  const fund = useQuery(
    api.treasury.funds.get,
    fundId ? { fundId } : "skip"
  );

  const myMembership = useQuery(
    api.members.getMyMembership,
    organizationId ? { organizationId } : "skip"
  );

  const canSign = Boolean(
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("SIGN_TREASURY")
  );

  if (!fundId) {
    return (
      <Card telemetry="TREASURY.NO_FUND" cornerLines className="bg-card border-border">
        <CardContent className="py-12 text-center space-y-3">
          <div className="inline-flex p-3 bg-muted/40 border border-border/60 text-muted-foreground rounded-full">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-sm text-foreground">No Fund Selected</p>
            <p className="text-xs text-muted-foreground">
              Please select or create an organization fund from the sidebar.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isFrozen = Boolean(fund?.isFrozen);
  const balance = fund?.balance ?? 0;
  const isPositive = balance > 0;
  const isNegative = balance < 0;

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

      {/* Primary Fund Balance Card */}
      <Card telemetry="TREASURY.BALANCE_CARD" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  {fund?.name ?? "Fund Overview"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {fund?.description || "Treasury Balance"}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="font-mono text-xs px-2 py-0.5 border-primary/40 text-primary bg-primary/10"
              >
                {fund?.currency ?? "---"}
              </Badge>
              {isFrozen && (
                <Badge
                  variant="destructive"
                  className="font-mono text-xs px-2 py-0.5 border-destructive/40 text-red-400 bg-destructive/20 font-bold animate-pulse"
                >
                  CHAIN FROZEN
                </Badge>
              )}
              {fund?.isArchived && (
                <Badge
                  variant="secondary"
                  className="font-mono text-xs px-2 py-0.5 border-amber-500/40 text-amber-400 bg-amber-500/10"
                >
                  ARCHIVED
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6 space-y-6">
          {/* Large Balance Display */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 p-5 bg-background/50 border border-border/70">
            <div className="space-y-1">
              <span className="text-[10px] font-mono tracking-wider uppercase text-muted-foreground">
                BALANCE
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-mono text-muted-foreground font-semibold">
                  {fund?.currency}
                </span>
                <span
                  className={`text-3xl sm:text-4xl font-bold font-mono tracking-tight ${isFrozen
                    ? "text-red-400 opacity-60"
                    : isPositive
                      ? "text-emerald-400"
                      : isNegative
                        ? "text-red-400"
                        : "text-foreground"
                    }`}
                >
                  {balance.toLocaleString()}
                </span>
              </div>
            </div>

            {canSign && !fund?.isArchived && (
              <Button
                type="button"
                variant={isFrozen ? "destructive" : "cyber"}
                chamfer="dual"
                size="sm"
                disabled={isFrozen}
                onClick={onOpenRecordPayment}
                className="text-xs flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                <PenLine className="w-3.5 h-3.5" />
                <span>{isFrozen ? "Ledger Frozen" : "Record Payment"}</span>
              </Button>
            )}
          </div>

          {/* Fund Details Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-muted/20 border border-border/50 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Ledger Status
              </span>
              {isFrozen ? (
                <p className="font-mono font-semibold text-red-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
                  <span>Frozen (Tamper Detected)</span>
                </p>
              ) : (
                <p className="font-mono font-semibold text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active</span>
                </p>
              )}
            </div>
            <div className="p-3 bg-muted/20 border border-border/50 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">
                Created
              </span>
              <p className="font-mono font-semibold text-foreground">
                {fund ? new Date(fund._creationTime).toLocaleDateString() : "---"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Ledger Activity Preview (Unified LedgerTimeline component) */}
      <Card telemetry="TREASURY.RECENT_ACTIVITY" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-3 border-b border-border/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-primary/10 border border-primary/20 text-primary">
                <ScrollText className="w-4 h-4" />
              </div>
              <CardTitle className="text-sm font-semibold">
                Recent Ledger Activity
              </CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              chamfer="dual"
              onClick={onNavigateToLedger}
              className="h-7 text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer font-mono px-2"
            >
              <span>View full ledger</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 pb-4">
          <LedgerTimeline
            fundId={fundId}
            organizationId={organizationId}
            limit={5}
            showPagination={false}
            onOpenRecordPayment={onOpenRecordPayment}
            onOpenKeyGen={onOpenKeyGen}
            emptyMessage="No ledger entries recorded for this fund yet."
          />
        </CardContent>
      </Card>
    </div>
  );
}
