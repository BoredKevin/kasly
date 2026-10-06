import React from "react";

export interface SettingRowProps {
  icon?: React.ReactNode;
  title: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function SettingRow({
  icon,
  title,
  description,
  action,
  badge,
  onClick,
  className = "",
  children,
}: SettingRowProps) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`p-3.5 sm:p-4 border-b border-border/60 last:border-b-0 flex flex-col gap-2 transition-colors ${
        isClickable ? "cursor-pointer hover:bg-muted/10 active:bg-muted/20" : ""
      } ${className}`}
    >
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          {icon && (
            <div className="p-2 rounded-lg bg-muted/30 border border-border/60 text-muted-foreground shrink-0 mt-0.5 sm:mt-0">
              {icon}
            </div>
          )}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {title}
              </span>
              {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {description && (
              <div className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </div>
            )}
          </div>
        </div>

        {action && <div className="shrink-0 self-center">{action}</div>}
      </div>

      {children && <div className="mt-2 pt-2 border-t border-border/40">{children}</div>}
    </div>
  );
}
