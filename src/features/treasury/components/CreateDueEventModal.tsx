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
  Badge,
} from "@boredkevin/ui";
import { CalendarDays, X, Clock, ArrowRight } from "lucide-react";

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
  const duesSummary = useQuery(
    api.treasury.dues.getDuesSummary,
    organizationId && fundId ? { organizationId, fundId } : "skip"
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="TREASURY.DUE_EVENT_MODAL" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("treasury.dues.title")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {t("treasury.dues.description")}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={onClose}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-5 space-y-4">
            <div className="p-4 bg-primary/10 border border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">{t("treasury.dues.scheduleConfig")}</span>
                </div>
                {duesSummary?.config?.isEnabled ? (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  >
                    ● ACTIVE
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-muted-foreground border-muted-foreground/30"
                  >
                    DISABLED
                  </Badge>
                )}
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  <strong>Interval:</strong>{" "}
                  {duesSummary?.config?.isEnabled
                    ? duesSummary.config.intervalType === "weekly"
                      ? "Weekly Cycle"
                      : duesSummary.config.intervalType === "monthly"
                      ? `Monthly on Day ${duesSummary.config.intervalValue}`
                      : `Every ${duesSummary.config.intervalValue} days`
                    : "Not currently active"}
                </p>
                {duesSummary?.config && (
                  <p>
                    <strong>Amount:</strong> Rp {duesSummary.config.amount.toLocaleString("id-ID")} per member
                  </p>
                )}
                {duesSummary?.config?.nextScheduledAt && (
                  <p className="text-[11px] font-mono text-foreground">
                    <strong>Next Run:</strong>{" "}
                    {new Date(duesSummary.config.nextScheduledAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-muted/30 border border-border/60 space-y-1 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground font-mono text-[11px] uppercase tracking-wider">
                Full Dues Matrix
              </p>
              <p className="text-[11px] leading-relaxed">
                View all members, track paid and unpaid cycles in the spreadsheet matrix, and sign payment credits.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="dual"
                size="sm"
                onClick={onClose}
                className="text-xs cursor-pointer"
              >
                {t("common.close")}
              </Button>

              {onOpenDuesTab && (
                <Button
                  type="button"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onOpenDuesTab();
                  }}
                  className="text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Open Dues Matrix</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
