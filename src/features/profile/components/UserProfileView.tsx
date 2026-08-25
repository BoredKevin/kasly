import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { UserIdentityCard } from "./UserIdentityCard";
import { AuthSettingsCard } from "./AuthSettingsCard";

export function UserProfileView() {
  const viewer = useQuery(api.users.viewer);

  if (viewer === undefined) {
    return (
      <div className="w-full flex items-center justify-center py-20 text-muted-foreground text-sm font-mono animate-pulse">
        Initializing user profile session...
      </div>
    );
  }

  if (viewer === null) {
    return (
      <div className="w-full text-center py-12 text-sm text-destructive">
        Session expired or unauthenticated. Please sign in again.
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Personal Profile
        </h2>
        <p className="text-xs text-muted-foreground">
          Manage your account credentials, personal identity, and authentication security
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserIdentityCard user={viewer} />
        <AuthSettingsCard key={viewer.email ?? "no-email"} email={viewer.email} />
      </div>
    </div>
  );
}
