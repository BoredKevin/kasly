import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Button } from "@boredkevin/ui";

export function SignOutButton() {
  const { t } = useTranslation();
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    setLocation("/login", { replace: true });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      chamfer="dual"
      onClick={() => void handleSignOut()}
    >
      {t("nav.signOut")}
    </Button>
  );
}
