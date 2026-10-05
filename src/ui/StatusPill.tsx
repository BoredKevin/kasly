import React from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  dot?: boolean;
}

const TONE_STYLES: Record<StatusTone, { badge: string; dot: string }> = {
  neutral: {
    badge: "bg-muted/40 text-muted-foreground border-border/80",
    dot: "bg-muted-foreground/80",
  },
  success: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  warning: {
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
  danger: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    dot: "bg-rose-400",
  },
  info: {
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    dot: "bg-sky-400",
  },
};

export function StatusPill({
  tone = "neutral",
  icon,
  children,
  dot = true,
  className = "",
  ...props
}: StatusPillProps) {
  const styles = TONE_STYLES[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded-[6px] select-none ${styles.badge} ${className}`}
      {...props}
    >
      {dot && !icon && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} aria-hidden="true" />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}
