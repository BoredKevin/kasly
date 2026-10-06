import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@boredkevin/ui";

export interface PageHeaderProps {
  title: string;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  backLabel?: string;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  onBack,
  backLabel = "Back",
  badge,
  className = "",
}: PageHeaderProps) {
  return (
    <div className={`space-y-2 pb-4 border-b border-border/60 ${className}`}>
      {onBack && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 -ml-2 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {description && (
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </div>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
