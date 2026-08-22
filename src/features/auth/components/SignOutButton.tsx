import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@boredkevin/ui";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      chamfer="dual"
      onClick={() => void signOut()}
    >
      Sign out
    </Button>
  );
}
