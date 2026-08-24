import { useState, useEffect } from "react";
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
  KeyRound,
  Plus,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Laptop,
  Lock,
} from "lucide-react";
import { listStoredKeys, deleteStoredKey } from "../../../lib/treasury-crypto";

interface MyKeysPaneProps {
  organizationId: Id<"organizations">;
  onOpenKeyGen: () => void;
}

export function MyKeysPane({ organizationId, onOpenKeyGen }: MyKeysPaneProps) {
  const [localKeyIds, setLocalKeyIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const myKeys = useQuery(api.treasury.keys.getMyKeys, { organizationId });

  // Load local keys present in IndexedDB on this browser
  useEffect(() => {
    let isMounted = true;
    listStoredKeys()
      .then((stored) => {
        if (isMounted) {
          setLocalKeyIds(stored.map((s) => s.keyId));
        }
      })
      .catch(() => {
        if (isMounted) {
          setLocalKeyIds([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleDeleteLocalKey = async (keyId: string) => {
    setIsDeleting(keyId);
    try {
      await deleteStoredKey(keyId);
      const stored = await listStoredKeys();
      setLocalKeyIds(stored.map((s) => s.keyId));
    } catch {
      setLocalKeyIds([]);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card telemetry="TREASURY.MY_KEYS" cornerLines className="bg-card border-border shadow-lg">
        <CardHeader className="pb-4 border-b border-border/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Personal Signing Keys
                </CardTitle>
                <CardDescription className="text-xs">
                  Manage your browser-bound ECDSA P-256 cryptographic credentials
                </CardDescription>
              </div>
            </div>

            <Button
              type="button"
              variant="cyber"
              size="sm"
              chamfer="dual"
              onClick={onOpenKeyGen}
              className="text-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate New Key</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 pb-6 space-y-6">
          {/* Security Info Banner */}
          <div className="p-4 bg-primary/5 border border-primary/20 flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-foreground">
                Hardware-Isolated Web Cryptography
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Keys are non-extractable from memory and stored in your device&apos;s IndexedDB. Transactions can only be signed from devices where you generated and registered a trusted keypair.
              </p>
            </div>
          </div>

          {/* Key Cards Grid */}
          {myKeys === undefined ? (
            <div className="py-12 text-center text-xs font-mono text-muted-foreground animate-pulse">
              Loading registered keys...
            </div>
          ) : myKeys.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <KeyRound className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No Registered Keys</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  You do not have any signing keys registered for this organization. Generate a new key to begin signing transactions.
                </p>
              </div>
              <Button
                type="button"
                variant="cyber"
                size="sm"
                chamfer="dual"
                onClick={onOpenKeyGen}
                className="text-xs inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate Keypair</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myKeys.map((k) => {
                const isLocal = localKeyIds.includes(k.keyId);
                const isRevoked = k.isRevoked;
                const isApproved = !isRevoked;

                return (
                  <div
                    key={k._id}
                    className={`p-4 border transition-all space-y-3 ${
                      isRevoked
                        ? "bg-muted/20 border-border/40 opacity-70"
                        : "bg-card/80 border-border hover:border-primary/50 shadow-sm"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-primary/10 border border-primary/30 text-primary">
                          <Laptop className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-foreground">
                          {k.label || "Unnamed Device"}
                        </span>
                      </div>

                      <div>
                        {isApproved && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold"
                          >
                            ACTIVE & TRUSTED
                          </Badge>
                        )}
                        {isRevoked && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono px-1.5 py-0.5 bg-destructive/15 text-destructive-foreground border-destructive/30 font-bold"
                          >
                            REVOKED
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Fingerprint */}
                    <div className="p-2 bg-background border border-border/70 space-y-0.5">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground">
                        Fingerprint (keyId)
                      </span>
                      <div className="font-mono text-xs font-bold text-primary tracking-wider truncate select-all">
                        {k.keyId}
                      </div>
                    </div>

                    {/* Device Local State Status */}
                    <div className="flex items-center justify-between text-[11px] font-mono pt-1">
                      {isLocal ? (
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>Present on this device</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Generated on another device</span>
                        </div>
                      )}

                      {isLocal && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          chamfer="dual"
                          disabled={isDeleting === k.keyId}
                          onClick={() => {
                            void handleDeleteLocalKey(k.keyId);
                          }}
                          className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/15 hover:border-destructive cursor-pointer"
                          title="Remove private key from this browser's IndexedDB"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          <span>Remove</span>
                        </Button>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div className="pt-2 border-t border-border/40 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
                      <span>Registered: {new Date(k.registeredAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5 text-primary" />
                        <span>P-256</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
