import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface ResponsiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

const MAX_WIDTH_MAP = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

export function ResponsiveDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "lg",
  className = "",
}: ResponsiveDialogProps) {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop Overlay */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in-0" />

        {/* Positioning Container: Bottom-sheet on mobile, centered modal on desktop */}
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
          <DialogPrimitive.Content
            className={`pointer-events-auto relative w-full ${MAX_WIDTH_MAP[maxWidth]} bg-card border-t sm:border border-border/80 rounded-t-[var(--fintech-radius-lg)] sm:rounded-[var(--fintech-radius-lg)] shadow-2xl flex flex-col p-4 sm:p-6 max-h-[90vh] sm:max-h-[85vh] overflow-hidden focus:outline-none transition-all duration-200 animate-in slide-in-from-bottom-4 sm:zoom-in-95 ${className}`}
          >
            {/* Header */}
            {(title || description) && (
              <div className="pb-3 border-b border-border/60 shrink-0 pr-8 space-y-1">
                {title && (
                  <DialogPrimitive.Title className="text-base font-semibold text-foreground tracking-tight">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="text-xs text-muted-foreground leading-relaxed">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
            )}

            {/* Close Button */}
            <DialogPrimitive.Close
              className="absolute right-4 top-4 p-1.5 rounded-[var(--fintech-radius-xs)] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 pt-3">
              {children}
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
