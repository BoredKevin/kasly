import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Button,
  Input,
} from "@boredkevin/ui";
import { ResponsiveDialog } from "../../../ui";
import {
  Copy,
  Check,
  Clock,
  Users,
  Sparkles,
  Link,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface CreateInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  organizationName: string;
}

export function CreateInviteModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
}: CreateInviteModalProps) {
  const { t } = useTranslation();
  const [expiresIn, setExpiresIn] = useState<string>("86400000"); // 1 day
  const [maxUses, setMaxUses] = useState<string>(""); // Unlimited
  const [selectedRoleIds, setSelectedRoleIds] = useState<Id<"roles">[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvite = useMutation(api.invites.create);
  const roles = useQuery(api.roles.list, { organizationId });
  const myMembership = useQuery(api.members.getMyMembership, { organizationId });

  const canManageRoles =
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_ROLES");

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const expiresInMs = expiresIn === "0" ? undefined : Number(expiresIn);
      const usesLimit = maxUses.trim() ? Number(maxUses) : undefined;

      const result = await createInvite({
        organizationId,
        expiresInMs,
        maxUses: usesLimit,
        roleIds: selectedRoleIds.length > 0 ? selectedRoleIds : undefined,
      });

      setGeneratedCode(result.code);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to generate invite.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleReset = () => {
    setGeneratedCode(null);
    setCopied(false);
    setError(null);
  };

  const assignableRoles = roles?.filter((r) => !r.isDefault) ?? [];

  return (
    <ResponsiveDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Invite to ${organizationName}`}
      description="Generate an invitation code for new members"
      maxWidth="md"
    >
      <div className="pt-1">
        {generatedCode ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-muted/20 border border-primary/30 rounded-[var(--fintech-radius-md)] text-center space-y-3">
              <span className="text-xs text-muted-foreground font-mono">
                YOUR INVITATION CODE
              </span>
              <div className="p-3 bg-muted/40 border border-border font-mono text-2xl font-bold tracking-widest text-primary select-all rounded-[var(--fintech-radius-sm)]">
                {generatedCode}
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with members so they can join{" "}
                <strong className="text-foreground">{organizationName}</strong>.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button
                type="button"
                variant="cyber"
                chamfer="none"
                size="sm"
                onClick={() => {
                  void handleCopy();
                }}
                className="flex-1 text-xs flex items-center justify-center gap-1.5 h-9 cursor-pointer font-semibold"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                chamfer="none"
                size="sm"
                onClick={handleReset}
                className="text-xs h-9 cursor-pointer"
              >
                Create Another
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              void handleGenerate(e);
            }}
            className="space-y-4"
          >
            {/* Expiration dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Expire After
              </label>
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="w-full h-9 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary rounded-[var(--fintech-radius-sm)] cursor-pointer"
              >
                <option value="1800000">30 minutes</option>
                <option value="21600000">6 hours</option>
                <option value="86400000">1 day (24 hours)</option>
                <option value="604800000">7 days</option>
                <option value="0">Never expire</option>
              </select>
            </div>

            {/* Collapsible Limits & Roles */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors py-1 cursor-pointer"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
                <span>{showAdvanced ? "Hide advanced options" : "+ Max Uses & Auto-Grant Roles (Optional)"}</span>
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-2 pl-3 border-l-2 border-border/60 animate-in fade-in-50 duration-150">
                  {/* Max uses input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" /> Max Number of Uses
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      placeholder="Unlimited (leave empty)"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      chamfer="none"
                      className="text-xs h-9"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Leave blank for unlimited joins
                    </p>
                  </div>

                  {/* Auto-granted roles selector */}
                  {canManageRoles && assignableRoles.length > 0 && (
                    <div className="space-y-1.5 p-3 bg-muted/20 border border-border/60 rounded-[var(--fintech-radius-sm)]">
                      <label className="text-xs font-medium text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-primary" /> Auto-Grant Roles on Join
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          OPTIONAL
                        </span>
                      </label>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {assignableRoles.map((role) => {
                          const isSelected = selectedRoleIds.includes(role._id);
                          return (
                            <button
                              key={role._id}
                              type="button"
                              onClick={() => {
                                setSelectedRoleIds((prev) =>
                                  isSelected
                                    ? prev.filter((id) => id !== role._id)
                                    : [...prev, role._id],
                                );
                              }}
                              className={`px-2 py-1 text-[11px] font-mono border rounded-[var(--fintech-radius-sm)] transition-colors cursor-pointer ${
                                isSelected
                                  ? "bg-primary/20 border-primary text-foreground font-semibold"
                                  : "bg-background border-border/70 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {role.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                disabled={isSubmitting}
                className="text-xs flex items-center justify-center gap-1.5 cursor-pointer font-semibold"
              >
                <Link className="w-3.5 h-3.5" />
                <span>{isSubmitting ? t("common.loading") : t("organization.createInvite")}</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </ResponsiveDialog>
  );
}
