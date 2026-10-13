import { Id } from "../../../../../convex/_generated/dataModel";
import { KeyRound, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";

export interface FundOption {
  _id: Id<"funds">;
  name: string;
  currency: string;
}

export interface KeyOption {
  keyId: string;
  label?: string;
  revokedAt?: number;
}

export interface AdvancedSigningOptionsProps {
  funds: FundOption[] | undefined;
  selectedFundId: Id<"funds"> | null;
  defaultFundId: Id<"funds"> | null;
  currentFundName?: string;
  selectedKeyId: string;
  availableKeysOnDevice: KeyOption[];
  otherDeviceKeys: KeyOption[];
  isKeyAvailableOnDevice: boolean;
  isSigning: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onFundChange: (fundId: Id<"funds">) => void;
  onKeyChange: (keyId: string) => void;
}

export function AdvancedSigningOptions({
  funds,
  selectedFundId,
  defaultFundId,
  currentFundName,
  selectedKeyId,
  availableKeysOnDevice,
  otherDeviceKeys,
  isKeyAvailableOnDevice,
  isSigning,
  showAdvanced,
  onToggleAdvanced,
  onFundChange,
  onKeyChange,
}: AdvancedSigningOptionsProps) {
  return (
    <div className="pt-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
        <span className="truncate max-w-[200px]">
          Fund: <strong className="text-foreground">{currentFundName ?? "Default"}</strong>
        </span>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="text-primary hover:underline flex items-center gap-1 cursor-pointer shrink-0 ml-2"
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>{showAdvanced ? "Hide Options" : "Advanced Options"}</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-2.5 p-3 bg-muted/20 border border-border/70 rounded-[var(--fintech-radius-sm)] space-y-3.5 animate-in fade-in-50 duration-150">
          {/* Target Destination Fund Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Destination Fund *
              </label>
              {selectedFundId === defaultFundId && defaultFundId && (
                <span className="text-[10px] font-mono text-primary px-1.5 py-0.5 bg-primary/10 border border-primary/20">
                  Auto-selected
                </span>
              )}
            </div>
            {funds && funds.length > 0 ? (
              <select
                value={selectedFundId ?? ""}
                onChange={(e) => onFundChange(e.target.value as Id<"funds">)}
                disabled={isSigning}
                className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer rounded-[var(--fintech-radius-xs)]"
                required
              >
                {funds.map((fund) => (
                  <option key={fund._id} value={fund._id}>
                    {fund.name} ({fund.currency})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-xs text-muted-foreground italic py-1">
                No active funds available.
              </div>
            )}
          </div>

          {/* Signing Key Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Treasurer Signing Key *</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ECDSA P-256
              </span>
            </label>
            <select
              value={selectedKeyId}
              onChange={(e) => onKeyChange(e.target.value)}
              disabled={isSigning}
              className="w-full h-8 px-2 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer rounded-[var(--fintech-radius-xs)]"
              required
            >
              {availableKeysOnDevice.length > 0 && (
                <optgroup label="Available on this device">
                  {availableKeysOnDevice.map((k) => (
                    <option key={k.keyId} value={k.keyId}>
                      ● {k.label ? `${k.label} (${k.keyId.slice(0, 10)}...)` : `Key (${k.keyId.slice(0, 10)}...)`} [Ready]
                    </option>
                  ))}
                </optgroup>
              )}
              {otherDeviceKeys.length > 0 && (
                <optgroup label="Other devices (Missing private key)">
                  {otherDeviceKeys.map((k) => (
                    <option key={k.keyId} value={k.keyId}>
                      ⚠ {k.label ? `${k.label} (${k.keyId.slice(0, 10)}...)` : `Key (${k.keyId.slice(0, 10)}...)`} [No private key]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {isKeyAvailableOnDevice ? (
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Signing key ready on this device</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-mono">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Private key not found on this device.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
