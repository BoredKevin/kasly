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
* **Security**: `VIEW_ORGANIZATION` permission. Email addresses are exposed only if caller holds `VIEW_EMAILS` or `ADMINISTRATOR`, is the organization owner, or is viewing their own record.
* **Description**: Lists members with resolved user profiles, assigned role badges, and privacy-filtered email addresses.
* **Arguments**:
  * `organizationId` (`Id<"organizations">`)
  * `limit` (`number`, optional, default: 100)
* **Returns**: `Array<{ _id, userId, email, name, nickname, joinedAt, roles: Array<{ _id, name, color, position }>, isOwner, _creationTime }>`

---

### `members.get`
* **Type**: `query`
* **Security**: `VIEW_ORGANIZATION` permission. Email address is exposed only if caller holds `VIEW_EMAILS` or `ADMINISTRATOR`, is the organization owner, or is viewing their own record.
* **Description**: Returns detailed member profile including resolved permissions list, highest role position, and privacy-filtered email address.
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

---

## 7. App Settings API (`convex/appSettings.ts`)

### `appSettings.get`
* **Type**: `query`
* **Security**: Public / Authenticated.
* **Description**: Returns the global application settings object (e.g. `{ allowOrganizationCreation: boolean, enableNISN: boolean, allowProfileNameChange: boolean, allowSignUps: boolean }`). Defaults to `true` if not explicitly configured in the database.
* **Arguments**: None
* **Returns**: `{ allowOrganizationCreation: boolean, enableNISN: boolean, allowProfileNameChange: boolean, allowSignUps: boolean }`

---

### `appSettings.populate`
* **Type**: `mutation`
* **Security**: System / Setup execution.
* **Description**: Populates default system settings (`allowOrganizationCreation`, `enableNISN`, `allowProfileNameChange`, `allowSignUps`, `enablePreRegistration`, `enableRegistrationLinks`). Checks for existing entries and skips them, inserting any missing default settings.
* **Arguments**: None
* **Returns**: `{ added: Array<string>, skipped: Array<string>, message: string }`

---

### `appSettings.setInternal`
* **Type**: `internalMutation`
* **Security**: Internal / Database administration.
* **Description**: Inserts or updates an app setting directly in the database.
* **Arguments**:
  * `key` (`string`)
  * `value` (`boolean`)
  * `description` (`string`, optional)
* **Returns**: `null`

---

## 8. NISN Identification & Verification API (`convex/nisn.ts`)

### `nisn.getStatus`
* **Type**: `query`
* **Security**: Authenticated user (`getCurrentUser`).
* **Description**: Returns the caller's NISN configuration status and encryption status string. Does not leak raw or hashed values.
* **Arguments**: None
* **Returns**: `{ enabled: boolean, isSet: boolean, encryptionStatus: string } | null`

---

### `nisn.verify`
* **Type**: `mutation`
* **Security**: Authenticated user (`requireUser`).
* **Description**: Verifies a candidate 10-digit NISN against the caller's stored cryptographic hash.
* **Arguments**:
  * `nisn` (`string`): Exactly 10 numeric digits.
* **Returns**: `{ verified: boolean, message: string }`
* **Throws**:
  * `Error` if NISN feature is disabled in app settings.
  * `Error` if NISN format is invalid (not 10 digits).
  * `Error` if user does not have a NISN configured.

---

### `nisn.setInternal`
* **Type**: `internalMutation`
* **Security**: Internal / Administrative / Testing.
* **Description**: Securely hashes a 10-digit NISN with CSPRNG salt (`v1$<saltHex>$<hashHex>`) and patches the specified user document.
* **Arguments**:
  * `userId` (`Id<"users">`)
  * `nisn` (`string`): Exactly 10 numeric digits.
* **Returns**: `{ success: boolean, userId: Id<"users"> }`

---

### `nisn.clearInternal`
* **Type**: `internalMutation`
* **Security**: Internal / Administrative / Testing.
* **Description**: Clears the NISN field for a specified user document.
* **Arguments**:
  * `userId` (`Id<"users">`)
* **Returns**: `{ success: boolean }`

---

## 9. Treasury & Cryptographic Ledger API (`convex/treasury/*.ts`)

For the exhaustive cryptographic specifications, payload canonicalization, signature schemes, and verification lifecycles, see **[Treasury & Cryptographic Ledger Engine](treasury.md)**.

### Funds Management (`convex/treasury/funds.ts`)
* `treasury.funds.list` *(Query)*: Lists non-archived funds with dynamically derived real-time balances. Requires `VIEW_TREASURY`.
* `treasury.funds.get` *(Query)*: Fetches single fund details with derived balance. Requires `VIEW_TREASURY`.
* `treasury.funds.create` *(Mutation)*: Provisions a new fund with immutable currency. Requires `MANAGE_TREASURY`.
* `treasury.funds.update` *(Mutation)*: Updates fund name and description. Requires `MANAGE_TREASURY`.
* `treasury.funds.archive` *(Mutation)*: Soft-archives a fund, preventing new entries while preserving ledger history. Requires `MANAGE_TREASURY`.
* `treasury.funds.unarchive` *(Mutation)*: Restores an archived fund. Requires `MANAGE_TREASURY`.

### Keys & Zero-Trust Ceremony (`convex/treasury/keys.ts`)
* `treasury.keys.requestKeyRegistration` *(Mutation)*: Submits a browser-generated public key JWK for admin approval. Requires `SIGN_TREASURY`.
* `treasury.keys.listPendingKeys` *(Query)*: Lists pending key requests with user metadata. Requires `MANAGE_TREASURY`.
* `treasury.keys.approveKey` *(Mutation)*: Approves a pending key and enters it into the trusted registry. Requires `MANAGE_TREASURY`.
* `treasury.keys.rejectKey` *(Mutation)*: Rejects a pending key registration request. Requires `MANAGE_TREASURY`.
* `treasury.keys.revokeKey` *(Mutation)*: Revokes an active key. Historical signatures remain verifiable. Requires `MANAGE_TREASURY`.
* `treasury.keys.listActiveKeys` *(Query)*: Lists all registered keys (both active and revoked). Requires `MANAGE_TREASURY`.
* `treasury.keys.getMyKeys` *(Query)*: Lists keys registered to the caller. Requires `SIGN_TREASURY`.

### Append-Only Ledger (`convex/treasury/ledger.ts`)
* `treasury.ledger.getLatestEntry` *(Query)*: Returns current HEAD sequence number and hash for pre-sign payload assembly. Requires `SIGN_TREASURY`.
* `treasury.ledger.commitEntry` *(Mutation)*: Commits a cryptographically signed debit or credit entry to the append-only chain. Requires `SIGN_TREASURY`.
* `treasury.ledger.transfer` *(Mutation)*: Atomically executes a paired debit and credit across two funds in a single transaction with a shared `transferId`. Requires `SIGN_TREASURY`.
* `treasury.ledger.listEntries` *(Query)*: Lists paginated ledger entries in reverse chronological order. Requires `VIEW_TREASURY`.
* `treasury.ledger.getBalance` *(Query)*: Derives current balance from nearest checkpoint to HEAD. Requires `VIEW_TREASURY`.
* `treasury.ledger.getBalances` *(Query)*: Derives current balances for all active funds in an organization. Requires `VIEW_TREASURY`.
* `treasury.ledger.verifyChain` *(Query)*: Mathematically verifies entire hash chain and all ECDSA signatures from genesis to HEAD. Requires `VIEW_TREASURY`.
* `treasury.ledger.exportLedger` *(Query)*: Exports full verifiable ledger state and keys for offline external compliance audit. Requires `MANAGE_TREASURY`.

### Checkpoints (`convex/treasury/checkpoints.ts`)
* `treasury.checkpoints.createCheckpoint` *(Mutation)*: Manually creates an administrative balance snapshot at current HEAD. Requires `MANAGE_TREASURY`.
* `treasury.checkpoints.listCheckpoints` *(Query)*: Lists all snapshots created for a fund. Requires `MANAGE_TREASURY`.
* `treasury.checkpoints.verifyCheckpoint` *(Query)*: Validates checkpoint balance and hash integrity by replaying from genesis. Requires `VIEW_TREASURY`.



