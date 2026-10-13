import { useTranslation } from "react-i18next";
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
import { KeyRound, Check, X, User, Laptop } from "lucide-react";

export interface PendingKeyItem {
  _id: Id<"pendingKeys">;
  keyId: string;
  userName?: string;
  userEmail?: string;
  label?: string;
  requestedAt: number;
}

export interface PendingKeyApprovalsSectionProps {
  pendingKeys: PendingKeyItem[] | undefined;
  processingId: string | null;
  onApproveKey: (pendingKeyId: Id<"pendingKeys">) => Promise<void>;
  onRejectKey: (pendingKeyId: Id<"pendingKeys">) => Promise<void>;
}

export function PendingKeyApprovalsSection({
  pendingKeys,
  processingId,
  onApproveKey,
  onRejectKey,
}: PendingKeyApprovalsSectionProps) {
  const { t } = useTranslation();

  return (
    <Panel className="shadow-lg">
      <CardHeader className="pb-4 border-b border-border/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {t("treasury.admin.pendingKeyReviews")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("treasury.admin.description")}
              </CardDescription>
            </div>
          </div>

          {pendingKeys && pendingKeys.length > 0 && (
            <Badge
              variant="secondary"
              className="font-mono text-xs px-2 py-0.5 border-amber-500/40 text-amber-300 bg-amber-500/15 font-bold animate-pulse"
            >
              {pendingKeys.length} {t("treasury.keys.pending").toUpperCase()}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6">
        {pendingKeys === undefined ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
            {t("common.loading")}
          </div>
        ) : pendingKeys.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <Check className="w-6 h-6 text-emerald-400 mx-auto opacity-70" />
            <p className="text-xs font-mono text-muted-foreground">
              {t("treasury.keys.pendingApproval")}: 0
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingKeys.map((item) => (
              <div
                key={item._id}
                className="p-4 bg-background border border-amber-500/30 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-muted/40 border border-border/60 text-muted-foreground">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {item.userName || item.userEmail || "Treasurer User"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(item.requestedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Laptop className="w-3 h-3" />
                    <span>Device Label: <strong className="text-foreground">{item.label || "Unnamed Device"}</strong></span>
                  </div>

                  <div className="p-2 bg-muted/30 border border-border/60 space-y-0.5">
                    <span className="text-[9px] font-mono uppercase text-muted-foreground">
                      Requested Key Fingerprint
                    </span>
                    <div className="font-mono text-xs font-bold text-amber-300 truncate select-all">
                      {item.keyId}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    chamfer="none"
                    disabled={processingId === item._id}
                    onClick={() => {
                      void onRejectKey(item._id);
                    }}
                    className="h-7 text-xs px-2.5 text-destructive hover:bg-destructive/15 hover:border-destructive cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    <span>Reject</span>
                  </Button>

                  <Button
                    type="button"
                    variant="cyber"
                    size="sm"
                    chamfer="none"
                    disabled={processingId === item._id}
                    onClick={() => {
                      void onApproveKey(item._id);
                    }}
                    className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Approve Key</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Panel>
  );
}
