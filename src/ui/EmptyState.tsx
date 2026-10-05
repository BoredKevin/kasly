import React from "react";
import { Panel } from "./Panel";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <Panel className={`p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-3 ${className}`}>
      {icon && (
        <div className="p-3 rounded-full bg-muted/40 border border-border/80 text-muted-foreground mb-1">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-sm">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </Panel>
  );
}
