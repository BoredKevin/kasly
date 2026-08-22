# Backend API Reference Catalog

This document is the complete API reference for all public Convex functions in the Kasly backend.

---

## 1. Conventions & Error Handling

* **Client Invocation**: In React, call queries with `useQuery(api.<module>.<func>, args)` and mutations with `useMutation(api.<module>.<func>)`.
* **Standard Errors**:
  * `401 Unauthorized`: Caller is not logged in (`requireUser`).
  * `403 Forbidden`: Caller lacks required permission, is not an organization member, is banned, or violates role hierarchy.
  * `404 Not Found`: Target entity does not exist.

---

## 2. Organizations API (`convex/organizations.ts`)

### `organizations.create`
* **Type**: `mutation`
* **Security**: Logged in user (`requireUser`).
* **Description**: Creates a new organization, configures the caller as `ownerId`, seeds the `@everyone` role (position 0), seeds the `Admin` role (position 100), and adds the owner as the initial member.
* **Arguments**:
  * `name` (`string`): Organization display name.
  * `slug` (`string`, optional): URL-friendly slug.
  * `description` (`string`, optional): Bio or description.
* **Returns**: `Id<"organizations">`
* **Example Usage**:
  ```ts
  const orgId = await createOrg({ name: "Acme Corp", slug: "acme" });
  ```

---

### `organizations.get`
* **Type**: `query`
* **Security**: Member of organization (`requireMember`).
* **Description**: Returns organization details and indicates whether the caller is the owner.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: Object with `_id`, `name`, `slug`, `description`, `iconUrl`, `iconStorageId`, `ownerId`, `isOwner`, `_creationTime`, or `null` if not found.

---

### `organizations.listMine`
* **Type**: `query`
* **Security**: Logged in user (`requireUser`).
* **Description**: Lists all organizations where the caller is a member.
* **Arguments**: `{}`
* **Returns**: `Array<{ _id, name, slug, description, iconUrl, ownerId, isOwner, joinedAt, _creationTime }>`

---

### `organizations.update`
* **Type**: `mutation`
* **Security**: `MANAGE_ORGANIZATION` permission or Organization Owner.
* **Description**: Updates organization name, description, slug, or icon.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `name` (`string`, optional)
  * `description` (`string`, optional)
  * `slug` (`string`, optional)
  * `iconStorageId` (`Id<"_storage">`, optional)
  * `iconUrl` (`string`, optional)
* **Returns**: `null`

---

### `organizations.transferOwnership`
* **Type**: `mutation`
* **Security**: Organization Owner only.
* **Description**: Transfers server ownership to another existing member.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `newOwnerUserId` (`Id<"users">`): Must be an existing member.
* **Returns**: `null`
* **Throws**: `Forbidden` if caller is not the current owner or target is not a member.

---

### `organizations.deleteOrganization`
* **Type**: `mutation`
* **Security**: Organization Owner only.
* **Description**: Permanently deletes an organization and cascades deletion across all roles, members, invites, bans, and scoped resources.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: `null`

---

### `organizations.leave`
* **Type**: `mutation`
* **Security**: Member of organization (non-owner).
* **Description**: Removes the caller from the organization.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: `null`
* **Throws**: `Forbidden` if caller is the owner (must transfer ownership or delete server).

---

## 3. Roles API (`convex/roles.ts`)

### `roles.list`
* **Type**: `query`
* **Security**: `VIEW_ORGANIZATION` permission.
* **Description**: Lists all roles for an organization, sorted in descending order by hierarchy `position`.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: `Array<{ _id, name, description, color, position, permissions, isDefault, isSystem, _creationTime }>`

---

### `roles.create`
* **Type**: `mutation`
* **Security**: `MANAGE_ROLES` permission + Hierarchy check.
* **Description**: Creates a new custom role. Target position must be strictly lower than caller's highest role.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `name` (`string`)
  * `description` (`string`, optional)
  * `color` (`string`, optional)
  * `position` (`number`, optional, default: `1`)
  * `permissions` (`Array<Permission>`)
* **Returns**: `Id<"roles">`
* **Throws**: `Forbidden` if position is $\le 0$ or $\ge$ caller's highest position.

---

### `roles.update`
* **Type**: `mutation`
* **Security**: `MANAGE_ROLES` permission + Hierarchy check.
* **Description**: Updates role attributes. Cannot modify a role equal to or higher than caller's position. Position 0 and name for `@everyone` cannot be changed.
* **Arguments**:
  * `roleId` (`Id<"roles">`)
  * `name` (`string`, optional)
  * `description` (`string`, optional)
  * `color` (`string`, optional)
  * `position` (`number`, optional)
  * `permissions` (`Array<Permission>`, optional)
* **Returns**: `null`

---

### `roles.deleteRole`
* **Type**: `mutation`
* **Security**: `MANAGE_ROLES` permission + Hierarchy check.
* **Description**: Deletes a custom role and strips it from all members possessing it.
* **Arguments**:
  * `roleId` (`Id<"roles">`)
* **Returns**: `null`
* **Throws**: `Forbidden` for default/system roles or roles $\ge$ caller's position.

---

### `roles.reorder`
* **Type**: `mutation`
* **Security**: `MANAGE_ROLES` permission + Hierarchy check.
* **Description**: Batch updates role positions while verifying caller outranks all modified positions.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `rolePositions` (`Array<{ roleId: Id<"roles">, position: number }>`): Array of role mappings.
* **Returns**: `null`

---

## 4. Members API (`convex/members.ts`)

### `members.list`
* **Type**: `query`
* **Security**: `VIEW_ORGANIZATION` permission.
* **Description**: Lists members with resolved user profiles and assigned role badges.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `limit` (`number`, optional, default: 100)
* **Returns**: `Array<{ _id, userId, email, name, nickname, joinedAt, roles: Array<{ _id, name, color, position }>, isOwner, _creationTime }>`

---

### `members.get`
* **Type**: `query`
* **Security**: `VIEW_ORGANIZATION` permission.
* **Description**: Returns detailed member profile including resolved permissions list and highest role position.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `userId` (`Id<"users">`)
* **Returns**: Member detail object or `null`.

---

### `members.getMyMember`
* **Type**: `query`
* **Security**: Member of organization.
* **Description**: Retrieves the calling user's member profile, resolved permissions, and highest position.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: Profile object with `permissions: string[]`, `highestPosition: number`, `isOwner: boolean`.

---

### `members.updateNickname`
* **Type**: `mutation`
* **Security**: Self-update or `MANAGE_MEMBERS` (with hierarchy check).
* **Description**: Updates a member's server-specific display nickname.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `userId` (`Id<"users">`)
  * `nickname` (`string`, optional)
* **Returns**: `null`

---

### `members.assignRoles`
* **Type**: `mutation`
* **Security**: `MANAGE_ROLES` permission + Hierarchy check on all modified roles and target member.
* **Description**: Replaces a member's assigned role list.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `userId` (`Id<"users">`)
  * `roleIds` (`Array<Id<"roles">>`)
* **Returns**: `null`

---

### `members.kick`
* **Type**: `mutation`
* **Security**: `KICK_MEMBERS` permission + Hierarchy check.
* **Description**: Kicks a member from the organization.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `userId` (`Id<"users">`)
  * `reason` (`string`, optional)
* **Returns**: `null`
* **Throws**: `Forbidden` if target is owner or outranks caller.

---

### `members.ban`
* **Type**: `mutation`
* **Security**: `BAN_MEMBERS` permission + Hierarchy check.
* **Description**: Bans a user, removes their membership record, and inserts a permanent ban record.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `userId` (`Id<"users">`)
  * `reason` (`string`, optional)
* **Returns**: `null`

---

### `members.unban`
* **Type**: `mutation`
* **Security**: `BAN_MEMBERS` permission.
* **Description**: Removes a user from the ban list, allowing them to rejoin via invite.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `userId` (`Id<"users">`)
* **Returns**: `null`

---

### `members.listBans`
* **Type**: `query`
* **Security**: `BAN_MEMBERS` or `ADMINISTRATOR` permission.
* **Description**: Lists all banned users in the organization with moderator and timestamp metadata.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: `Array<{ _id, userId, userName, userEmail, reason, bannedBy, bannerName, bannedAt }>`

---

## 5. Invites API (`convex/invites.ts`)

### `invites.create`
* **Type**: `mutation`
* **Security**: `CREATE_INVITES` permission. If `roleIds` are specified, requires `MANAGE_ROLES` and hierarchy clearance.
* **Description**: Generates an 8-character invite code with optional usage limits, expiration, and auto-granted roles.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `maxUses` (`number`, optional)
  * `expiresInMs` (`number`, optional)
  * `roleIds` (`Array<Id<"roles">>`, optional)
* **Returns**: `{ code: string, inviteId: Id<"invites"> }`

---

### `invites.get`
* **Type**: `query`
* **Security**: Public (no login required for invite preview).
* **Description**: Previews organization name, description, member count, and valid state of an invite code.
* **Arguments**:
  * `code` (`string`)
* **Returns**: Object with `valid: boolean`, `organizationName`, `description`, `iconUrl`, `memberCount`, or `{ valid: false, reason }`.

---

### `invites.joinViaInvite`
* **Type**: `mutation`
* **Security**: Logged in user (`requireUser`).
* **Description**: Redeems an invite code, verifies ban status, increments usage counter, and creates a member record with attached roles.
* **Arguments**:
  * `code` (`string`)
* **Returns**: `{ organizationId: Id<"organizations"> }`
* **Throws**: `Forbidden` if banned or invite expired/exhausted.

---

### `invites.list`
* **Type**: `query`
* **Security**: `MANAGE_INVITES` permission.
* **Description**: Lists all active and historical invite links for an organization.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
* **Returns**: `Array<{ _id, code, uses, maxUses, expiresAt, inviterName, isExpired }>`

---

### `invites.revoke`
* **Type**: `mutation`
* **Security**: `MANAGE_INVITES` permission (or original inviter).
* **Description**: Deletes an invite link.
* **Arguments**:
  * `inviteId` (`Id<"invites">`)
* **Returns**: `null`

---

## 6. Content API Demo (`convex/numbers.ts`)

### `numbers.listByOrg`
* **Type**: `query`
* **Security**: `VIEW_ORGANIZATION` permission.
* **Description**: Lists numbers scoped to an organization.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `limit` (`number`, optional, default: 50)
* **Returns**: `Array<{ _id, value, organizationId, createdBy, creatorName, _creationTime }>`

---

### `numbers.add`
* **Type**: `mutation`
* **Security**: `CREATE_CONTENT` permission.
* **Description**: Adds a new number document tagged with the caller's ID and organization ID.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `value` (`number`)
* **Returns**: `Id<"numbers">`

---

### `numbers.remove`
* **Type**: `mutation`
* **Security**: `MANAGE_CONTENT` permission or original creator.
* **Description**: Deletes a number record.
* **Arguments**:
  * `numberId` (`Id<"numbers">`)
* **Returns**: `null`
