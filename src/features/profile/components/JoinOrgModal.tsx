import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Button,
  Input,
  Badge,
} from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import {
  Building2,
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

  if (!isOpen) return null;

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

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("organization.joinOrg", "Join Organization")}
      description="Enter an invitation code to join a workspace"
      maxWidth="md"
    >
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-4 pt-1"
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
            chamfer="none"
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
          <div className="p-3.5 bg-background/60 border border-primary/40 rounded-[var(--fintech-radius-sm)] space-y-2 animate-in fade-in duration-200">
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
          <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive text-xs font-mono flex items-center gap-1.5 rounded-[var(--fintech-radius-sm)]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="pt-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            chamfer="none"
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
            chamfer="none"
            size="sm"
            disabled={isSubmitting || !cleanCode}
            className="text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isSubmitting ? t("common.loading") : t("organization.joinOrg")}</span>
          </Button>
        </div>
      </form>
    </ResponsiveDialog>
  );
}
