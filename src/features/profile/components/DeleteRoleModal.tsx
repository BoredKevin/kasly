import { useState } from "react";
import { useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../../convex/_generated/api";
import { ConfirmDialog } from "../../../ui";
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
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteRole = useMutation(api.roles.deleteRole);

  if (!isOpen || !roleId) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteRole({ roleId });
      onClose();
    } catch {
      // error handled
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={() => {
        void handleDelete();
      }}
      title={`${t("organization.deleteRole")}: ${roleName}`}
      description={`Are you sure you want to permanently delete the role "${roleName}"? It will be stripped from all organization members who currently hold it.`}
      confirmText={t("organization.deleteRole", "Delete Role")}
      variant="danger"
      isLoading={isDeleting}
    />
  );
}
