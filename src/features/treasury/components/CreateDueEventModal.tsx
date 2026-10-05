import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@boredkevin/ui";
import { ResponsiveDialog, StatusPill } from "../../../ui";
import { useFormat } from "../../../hooks/useFormat";
import { Clock, ArrowRight } from "lucide-react";

interface CreateDueEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: Id<"organizations">;
  fundId?: Id<"funds"> | null;
  onOpenDuesTab?: () => void;
}

export function CreateDueEventModal({
  isOpen,
  onClose,
  organizationId,
  fundId,
  onOpenDuesTab,
}: CreateDueEventModalProps) {
  const { t } = useTranslation();
  const { money: formatMoney, dateTime: formatDateTime } = useFormat();
  const duesSummary = useQuery(
    api.treasury.dues.getDuesSummary,
    organizationId && fundId ? { organizationId, fundId } : "skip"
  );

  const isEnabled = Boolean(duesSummary?.config?.isEnabled);

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("treasury.dues.title", "Recurring Dues Automation")}
      description={t(
        "treasury.dues.description",
        "Overview of automated dues cycle generation and schedule status."
      )}
      maxWidth="md"
    >
      <div className="pt-2 space-y-4">
        <div className="p-4 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-sm)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">
                {t("treasury.dues.scheduleConfig", "Schedule Configuration")}
              </span>
            </div>
            <StatusPill
              tone={isEnabled ? "success" : "neutral"}
              dot
            >
              {isEnabled ? "ACTIVE" : "DISABLED"}
            </StatusPill>
          </div>

          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Interval:</span>
              <span className="font-medium text-foreground">
                {isEnabled
                  ? duesSummary?.config?.intervalType === "weekly"
                    ? "Weekly Cycle"
                    : duesSummary?.config?.intervalType === "monthly"
                    ? `Monthly on Day ${duesSummary.config.intervalValue}`
                    : `Every ${duesSummary?.config?.intervalValue} days`
                  : "Not configured"}
              </span>
            </div>
            {duesSummary?.config && (
              <div className="flex items-center justify-between">
                <span>Per Member Rate:</span>
                <span className="font-medium text-foreground">
                  {formatMoney(duesSummary.config.amount, "IDR")}
                </span>
              </div>
            )}
            {duesSummary?.config?.nextScheduledAt && (
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span>Next Scheduled Run:</span>
                <span className="text-foreground">
                  {formatDateTime(duesSummary.config.nextScheduledAt)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 bg-muted/30 border border-border/60 rounded-[var(--fintech-radius-sm)] space-y-1 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground text-xs">
            Dues Matrix & Management
          </p>
          <p className="text-[11px] leading-relaxed">
            View all members, track paid and unpaid cycles in the spreadsheet matrix, and sign payment credits.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border">
          <Button
            type="button"
            variant="outline"
            chamfer="none"
            size="sm"
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            {t("common.close", "Close")}
          </Button>

          {onOpenDuesTab && (
            <Button
              type="button"
              variant="cyber"
              chamfer="none"
              size="sm"
              onClick={() => {
                onClose();
                onOpenDuesTab();
              }}
              className="text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
            >
              <span>Open Dues Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
