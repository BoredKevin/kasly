# Frontend Integration Guide & Best Practices

This guide illustrates how to integrate the React 19 frontend with the Convex backend functions, manage real-time permissions, handle errors, and upload assets.

---

## 1. Convex React Hooks Setup

Kasly uses `@convex-dev/react` and auto-generated API typings from `convex/_generated/api`.

```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
```

---

## 2. Real-Time Data Fetching

### Basic Query Subscription
Queries in Convex are reactive subscriptions. The component automatically re-renders when backend data changes:

```tsx
export function OrganizationHeader({ organizationId }: { organizationId: Id<"organizations"> }) {
  const organization = useQuery(api.organizations.get, { organizationId });

  if (organization === undefined) {
    return <div>Loading organization...</div>; // Query is loading
  }

  if (organization === null) {
    return <div>Organization not found or access denied.</div>;
  }

  return (
    <div className="flex items-center gap-3">
      {organization.iconUrl && (
        <img src={organization.iconUrl} alt={organization.name} className="w-10 h-10 rounded-full" />
      )}
      <h1 className="text-xl font-bold">{organization.name}</h1>
    </div>
  );
}
```

### Conditional Fetching with `"skip"`
To prevent queries from executing when IDs are not yet loaded:

```tsx
const selectedOrgId: Id<"organizations"> | null = ...;

const roles = useQuery(
  api.roles.list,
  selectedOrgId ? { organizationId: selectedOrgId } : "skip"
);
```

---

## 3. Client-Side Permission Checking

To create responsive UI that shows or hides administrative controls based on the current user's role:

```tsx
import { PERMISSIONS, Permission } from "../../convex/permissions";

export function usePermissions(organizationId: Id<"organizations"> | null) {
  const myMember = useQuery(
    api.members.getMyMember,
    organizationId ? { organizationId } : "skip"
  );

  const hasPermission = (permission: Permission): boolean => {
    if (!myMember) return false;
    if (myMember.isOwner) return true;
    if (myMember.permissions.includes(PERMISSIONS.ADMINISTRATOR)) return true;
    return myMember.permissions.includes(permission);
  };

  return {
    isLoading: myMember === undefined,
    myMember,
    hasPermission,
  };
}
```

### Example Usage in Components:
```tsx
export function ServerSettingsButton({ orgId }: { orgId: Id<"organizations"> }) {
  const { hasPermission } = usePermissions(orgId);

  if (!hasPermission(PERMISSIONS.MANAGE_ORGANIZATION)) {
    return null; // Hide button if user lacks permission
  }

  return <button onClick={openSettingsModal}>Server Settings</button>;
}
```

---

## 4. Executing Mutations & Error Handling

Mutations are transactional. If a permission or hierarchy check fails on the backend, the mutation throws an `Error` that should be caught and displayed to the user:

```tsx
export function KickMemberButton({
  organizationId,
  userId,
  memberName,
}: {
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  memberName: string;
}) {
  const kick = useMutation(api.members.kick);
  const [isPending, setIsPending] = useState(false);

  const handleKick = async () => {
    if (!confirm(`Are you sure you want to kick ${memberName}?`)) return;

    try {
      setIsPending(true);
      await kick({ organizationId, userId, reason: "Violated server rules" });
      toast.success(`${memberName} was kicked.`);
    } catch (error: any) {
      // Backend error message: e.g. "Forbidden: You cannot kick a member with equal or higher role position."
      toast.error(error.message || "Failed to kick member.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button disabled={isPending} onClick={handleKick} className="text-red-500">
      {isPending ? "Kicking..." : "Kick"}
    </button>
  );
}
```

---

## 5. Organization Avatar Upload Flow

To upload an organization icon to Convex storage:

```tsx
export function IconUploader({ organizationId }: { organizationId: Id<"organizations"> }) {
  const generateUploadUrl = useMutation(api.organizations.generateUploadUrl);
  const updateOrg = useMutation(api.organizations.update);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. Get pre-signed upload URL from Convex
    const postUrl = await generateUploadUrl();

    // 2. POST the file directly to Convex storage
    const response = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const { storageId } = await response.json();

    // 3. Save the storage ID on the organization document
    await updateOrg({
      organizationId,
      iconStorageId: storageId,
    });

    toast.success("Server icon updated!");
  };

  return (
    <input type="file" accept="image/*" onChange={handleFileChange} />
  );
}
```
