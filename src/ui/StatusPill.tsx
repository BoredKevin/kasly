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
    badge:
      "bg-[hsl(var(--status-neutral-bg))] text-[hsl(var(--status-neutral))] border-[hsl(var(--status-neutral-border))]",
    dot: "bg-[hsl(var(--status-neutral))]",
  },
  success: {
    badge:
      "bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success))] border-[hsl(var(--status-success-border))]",
    dot: "bg-[hsl(var(--status-success))]",
  },
  warning: {
    badge:
      "bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning-border))]",
    dot: "bg-[hsl(var(--status-warning))]",
  },
  danger: {
    badge:
      "bg-[hsl(var(--status-danger-bg))] text-[hsl(var(--status-danger))] border-[hsl(var(--status-danger-border))]",
    dot: "bg-[hsl(var(--status-danger))]",
  },
  info: {
    badge:
      "bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info))] border-[hsl(var(--status-info-border))]",
    dot: "bg-[hsl(var(--status-info))]",
  },
};

export function StatusPill({
  tone = "neutral",
  icon,
  children,
  dot = false,
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
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`}
          aria-hidden="true"
        />
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}
