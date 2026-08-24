import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@boredkevin/ui";
import { CalendarDays, X, Clock, Sparkles } from "lucide-react";

interface CreateDueEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateDueEventModal({ isOpen, onClose }: CreateDueEventModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="TREASURY.DUE_EVENT_STUB" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Weekly Due Adjustment
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Recurring dues & automated member cycle tracking
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
            <div className="p-4 bg-primary/10 border border-primary/30 text-center space-y-3">
              <div className="inline-flex p-3 bg-primary/20 border border-primary/40 text-primary rounded-full">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Scheduled for Future Release</span>
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Automated weekly due events, per-member balance aggregation, and recurring cycle reconciliation will be available in the upcoming Dues & Payments module.
                </p>
              </div>
            </div>

            <div className="p-3 bg-muted/30 border border-border/60 space-y-1.5 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground font-mono text-[11px] uppercase tracking-wider">
                Current Alternative
              </p>
              <p className="text-[11px] leading-relaxed">
                Treasurers can record member dues collections directly using the <strong className="text-foreground">Record Payment</strong> action as a signed Credit entry on the appropriate fund.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end border-t border-border">
              <Button
                type="button"
                variant="cyber"
                chamfer="dual"
                size="sm"
                onClick={onClose}
                className="text-xs cursor-pointer"
              >
                Got It
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
