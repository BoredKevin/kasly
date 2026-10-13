import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ResponsiveDialog } from "../../../../ui/ResponsiveDialog";
import { Button, Badge } from "@boredkevin/ui";
import { CheckCircle, AlertTriangle, Check, Trash2, Plus } from "lucide-react";

export interface AdjustDuesSubModalProps {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  studentName: string;
  onClose: () => void;
}

export function AdjustDuesSubModal({
  organizationId,
  userId,
  studentName,
  onClose,
}: AdjustDuesSubModalProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const duesData = useQuery(api.preRegistration.getPlaceholderMemberDues, {
    organizationId,
    userId,
  });

  const assignCycle = useMutation(api.preRegistration.assignPlaceholderDuesCycle);
  const removeCycle = useMutation(api.preRegistration.removePlaceholderDuesCycle);
  const togglePayment = useMutation(api.preRegistration.togglePlaceholderDuesPayment);

  const handleAssign = async (duesEventId: Id<"duesEvents">) => {
    setError(null);
    setSuccess(null);
    try {
      await assignCycle({ organizationId, userId, duesEventId });
      setSuccess("Dues cycle assigned.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to assign cycle.");
    }
  };

  const handleRemove = async (membershipId: Id<"duesMemberships">) => {
    setError(null);
    setSuccess(null);
    try {
      await removeCycle({ organizationId, membershipId });
      setSuccess("Dues cycle removed.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove cycle.");
    }
  };

  const handleTogglePaid = async (membershipId: Id<"duesMemberships">) => {
    setError(null);
    setSuccess(null);
    try {
      const isPaid = await togglePayment({ organizationId, membershipId });
      setSuccess(isPaid ? "Marked as Paid." : "Marked as Unpaid.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update payment status.");
    }
  };

  return (
    <ResponsiveDialog
      isOpen={true}
      onClose={onClose}
      title={t("treasury.preReg.adjustDuesTitle", { name: studentName })}
      description={`${t("treasury.preReg.totalOwed")}: Rp ${duesData?.totalUnpaidAmount.toLocaleString() ?? 0}`}
      maxWidth="lg"
    >
      <div className="space-y-4 pt-1">
        {success && (
          <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Enrolled Cycles */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            {t("treasury.preReg.enrolledCycles")} ({duesData?.enrolled.length ?? 0})
          </h4>

          {duesData === undefined ? (
            <div className="py-4 text-center text-xs font-mono text-muted-foreground animate-pulse">
              {t("common.loading")}
            </div>
          ) : duesData.enrolled.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono py-2">
              {t("treasury.preReg.noEnrolledCycles")}
            </p>
          ) : (
            <div className="space-y-1.5">
              {duesData.enrolled.map((cycle) => (
                <div
                  key={cycle.membershipId}
                  className="p-3 bg-muted/20 border border-border/60 flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {cycle.periodLabel}
                      </span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">
                        {cycle.fundName}
                      </Badge>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {cycle.currency} {cycle.amount.toLocaleString()} • Due:{" "}
                      {new Date(cycle.dueDate).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant={cycle.hasPaid ? "cyber" : "outline"}
                      size="sm"
                      chamfer="none"
                      onClick={() => handleTogglePaid(cycle.membershipId)}
                      className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                    >
                      {cycle.hasPaid ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>PAID</span>
                        </>
                      ) : (
                        <span>UNPAID</span>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleRemove(cycle.membershipId)}
                      className="text-destructive hover:bg-destructive/15 p-1 rounded transition-colors cursor-pointer"
                      title={t("treasury.preReg.removeBtn")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available Cycles to Assign */}
        <div className="space-y-2 pt-2 border-t border-border/60">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
            {t("treasury.preReg.availableCycles")} ({duesData?.available.length ?? 0})
          </h4>

          {duesData && duesData.available.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono py-2">
              {t("treasury.preReg.noAvailableCycles")}
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {duesData?.available.map((ev) => (
                <div
                  key={ev.duesEventId}
                  className="p-2.5 bg-background/50 border border-border/40 flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {ev.periodLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        ({ev.fundName})
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {ev.currency} {ev.amount.toLocaleString()}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="none"
                    onClick={() => handleAssign(ev.duesEventId)}
                    className="h-6 text-[10px] px-2 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t("treasury.preReg.assignBtn")}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
