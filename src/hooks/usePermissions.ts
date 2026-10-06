import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function usePermissions(organizationId?: Id<"organizations"> | null) {
  const membership = useQuery(
    api.members.getMyMembership,
    organizationId ? { organizationId } : "skip"
  );

  return useMemo(() => {
    const isOwner = Boolean(membership?.isOwner);
    const perms = membership?.permissions ?? [];
    const isAdmin = isOwner || perms.includes("ADMINISTRATOR");

    const canSign = isAdmin || perms.includes("SIGN_TREASURY");
    const canManageTreasury = isAdmin || perms.includes("MANAGE_TREASURY");
    const canViewTreasury = isAdmin || perms.includes("VIEW_TREASURY");
    const canManageRoles = isAdmin || perms.includes("MANAGE_ROLES");
    const canViewInvites = isAdmin || perms.includes("CREATE_INVITES") || perms.includes("MANAGE_INVITES");
    const canManageMembers = isAdmin || perms.includes("MANAGE_MEMBERS");

    return {
      membership,
      isLoading: organizationId ? membership === undefined : false,
      isOwner,
      isAdmin,
      canSign,
      canManageTreasury,
      canAdmin: canManageTreasury,
      canManage: canManageTreasury,
      canViewTreasury,
      canManageRoles,
      canViewInvites,
      canManageMembers,
    };
  }, [membership, organizationId]);
}
