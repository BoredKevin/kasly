import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@boredkevin/ui";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface DeleteRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: Id<"roles"> | null;
  roleName: string;
}

export function DeleteRoleModal({
  isOpen,
  onClose,
  roleId,
  roleName,
}: DeleteRoleModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteRole = useMutation(api.roles.deleteRole);

  if (!isOpen || !roleId) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await deleteRole({ roleId });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete the role.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="ORG.ROLE.DELETE" cornerLines className="bg-card border-destructive/40 shadow-2xl">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-destructive/15 border border-destructive/30 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-destructive">
                    Delete Role: {roleName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    This action cannot be undone
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete the role{" "}
              <strong className="text-foreground">{roleName}</strong>? It will
              be stripped from all organization members who currently hold it.
            </p>

            {error && (
              <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive text-xs font-mono">
                {error}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                chamfer="dual"
                onClick={onClose}
                disabled={isDeleting}
                size="sm"
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                chamfer="dual"
                size="sm"
                disabled={isDeleting}
                onClick={() => {
                  void handleDelete();
                }}
                className="text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Delete Role"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
