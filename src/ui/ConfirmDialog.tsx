import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@boredkevin/ui";
import { AlertTriangle, Trash2, Ban } from "lucide-react";

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-border bg-card/95 backdrop-blur-md p-5">
        <DialogHeader className="space-y-3">
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
              <DialogTitle className="text-base font-semibold text-foreground">
                {title}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded">
            {error}
          </div>
        )}

        <DialogFooter className="mt-4 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
            className="text-xs cursor-pointer"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "destructive" : "default"}
            size="sm"
            chamfer="dual"
            disabled={isLoading}
            onClick={() => void onConfirm()}
            className="text-xs cursor-pointer"
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
