import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export interface CodeTextProps {
  value: string;
  truncateMiddle?: boolean;
  truncateLength?: number;
  copyable?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function CodeText({
  value,
  truncateMiddle = false,
  truncateLength = 8,
  copyable = false,
  className = "",
  ariaLabel,
}: CodeTextProps) {
  const [copied, setCopied] = useState(false);

  const displayValue =
    truncateMiddle && value.length > truncateLength * 2 + 3
      ? `${value.slice(0, truncateLength)}…${value.slice(-truncateLength)}`
      : value;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failure
    }
  };

  if (!copyable) {
    return (
      <code className={`font-mono text-xs text-foreground/90 select-all ${className}`}>
        {displayValue}
      </code>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Click to copy"}
      aria-label={ariaLabel || `Copy ${value}`}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 font-mono text-xs text-foreground/90 bg-muted/30 hover:bg-muted/60 border border-border/60 hover:border-border rounded transition-colors cursor-pointer select-none group ${className}`}
    >
      <span>{displayValue}</span>
      {copied ? (
        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground shrink-0 transition-colors" />
      )}
    </button>
  );
}
