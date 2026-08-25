import { useState } from "react";
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
} from "@boredkevin/ui";
import {
  UserPlus,
  X,
  Copy,
  Check,
  Clock,
  Users,
  Sparkles,
  Link,
  AlertCircle,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="ORG.INVITE.CREATE" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Invite to {organizationName}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generate an invitation code for new members
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
            {generatedCode ? (
              <div className="space-y-4 animate-in zoom-in-95 duration-200">
                <div className="p-4 bg-background/60 border border-primary/30 text-center space-y-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    YOUR INVITATION CODE
                  </span>
                  <div className="p-3 bg-muted/30 border border-border font-mono text-2xl font-bold tracking-widest text-primary select-all">
                    {generatedCode}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this code with members so they can join{" "}
                    <strong className="text-foreground">{organizationName}</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="cyber"
                    chamfer="dual"
                    size="sm"
                    onClick={() => {
                      void handleCopy();
                    }}
                    className="flex-1 text-xs flex items-center justify-center gap-1.5 h-9 cursor-pointer"
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
                    chamfer="dual"
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
                    className="w-full h-8 px-2.5 bg-background border border-border text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="1800000">30 minutes</option>
                    <option value="21600000">6 hours</option>
                    <option value="86400000">1 day (24 hours)</option>
                    <option value="604800000">7 days</option>
                    <option value="0">Never expire</option>
                  </select>
                </div>

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
                    chamfer="dual"
                    className="text-xs h-8"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Leave blank for unlimited joins
                  </p>
                </div>

                {/* Auto-granted roles selector (optional) */}
                {canManageRoles && assignableRoles.length > 0 && (
                  <div className="space-y-1.5 p-3 bg-muted/20 border border-border/60">
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
                            className={`px-2 py-0.5 text-[11px] font-mono border transition-colors ${isSelected
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
                    disabled={isSubmitting}
                    className="text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Link className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? t("common.loading") : t("organization.createInvite")}</span>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
