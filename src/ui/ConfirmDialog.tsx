import React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@boredkevin/ui";
import { AlertTriangle, Trash2, Ban, X } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  isLoading?: boolean;
  error?: string | null;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isLoading = false,
  error = null,
}: ConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case "danger":
        return <Trash2 className="w-5 h-5 text-rose-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default:
        return <Ban className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in-0" />
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
          <DialogPrimitive.Content className="pointer-events-auto relative w-full sm:max-w-md bg-card border-t sm:border border-border/80 rounded-t-[var(--fintech-radius-lg)] sm:rounded-[var(--fintech-radius-lg)] shadow-2xl p-5 flex flex-col focus:outline-none transition-all duration-200 animate-in slide-in-from-bottom-4 sm:zoom-in-95">
            <DialogPrimitive.Close
              className="absolute right-4 top-4 p-1.5 rounded-[var(--fintech-radius-xs)] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </DialogPrimitive.Close>

            <div className="space-y-3 pr-6">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg border ${
                    variant === "danger"
                      ? "bg-rose-500/10 border-rose-500/30"
                      : variant === "warning"
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-primary/10 border-primary/30"
                  }`}
                >
                  {getIcon()}
                </div>
                <div>
                  <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                    {title}
                  </DialogPrimitive.Title>
                </div>
              </div>
              <DialogPrimitive.Description className="text-xs text-muted-foreground leading-relaxed">
                {description}
              </DialogPrimitive.Description>
            </div>

            {error && (
              <div className="p-2.5 mt-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                size="sm"
                chamfer="none"
                disabled={isLoading}
                onClick={onClose}
                className="text-xs cursor-pointer"
              >
                {cancelText}
              </Button>
              <Button
                type="button"
                variant={variant === "danger" ? "destructive" : "cyber"}
                size="sm"
                chamfer="none"
                disabled={isLoading}
                onClick={() => void onConfirm()}
                className="text-xs cursor-pointer"
              >
                {isLoading ? "Processing..." : confirmText}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
