# Kasly Backend Engine

This directory contains the [Convex](https://convex.dev/) backend codebase for Kasly, powering multi-tenant organizations, Discord-style hierarchical RBAC, authentication, real-time synchronization, and file storage.

---

## Complete Documentation Suite

Comprehensive architecture, schema specifications, security matrices, and API references are maintained in the [`docs/backend/`](../docs/backend/) directory:

* **[System Architecture & Design Guide](../docs/backend/README.md)** — Architectural principles, execution model, multi-tenant isolation, and data flow.
* **[Treasury & Cryptographic Ledger Guide](../docs/backend/treasury.md)** — Append-only hash chain, ECDSA P-256 signing, zero-trust key ceremony, and balance derivation.
* **[Database Schema & ERD](../docs/backend/schema.md)** — Complete table specifications, field types, compound indexes, and cascade deletion policies.
* **[RBAC & Security Specification](../docs/backend/rbac-security.md)** — Granular permission catalog, mathematical hierarchy models, and security invariants.
* **[API Reference Catalog](../docs/backend/api-reference.md)** — Complete function-by-function catalog of queries, mutations, arguments, returns, and error states.
* **[Client Integration Guide](../docs/backend/integration-guide.md)** — Frontend integration with React 19, reactive hooks, error handling, and permission guards.

---

## Codebase File Map

| File | Purpose |
| :--- | :--- |
| [`schema.ts`](./schema.ts) | Core database schema definitions, validators, and compound indexes. |
| [`permissions.ts`](./permissions.ts) | Discord-style permission constants, validator schemas, and defaults. |
| [`authz.ts`](./authz.ts) | Centralized authorization helpers, hierarchy comparisons, and guardrails. |
| [`organizations.ts`](./organizations.ts) | Organization CRUD, slug lookups, avatar management, and ownership transfer. |
| [`roles.ts`](./roles.ts) | Role creation, editing, deletion, reordering, and permission assignments. |
| [`members.ts`](./members.ts) | Member listings, nickname updates, role assignments, kick, ban, and unban actions. |
| [`invites.ts`](./invites.ts) | Invite generation, expiration validation, auto-roles, and link revocation. |
| [`treasury/funds.ts`](./treasury/funds.ts) | Fund accounts CRUD, derived balance queries, and archival management. |
| [`treasury/keys.ts`](./treasury/keys.ts) | Zero-trust treasurer public key registration, approvals, and revocation. |
| [`treasury/ledger.ts`](./treasury/ledger.ts) | Core append-only signed entry commit, atomic transfers, and chain verification. |
| [`treasury/checkpoints.ts`](./treasury/checkpoints.ts) | Periodic and manual balance snapshots for $O(1)$ fast balance replay. |
| [`treasury/helpers.ts`](./treasury/helpers.ts) | Web Crypto ECDSA verification, SHA-256 digests, and canonical JSON serialization. |
| [`auth.ts`](./auth.ts) & [`auth.config.ts`](./auth.config.ts) | Convex Auth setup and session providers. |
| [`http.ts`](./http.ts) | HTTP routing for webhooks and auth endpoints. |

---

## Development & Tooling

To start the Convex backend dev server:

```bash
npx convex dev
```

To run typechecking:

```bash
npm run typecheck
```

To deploy to production:

```bash
npx convex deploy
```
