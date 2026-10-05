import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@boredkevin/ui";

export interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  actions?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search...",
  filters = [],
  activeFilter,
  onFilterChange,
  actions,
  className = "",
}: FilterBarProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 pl-8.5 pr-8 text-xs bg-background/80 border-border/80 rounded-[var(--fintech-radius-sm)] focus:border-primary/80"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {filters.length > 0 && onFilterChange && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none select-none">
          {filters.map((f) => {
            const isActive = activeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterChange(f.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-[var(--fintech-radius-sm)] border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/60"
                }`}
              >
                <span>{f.label}</span>
                {f.count !== undefined && (
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full font-mono font-bold ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
