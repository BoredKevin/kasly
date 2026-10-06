import React from "react";
import { Panel } from "./Panel";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  onClick,
  className = "",
}: StatCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <Panel
      onClick={onClick}
      className={`p-3.5 sm:p-4 transition-all ${
        isClickable
          ? "cursor-pointer hover:border-primary/50 hover:bg-card active:scale-[0.99]"
          : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground truncate">
          {label}
        </span>
        {icon && <div className="text-muted-foreground/70 shrink-0">{icon}</div>}
      </div>

      <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </div>

      {hint && (
        <div className="mt-1 text-xs text-muted-foreground">
          {hint}
        </div>
      )}
    </Panel>
  );
}
