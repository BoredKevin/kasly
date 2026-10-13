import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
} from "@boredkevin/ui";
import { Panel } from "../../../../ui";
import { Clock, CalendarPlus } from "lucide-react";
import { CreateManualDuesModal } from "../CreateManualDuesModal";

export interface DuesScheduleSectionProps {
  organizationId: Id<"organizations">;
  funds?: Array<{ _id: Id<"funds">; name: string; currency: string; isArchived: boolean }>;
  initialFundId: Id<"funds"> | null;
}

export function DuesScheduleSection({
  organizationId,
  funds,
  initialFundId,
}: DuesScheduleSectionProps) {
  const [selectedFundIdState, setSelectedFundIdState] = useState<Id<"funds"> | null>(null);

  const activeFunds = funds?.filter((f) => !f.isArchived) ?? [];
  const selectedFundId =
    selectedFundIdState ??
    initialFundId ??
    activeFunds[0]?._id ??
    funds?.[0]?._id ??
    null;

  const currentFund = funds?.find((f) => f._id === selectedFundId);

  const duesConfig = useQuery(
    api.treasury.dues.getDuesConfig,
    organizationId && selectedFundId
      ? { organizationId, fundId: selectedFundId }
      : "skip"
  );
  const upsertDuesConfig = useMutation(api.treasury.dues.upsertDuesConfig);
  const disableDues = useMutation(api.treasury.dues.disableDues);

  const [isEditing, setIsEditing] = useState(false);
  const [isCreateDuesModalOpen, setIsCreateDuesModalOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [intervalType, setIntervalType] = useState<"weekly" | "monthly" | "custom_days">("monthly");
  const [intervalValue, setIntervalValue] = useState<number>(1);
  const [amount, setAmount] = useState<string>("20000");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync state when config loads or selected fund changes
  const [lastFundId, setLastFundId] = useState<Id<"funds"> | null>(null);
  if (selectedFundId !== lastFundId) {
    setLastFundId(selectedFundId);
    setIsEditing(false);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  const handleStartEdit = () => {
    if (duesConfig) {
      setIsEnabled(duesConfig.isEnabled);
      setIntervalType(duesConfig.intervalType);
      setIntervalValue(duesConfig.intervalValue);
      setAmount(duesConfig.amount.toString());
    } else {
      setIsEnabled(true);
      setIntervalType("monthly");
      setIntervalValue(1);
      setAmount("20000");
    }
    setIsEditing(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFundId) {
      setErrorMessage("No fund selected.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Please enter a valid positive integer amount.");
      setIsSaving(false);
      return;
    }

    try {
      await upsertDuesConfig({
        organizationId,
        fundId: selectedFundId,
        isEnabled,
        intervalType,
        intervalValue: Number(intervalValue),
        amount: parsedAmount,
      });
      setStatusMessage(`Dues schedule for ${currentFund?.name || "fund"} saved successfully!`);
      setIsEditing(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save configuration.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!selectedFundId) return;
    setErrorMessage(null);
    setStatusMessage(null);
    if (duesConfig?.isEnabled) {
      try {
        await disableDues({ organizationId, fundId: selectedFundId });
        setIsEnabled(false);
        setStatusMessage(`Dues schedule for ${currentFund?.name || "fund"} has been disabled.`);
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to disable schedule.");
      }
    } else {
      handleStartEdit();
      setIsEnabled(true);
    }
  };

  const dayOfWeekNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Panel className="shadow-lg">
      <CardHeader className="pb-4 border-b border-border/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 border border-primary/30 text-primary">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Automated Member Dues Schedule
              </CardTitle>
              <CardDescription className="text-xs">
                Configure scheduled dues cron jobs to automatically create dues cycles and track member obligations
              </CardDescription>
            </div>
          </div>

          {/* Target Fund Selector */}
          {funds && funds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">Target Fund:</span>
              <select
                value={selectedFundId ?? ""}
                onChange={(e) => setSelectedFundIdState(e.target.value as Id<"funds">)}
                className="h-8 px-2.5 bg-background border border-border text-xs font-semibold font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                {funds.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} ({f.currency}){f.isArchived ? " [Archived]" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6 space-y-5">
        {statusMessage && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono">
            {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
            {errorMessage}
          </div>
        )}

        {!selectedFundId ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground">
            Please create or select a fund to configure its dues schedule.
          </div>
        ) : duesConfig === undefined ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
            Loading dues configuration...
          </div>
        ) : !isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground">
                Configuring: <strong className="text-foreground">{currentFund?.name} ({currentFund?.currency})</strong>
              </span>
              {duesConfig?.isEnabled ? (
                <Badge
                  variant="secondary"
                  className="font-mono text-xs px-2.5 py-0.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 font-bold"
                >
                  ACTIVE
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="font-mono text-xs px-2.5 py-0.5 border-muted-foreground/30 text-muted-foreground bg-muted/20"
                >
                  DISABLED
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-background/50 border border-border/60 space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Cycle Frequency
                </span>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {duesConfig?.intervalType === "weekly"
                    ? `Weekly on ${dayOfWeekNames[duesConfig.intervalValue] ?? "Day"}`
                    : duesConfig?.intervalType === "monthly"
                      ? `Monthly on Day ${duesConfig.intervalValue}`
                      : duesConfig?.intervalType === "custom_days"
                        ? `Every ${duesConfig.intervalValue} days`
                        : "Not configured"}
                </p>
              </div>

              <div className="p-3 bg-background/50 border border-border/60 space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Amount per Member
                </span>
                <p className="text-sm font-bold text-foreground font-mono">
                  {duesConfig
                    ? currentFund?.currency === "IDR"
                      ? `Rp ${duesConfig.amount.toLocaleString("id-ID")}`
                      : `${currentFund?.currency || "IDR"} ${duesConfig.amount.toLocaleString()}`
                    : "---"}
                </p>
              </div>

              <div className="p-3 bg-background/50 border border-border/60 space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  Next Scheduled Trigger
                </span>
                <p className="text-xs font-mono text-foreground">
                  {duesConfig?.nextScheduledAt
                    ? new Date(duesConfig.nextScheduledAt).toLocaleString()
                    : duesConfig?.isEnabled
                      ? "Pending calculation..."
                      : "Schedule paused"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  chamfer="none"
                  onClick={handleStartEdit}
                  className="text-xs cursor-pointer"
                >
                  Configure Schedule
                </Button>

                <Button
                  type="button"
                  variant={duesConfig?.isEnabled ? "destructive" : "cyber"}
                  size="sm"
                  chamfer="none"
                  onClick={() => {
                    void handleToggleActive();
                  }}
                  className="text-xs cursor-pointer"
                >
                  {duesConfig?.isEnabled ? "Disable Schedule" : "Enable Schedule"}
                </Button>
              </div>

              <Button
                type="button"
                variant="cyber"
                size="sm"
                chamfer="none"
                onClick={() => setIsCreateDuesModalOpen(true)}
                className="text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                <span>Create Dues Cycle (Manual / Past)</span>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              void handleSaveConfig(e);
            }}
            className="space-y-4"
          >
            <div className="p-2.5 bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
              Editing dues schedule for: <strong>{currentFund?.name} ({currentFund?.currency})</strong>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Interval Frequency
                </label>
                <select
                  value={intervalType}
                  onChange={(e) => {
                    const val = e.target.value as "weekly" | "monthly" | "custom_days";
                    setIntervalType(val);
                    if (val === "weekly") setIntervalValue(0);
                    else if (val === "monthly") setIntervalValue(1);
                    else if (val === "custom_days") setIntervalValue(7);
                  }}
                  className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="monthly">Monthly (Day of Month)</option>
                  <option value="weekly">Weekly (Day of Week)</option>
                  <option value="custom_days">Custom Days (Every N days)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {intervalType === "weekly"
                    ? "Day of Week"
                    : intervalType === "monthly"
                      ? "Day of Month (1 - 28)"
                      : "Interval (Days)"}
                </label>
                {intervalType === "weekly" ? (
                  <select
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {dayOfWeekNames.map((day, idx) => (
                      <option key={idx} value={idx}>
                        {day}
                      </option>
                    ))}
                  </select>
                ) : intervalType === "monthly" ? (
                  <select
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Number(e.target.value))}
                    className="w-full h-9 px-3 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <option key={day} value={day}>
                        Day {day} of month
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="1"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full h-9 px-3 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Amount per Member ({currentFund?.currency || "Smallest Unit"})
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 20000"
                  className="w-full h-9 px-3 bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0"
                />
                <span>Enable automated cron job scheduling for {currentFund?.name || "this fund"}</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                onClick={() => setIsEditing(false)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="cyber"
                size="sm"
                chamfer="none"
                disabled={isSaving}
                className="text-xs cursor-pointer"
              >
                {isSaving ? "Saving..." : "Save Schedule"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      <CreateManualDuesModal
        isOpen={isCreateDuesModalOpen}
        onClose={() => setIsCreateDuesModalOpen(false)}
        organizationId={organizationId}
        defaultFundId={selectedFundId}
        onSuccess={() => {
          setStatusMessage(`New dues cycle created for ${currentFund?.name || "fund"}! Check the Dues & Payments view.`);
        }}
      />
    </Panel>
  );
}
