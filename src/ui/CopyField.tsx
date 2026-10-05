import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@boredkevin/ui";

export interface CopyFieldProps {
  label?: string;
  value: string;
  truncateMiddle?: boolean;
  truncateLength?: number;
  className?: string;
}

export function CopyField({
  label,
  value,
  truncateMiddle = false,
  truncateLength = 10,
  className = "",
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  const displayValue =
    truncateMiddle && value.length > truncateLength * 2 + 3
      ? `${value.slice(0, truncateLength)}…${value.slice(-truncateLength)}`
      : value;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  return (
    <div className={`p-2.5 bg-muted/20 border border-border/70 rounded-[var(--fintech-radius-sm)] space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">{label}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <code className="text-xs font-mono text-foreground break-all select-all">
          {displayValue}
        </code>
        {!label && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy value"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
