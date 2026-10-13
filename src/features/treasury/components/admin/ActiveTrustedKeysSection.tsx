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
import { ShieldCheck, User, Laptop, Clock, Ban } from "lucide-react";

export interface ActiveKeyItem {
  _id: Id<"treasurerKeys">;
  keyId: string;
  userName?: string;
  userEmail?: string;
  label?: string;
  registeredAt: number;
  revokedAt?: number;
}

export interface ActiveTrustedKeysSectionProps {
  activeKeys: ActiveKeyItem[] | undefined;
  processingId: string | null;
  onRevokeKey: (treasurerKeyId: Id<"treasurerKeys">) => Promise<void>;
}

export function ActiveTrustedKeysSection({
  activeKeys,
  processingId,
  onRevokeKey,
}: ActiveTrustedKeysSectionProps) {
  return (
    <Panel className="shadow-lg">
      <CardHeader className="pb-4 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              Trusted Signing Keys
            </CardTitle>
            <CardDescription className="text-xs">
              Public keys currently authorized to commit signed ledger transactions
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 pb-6">
        {activeKeys === undefined ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground animate-pulse">
            Loading active keys...
          </div>
        ) : activeKeys.length === 0 ? (
          <div className="py-6 text-center space-y-1.5">
            <Clock className="w-6 h-6 text-muted-foreground mx-auto" />
            <p className="text-xs font-mono text-muted-foreground">
              No active treasurer keys registered for this organization.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeKeys.map((key) => {
              const isRevoked = Boolean(key.revokedAt);
              return (
                <div
                  key={key._id}
                  className={`p-4 border transition-all space-y-3 ${
                    isRevoked
                      ? "bg-muted/10 border-border/40 opacity-70"
                      : "bg-background border-border/80 hover:border-border shadow-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-muted/40 border border-border/60 text-muted-foreground">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        {key.userName || key.userEmail || "Treasurer User"}
                      </span>
                    </div>

                    {isRevoked ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-destructive/15 text-destructive-foreground border-destructive/30 font-bold"
                      >
                        REVOKED
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold"
                      >
                        ACTIVE
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Laptop className="w-3 h-3" />
                      <span>Device: <strong className="text-foreground">{key.label || "Unnamed Device"}</strong></span>
                    </div>

                    <div className="p-2 bg-muted/30 border border-border/60 space-y-0.5">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground">
                        Fingerprint (keyId)
                      </span>
                      <div className="font-mono text-xs font-bold text-primary truncate select-all">
                        {key.keyId}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-border/40 text-[10px] font-mono text-muted-foreground">
                    <span>Registered: {new Date(key.registeredAt).toLocaleDateString()}</span>

                    {!isRevoked && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        chamfer="none"
                        disabled={processingId === key._id}
                        onClick={() => {
                          void onRevokeKey(key._id);
                        }}
                        className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/15 hover:border-destructive cursor-pointer"
                      >
                        <Ban className="w-3 h-3 mr-1" />
                        <span>Revoke Key</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Panel>
  );
}
