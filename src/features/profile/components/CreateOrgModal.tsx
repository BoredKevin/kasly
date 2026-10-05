import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Button,
  Input,
} from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import { Sparkles, AlertTriangle, ChevronDown } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orgId: Id<"organizations">) => void;
}

export function CreateOrgModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrgModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appSettings = useQuery(api.appSettings.get);
  const isCreationDisabled = appSettings?.allowOrganizationCreation === false;

  const createOrg = useMutation(api.organizations.create);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreationDisabled) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const orgId = await createOrg({
        name: name.trim(),
        slug: slug.trim() ? slug.trim() : undefined,
        description: description.trim() ? description.trim() : undefined,
      });

      setName("");
      setSlug("");
      setDescription("");
      setShowAdvanced(false);
      onSuccess?.(orgId);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("organization.createOrg", "Create Organization")}
      description="Establish a new organization workspace"
      maxWidth="md"
    >
      <div className="pt-1">
        {isCreationDisabled && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5 rounded-[var(--fintech-radius-sm)]">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Organization Creation Disabled
              </p>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Organization creation is currently disabled by system policy. You can still join existing organizations via invite code.
              </p>
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {t("organization.orgName")} *
            </label>
            <Input
              type="text"
              placeholder="e.g. Cravion Class, Robotics Club"
              value={name}
              disabled={isCreationDisabled || isSubmitting}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) {
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                  );
                }
              }}
              chamfer="none"
              required
              autoFocus
            />
          </div>

          {/* Advanced: Slug & Description */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors py-1 cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
              <span>{showAdvanced ? "Hide settings" : "+ Slug & Description (Optional)"}</span>
              {!showAdvanced && slug && <span className="text-[10px] font-mono text-primary ml-1">({slug})</span>}
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-2 pl-3 border-l-2 border-border/60 animate-in fade-in-50 duration-150">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {t("organization.orgSlug")}
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. cravion-class"
                    value={slug}
                    disabled={isCreationDisabled || isSubmitting}
                    onChange={(e) => setSlug(e.target.value)}
                    chamfer="none"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Unique identifier used in URLs and invitations
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {t("organization.orgDescription")}
                  </label>
                  <Input
                    type="text"
                    placeholder="Brief organization purpose"
                    value={description}
                    disabled={isCreationDisabled || isSubmitting}
                    onChange={(e) => setDescription(e.target.value)}
                    chamfer="none"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono rounded-[var(--fintech-radius-sm)]">
              {error}
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
              disabled={isCreationDisabled || isSubmitting || !name.trim()}
              className="text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
            >
              {isSubmitting ? (
                <span>{t("common.loading")}</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t("organization.createOrg")}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ResponsiveDialog>
  );
}
