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
  Input,
  Badge,
} from "@boredkevin/ui";
import {
  Shield,
  X,
  Sparkles,
  Check,
  Palette,
  Layers,
  AlertCircle,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  PERMISSIONS_LIST,
  PRESET_ROLE_COLORS,
} from "../data/permissionsMetadata";

export interface RoleData {
  _id?: Id<"roles">;
  name: string;
  description?: string;
  color?: string;
  position: number;
  permissions: string[];
  isDefault?: boolean;
  isSystem?: boolean;
}

interface RoleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: Id<"organizations">;
  initialRole?: RoleData | null;
  suggestedPosition?: number;
}

function RoleEditorForm({
  organizationId,
  initialRole,
  suggestedPosition = 1,
  onClose,
}: {
  organizationId: Id<"organizations">;
  initialRole?: RoleData | null;
  suggestedPosition?: number;
  onClose: () => void;
}) {
  const isEditing = Boolean(initialRole?._id);
  const isDefault = Boolean(initialRole?.isDefault);

  const [name, setName] = useState(initialRole?.name || "");
  const [description, setDescription] = useState(initialRole?.description || "");
  const [color, setColor] = useState(initialRole?.color || PRESET_ROLE_COLORS[0]);
  const [position, setPosition] = useState(
    initialRole ? (initialRole.position ?? 1) : suggestedPosition,
  );
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    initialRole?.permissions || [
      "VIEW_ORGANIZATION",
      "CREATE_CONTENT",
      "CREATE_INVITES",
    ],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRole = useMutation(api.roles.create);
  const updateRole = useMutation(api.roles.update);

  const togglePermission = (permKey: string) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(permKey)) {
        return prev.filter((p) => p !== permKey);
      } else {
        return [...prev, permKey];
      }
    });
  };

  const handleSelectAllCategory = (categoryKeys: string[]) => {
    const allSelected = categoryKeys.every((k) => selectedPermissions.includes(k));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((k) => !categoryKeys.includes(k)));
    } else {
      setSelectedPermissions((prev) => Array.from(new Set([...prev, ...categoryKeys])));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && initialRole?._id) {
        await updateRole({
          roleId: initialRole._id,
          name: isDefault ? undefined : name.trim(),
          description: description.trim() ? description.trim() : undefined,
          color: color ? color : undefined,
          position: isDefault ? 0 : Number(position),
          permissions: selectedPermissions as any,
        });
      } else {
        await createRole({
          organizationId,
          name: name.trim(),
          description: description.trim() ? description.trim() : undefined,
          color: color ? color : undefined,
          position: Number(position),
          permissions: selectedPermissions as any,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An error occurred while saving the role.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ["Admin", "Treasury", "Management", "Moderation", "General"] as const;

  return (
    <Card telemetry="ORG.ROLE.EDIT" cornerLines className="bg-card border-border shadow-2xl">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-none border text-primary"
              style={{
                borderColor: `${color}40`,
                backgroundColor: `${color}15`,
                color: color,
              }}
            >
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <span>{isEditing ? `Edit Role: ${initialRole?.name}` : "Create New Role"}</span>
                {isDefault && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    DEFAULT ROLE
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {isEditing
                  ? "Update role attributes, permissions, and hierarchy rank"
                  : "Define role authority and assignable privileges"}
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

      <CardContent className="pt-4 max-h-[75vh] overflow-y-auto space-y-4">
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          {/* Role Name & Hierarchy Level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Role Name *
              </label>
              <Input
                type="text"
                placeholder="e.g. Moderator, Squad Lead"
                value={name}
                onChange={(e) => setName(e.target.value)}
                chamfer="dual"
                disabled={isDefault}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> Position Rank
              </label>
              <Input
                type="number"
                min={isDefault ? 0 : 1}
                max={9999}
                value={position}
                onChange={(e) => setPosition(Number(e.target.value))}
                chamfer="dual"
                disabled={isDefault}
                required
              />
            </div>
          </div>

          {/* Role Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              Description
            </label>
            <Input
              type="text"
              placeholder="Role responsibilities and purpose"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              chamfer="dual"
            />
          </div>

          {/* Role Color Picker */}
          <div className="space-y-2 p-3 bg-muted/20 border border-border/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Role Color
              </label>
              <span
                className="font-mono text-xs px-2 py-0.5 border"
                style={{ color: color, borderColor: `${color}60` }}
              >
                {color}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_ROLE_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  className={`w-6 h-6 rounded-none transition-transform flex items-center justify-center border cursor-pointer ${
                    color.toLowerCase() === preset.toLowerCase()
                      ? "scale-110 border-white shadow-sm ring-1 ring-primary"
                      : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: preset }}
                >
                  {color.toLowerCase() === preset.toLowerCase() && (
                    <Check className="w-3.5 h-3.5 text-black drop-shadow" />
                  )}
                </button>
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-6 h-6 p-0 bg-transparent border-0 cursor-pointer"
                title="Custom color picker"
              />
            </div>
          </div>

          {/* Permissions Checklist */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between border-b border-border pb-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-primary" /> Role Permissions
              </label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {selectedPermissions.length} selected
              </span>
            </div>

            <div className="space-y-3">
              {categories.map((category) => {
                const categoryPerms = PERMISSIONS_LIST.filter(
                  (p) => p.category === category,
                );
                const categoryKeys = categoryPerms.map((p) => p.key);
                const allCategorySelected = categoryKeys.every((k) =>
                  selectedPermissions.includes(k),
                );

                return (
                  <div
                    key={category}
                    className="p-3 bg-background/50 border border-border/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono text-[10px]">
                        {category} Privileges
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllCategory(categoryKeys)}
                        className="text-[10px] text-primary hover:underline font-mono cursor-pointer"
                      >
                        {allCategorySelected ? "Deselect Category" : "Select Category"}
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {categoryPerms.map((perm) => {
                        const isChecked = selectedPermissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2 border transition-colors cursor-pointer ${
                              isChecked
                                ? "bg-primary/10 border-primary/40 text-foreground"
                                : "bg-muted/10 border-border/60 hover:bg-muted/30 text-muted-foreground"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => togglePermission(perm.key)}
                              className="mt-0.5 rounded-none text-primary focus:ring-0 cursor-pointer"
                            />
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-foreground">
                                  {perm.name}
                                </span>
                                {perm.key === "ADMINISTRATOR" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-400 font-mono"
                                  >
                                    CRITICAL
                                  </Badge>
                                )}
                                {perm.key === "SIGN_TREASURY" && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[9px] px-1 py-0 bg-primary/15 text-primary border-primary/30 font-mono"
                                  >
                                    ECDSA SIGNER
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                {perm.description}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive font-mono text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
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
              disabled={isSubmitting || !name.trim()}
              className="text-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isEditing ? "Save Role Changes" : "Create Role"}</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function RoleEditorModal(props: RoleEditorModalProps) {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-xl my-8">
        <RoleEditorForm
          key={props.initialRole?._id ?? "new-role"}
          organizationId={props.organizationId}
          initialRole={props.initialRole}
          suggestedPosition={props.suggestedPosition}
          onClose={props.onClose}
        />
      </div>
    </div>
  );
}
