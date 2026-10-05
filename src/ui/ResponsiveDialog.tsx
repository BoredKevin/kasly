import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@boredkevin/ui";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`w-full ${MAX_WIDTH_MAP[maxWidth]} max-h-[85vh] sm:max-h-[90vh] flex flex-col p-4 sm:p-6 border-border bg-card/95 backdrop-blur-md overflow-hidden ${className}`}
      >
        {(title || description) && (
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            {title && (
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription className="text-xs text-muted-foreground">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 pt-3">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
