import { useState } from "react";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
} from "@boredkevin/ui";
import {
  Shield,
  Sparkles,
  Layers,
  Plus,
  Edit3,
  Trash2,
  Lock,
} from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { RoleEditorModal, RoleData } from "./RoleEditorModal";
import { DeleteRoleModal } from "./DeleteRoleModal";

interface OrganizationRolesListProps {
  organizationId: Id<"organizations">;
}

export function OrganizationRolesList({
  organizationId,
}: OrganizationRolesListProps) {
  const { t } = useTranslation();
  const roles = useQuery(api.roles.list, { organizationId });
  const myMembership = useQuery(api.members.getMyMembership, { organizationId });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<{ id: Id<"roles">; name: string } | null>(null);

  const canManageRoles =
    myMembership?.isOwner ||
    myMembership?.permissions.includes("ADMINISTRATOR") ||
    myMembership?.permissions.includes("MANAGE_ROLES");

  const highestPosition = roles && roles.length > 0
    ? Math.max(...roles.map((r) => r.position)) + 1
    : 1;

  if (roles === undefined) {
    return (
      <div className="p-6 text-center text-xs text-muted-foreground animate-pulse">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <>
      <Card telemetry="ORG.ROLES" cornerLines className="w-full bg-card/60 backdrop-blur-sm border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-none bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight">
                  {t("organization.roles")}
                </CardTitle>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                {roles.length} {roles.length === 1 ? "ROLE" : "ROLES"}
              </Badge>

              {canManageRoles && (
                <Button
                  variant="cyber"
                  size="sm"
                  chamfer="dual"
                  onClick={() => {
                    setEditingRole(null);
                    setIsEditorOpen(true);
                  }}
                  className="text-xs flex items-center gap-1.5 h-8"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("organization.roles")}</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {roles.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No roles configured for this organization.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roles.map((role) => {
                const roleColor =
                  role.color || (role.isDefault ? "#94a3b8" : "#818cf8");

                return (
                  <div
                    key={role._id}
                    className="p-3.5 bg-background/50 border border-border/80 flex flex-col justify-between gap-3 transition-colors hover:border-border"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: roleColor }}
                          />
                          <span
                            className="font-semibold text-xs truncate"
                            style={{ color: roleColor }}
                          >
                            {role.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {role.isDefault && (
                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0 font-mono text-muted-foreground"
                            >
                              DEFAULT
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="text-[9px] px-1 py-0 font-mono"
                          >
                            LVL {role.position}
                          </Badge>
                        </div>
                      </div>

                      {role.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {role.description}
                        </p>
                      )}
                    </div>

                    {/* Permissions summary and action buttons */}
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Shield className="w-3 h-3 text-primary" />
                        <span>{role.permissions.length} perms</span>
                        {role.permissions.includes("ADMINISTRATOR") && (
                          <span className="inline-flex items-center gap-0.5 text-amber-400 font-mono text-[9px]">
                            <Sparkles className="w-2.5 h-2.5" /> ADMIN
                          </span>
                        )}
                      </div>

                      {canManageRoles && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            chamfer="dual"
                            onClick={() => {
                              setEditingRole(role);
                              setIsEditorOpen(true);
                            }}
                            className="h-6 w-6 p-0 hover:text-foreground"
                            title="Edit Role"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>

                          {!role.isDefault && !role.isSystem ? (
                            <Button
                              variant="outline"
                              size="sm"
                              chamfer="dual"
                              onClick={() => {
                                setDeletingRole({ id: role._id, name: role.name });
                                setIsDeleteOpen(true);
                              }}
                              className="h-6 w-6 p-0 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                              title="Delete Role"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          ) : (
                            <div
                              className="h-6 w-6 flex items-center justify-center text-muted-foreground/40"
                              title="Protected Role"
                            >
                              <Lock className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RoleEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingRole(null);
        }}
        organizationId={organizationId}
        initialRole={editingRole}
        suggestedPosition={highestPosition}
      />

      <DeleteRoleModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingRole(null);
        }}
        roleId={deletingRole?.id ?? null}
        roleName={deletingRole?.name ?? ""}
      />
    </>
  );
}
