import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import { Building2, X, Sparkles, AlertTriangle } from "lucide-react";
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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md">
        <Card telemetry="ORG.CREATE" cornerLines className="bg-card border-border shadow-2xl">
          <CardHeader className="pb-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-primary/10 border border-primary/20 text-primary">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">
                    Create Organization
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Establish a new organization workspace
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

          <CardContent className="pt-5">
            {isCreationDisabled && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
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
                  Organization Name *
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Cyberdine Systems"
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
                  chamfer="dual"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Organization Slug
                </label>
                <Input
                  type="text"
                  placeholder="e.g. cyberdine-systems"
                  value={slug}
                  disabled={isCreationDisabled || isSubmitting}
                  onChange={(e) => setSlug(e.target.value)}
                  chamfer="dual"
                />
                <p className="text-[11px] text-muted-foreground">
                  Unique identifier used in URLs and invitations
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Description
                </label>
                <Input
                  type="text"
                  placeholder="Brief organization purpose"
                  value={description}
                  disabled={isCreationDisabled || isSubmitting}
                  onChange={(e) => setDescription(e.target.value)}
                  chamfer="dual"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive-foreground text-xs font-mono">
                  {error}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  chamfer="dual"
                  onClick={onClose}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="cyber"
                  chamfer="dual"
                  size="sm"
                  disabled={isCreationDisabled || isSubmitting || !name.trim()}
                  className="text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span>Creating...</span>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create Workspace</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
