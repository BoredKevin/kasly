import { Panel } from "../../../../ui/Panel";
import { Button } from "@boredkevin/ui";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export interface KeyItem {
  keyId: string;
  label?: string;
  revokedAt?: number;
}

export interface BulkDuesContextBarProps {
  currentFundName?: string;
  currency: string;
  availableKeysOnDevice: KeyItem[];
  otherDeviceKeys: KeyItem[];
  selectedKeyId: string;
  isKeyAvailableOnDevice: boolean;
  isLoadingLocalKeys: boolean;
  isProcessing: boolean;
  onSelectKeyId: (keyId: string) => void;
  onOpenKeyGen?: () => void;
}

export function BulkDuesContextBar({
  currentFundName,
  currency,
  availableKeysOnDevice,
  otherDeviceKeys,
  selectedKeyId,
  isKeyAvailableOnDevice,
  isLoadingLocalKeys,
  isProcessing,
  onSelectKeyId,
  onOpenKeyGen,
}: BulkDuesContextBarProps) {
  return (
    <Panel className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Destination Fund (Active Workspace Fund) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground block">
          Destination Fund
        </label>
        <div className="h-8 px-2.5 bg-muted/20 border border-border/80 rounded-[var(--fintech-radius-sm)] flex items-center justify-between text-xs text-foreground font-mono">
          <span className="font-medium truncate">{currentFundName ?? "Treasury"}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
            {currency}
          </span>
        </div>
      </div>

      {/* Treasurer Signing Key */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-foreground">
            Signing Key
          </label>
          <span className="text-[11px] text-muted-foreground font-mono">
            ECDSA P-256
          </span>
        </div>

        {availableKeysOnDevice.length === 0 && !isLoadingLocalKeys ? (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-[var(--fintech-radius-sm)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>No signing key found on this browser.</span>
            </div>
            {onOpenKeyGen && (
              <Button
                type="button"
                variant="cyber"
                size="sm"
                chamfer="none"
                onClick={onOpenKeyGen}
                className="h-6 text-[10px] px-2 cursor-pointer"
              >
                Generate Key
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <select
              value={selectedKeyId}
              onChange={(e) => onSelectKeyId(e.target.value)}
              disabled={isProcessing}
              className="w-full h-8 px-2.5 bg-background border border-border rounded-[var(--fintech-radius-sm)] text-xs text-foreground font-mono focus:outline-none focus:border-primary cursor-pointer"
            >
              {availableKeysOnDevice.length > 0 && (
                <optgroup label="Available on this device">
                  {availableKeysOnDevice.map((k) => (
                    <option key={k.keyId} value={k.keyId}>
                      ● {k.label ? `${k.label} (${k.keyId.slice(0, 8)}...)` : `Key (${k.keyId.slice(0, 8)}...)`} [Ready]
                    </option>
                  ))}
                </optgroup>
              )}
              {otherDeviceKeys.length > 0 && (
                <optgroup label="Other devices (Missing private key)">
                  {otherDeviceKeys.map((k) => (
                    <option key={k.keyId} value={k.keyId} disabled>
                      ⚠ {k.label ? `${k.label} (${k.keyId.slice(0, 8)}...)` : `Key (${k.keyId.slice(0, 8)}...)`} [No private key]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {isKeyAvailableOnDevice ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Key ready in browser storage</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Selected key is not stored in this browser.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
