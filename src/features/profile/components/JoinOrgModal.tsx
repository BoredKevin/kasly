import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  Building2,
  X,
  LogIn,
  User,
  AlertCircle,
  Plus,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface JoinOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (orgId: Id<"organizations">) => void;
}

export function JoinOrgModal({
  isOpen,
  onClose,
  onSuccess,
}: JoinOrgModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanCode = code.trim();
  const invitePreview = useQuery(
    api.invites.get,
    cleanCode.length >= 4 ? { code: cleanCode } : "skip",
  );

  const acceptInvite = useMutation(api.invites.accept);

  if (!isOpen || typeof document === "undefined") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanCode) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await acceptInvite({ code: cleanCode });
      setCode("");
      onSuccess(result.organizationId);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to join organization.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="ORG.INVITE.JOIN" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <LogIn className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    {t("organization.joinOrg")}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Enter an invitation code to join a workspace
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                chamfer="dual"
                onClick={onClose}
                className="h-7 w-7 p-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-4 space-y-4">
            <form
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  {t("organization.inviteCode")} *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. abcd1234"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  chamfer="dual"
                  className="font-mono text-sm tracking-wider"
                  autoFocus
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter the 8-character invite code provided by the workspace admin
                </p>
              </div>

              {/* Real-time Organization Preview */}
              {invitePreview && (
                <div className="p-3.5 bg-background/60 border border-primary/40 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      {invitePreview.organizationName}
                    </span>
                    <Badge variant="outline" className="text-[9px] font-mono text-emerald-400 border-emerald-500/30">
                      VALID INVITE
                    </Badge>
                  </div>

                  {invitePreview.organizationDescription && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {invitePreview.organizationDescription}
                    </p>
                  )}

                  <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Invited by {invitePreview.inviterName || "Member"}
                    </span>
                    <span className="font-mono text-[10px]">
                      {invitePreview.maxUses
                        ? `${invitePreview.uses}/${invitePreview.maxUses} uses`
                        : "Unlimited uses"}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive text-xs font-mono flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  onClick={onClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={isSubmitting || !cleanCode}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? t("common.loading") : t("organization.joinOrg")}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
