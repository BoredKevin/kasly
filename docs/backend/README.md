# Kasly Backend Architecture & System Design

Welcome to the **Kasly Backend Architecture Guide**. This document outlines the architectural patterns, security primitives, and execution mechanics powering Kasly's backend.

---

## 1. Executive Summary

Kasly's backend is a real-time, multi-tenant collaboration platform built entirely in TypeScript on [Convex](https://convex.dev/). It features a Discord-inspired hierarchical Role-Based Access Control (RBAC) engine, organization-scoped data isolation, and reactive data synchronization.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│           (React 19 + Vite + Convex React Hooks)            │
└──────────────────────────────┬──────────────────────────────┘
                               │ WebSocket Real-Time Sync
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Convex Server Layer                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   API Surface: Queries, Mutations & HTTP Endpoints    │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │    Security & RBAC Engine (convex/authz.ts)           │  │
│  │   • Identity Verification (@convex-dev/auth)          │  │
│  │   • Multi-Tenant Isolation (organizationId scoping)   │  │
│  │   • Role Hierarchy & Bitwise Permission Validation    │  │
│  │   • Ban List Enforcement                              │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        ACID Relational Document Database Layer        │  │
│  │   • Schema & Indexing (convex/schema.ts)              │  │
│  │   • File Storage Service (_storage)                   │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Runtime & Database** | [Convex](https://convex.dev/) | All-in-one TypeScript serverless runtime and reactive ACID database |
| **Authentication** | [@convex-dev/auth](https://labs.convex.dev/auth) | Integrated auth supporting sessions, OTP, passwords, and OAuth |
| **Type Safety** | TypeScript & Convex Values (`v.*`) | End-to-end type sharing between database schema, functions, and client |
| **Frontend Framework**| React 19 + Vite + Tailwind CSS v4 | Client application interacting over reactive subscriptions |

---

## 3. Convex Execution Model

Kasly relies on Convex's functional paradigms:

### A. Queries (Deterministic & Reactive)
- **Pure Reads**: Queries are strictly read-only and deterministic.
- **Automatic Caching & Subscriptions**: Whenever data touched by a query changes, Convex automatically pushes the new result to all connected clients over WebSockets without manual cache invalidation or polling.
- **Consistent Reads**: Queries always read a consistent snapshot of the database.

### B. Mutations (ACID Transactions)
- **All-or-Nothing Execution**: Every mutation executes as a serializable, atomic transaction. If an error is thrown anywhere in the mutation, all database writes roll back automatically.
- **Optimistic Concurrency Control (OCC)**: Convex detects write conflicts automatically and retries or rejects transactions to guarantee consistency.

### C. File Storage
- Built-in file storage via `_storage` enables secure icon uploads (such as organization avatars) through Convex upload URLs without external S3 buckets.

---

## 4. Multi-Tenant Isolation Architecture

Kasly is designed with strict organization-level multi-tenancy:

1. **Organization as Tenant Root**: Every resource in the system (roles, members, invites, bans, and content items) is linked to an `organizationId` foreign key referencing the `organizations` table.
2. **Compound Index Scoping**: All queries filter by `organizationId` through compound database indexes (e.g., `by_organizationId_and_userId`, `by_organizationId_and_position`), ensuring high query performance and preventing full-table scans.
3. **No Unscoped Reads**: Every data retrieval query enforces authorization via `requirePermission` or `requireMember` before returning documents to the client.

---

## 5. Security & Authorization Flow

Every incoming request passes through the **Authorization Gateway** defined in [convex/authz.ts](file:///d:/coding/BoredKevin/kasly/convex/authz.ts):

```
Client Invocation
       │
       ▼
1. requireUser(ctx) ───────────────────────────► Throws 401 Unauthorized if unauthenticated
       │
       ▼
2. requireNotBanned(ctx, orgId, userId) ───────► Throws 403 Forbidden if user is banned
       │
       ▼
3. requireMember(ctx, orgId, userId) ──────────► Throws 403 Forbidden if not a member
       │
       ▼
4. isOwner ? ───► YES ─────────────────────────► BYPASS ALL PERMISSION & HIERARCHY CHECKS
       │
      NO
       ▼
5. requirePermission(ctx, orgId, permission) ──► Throws 403 Forbidden if missing permission
       │
       ▼
6. assertCanManageRole / TargetMember ─────────► Throws 403 Forbidden if violating hierarchy
       │
       ▼
Execute Transaction Handler & Commit DB Writes
```

---

## 6. Directory Structure & File Map

```
convex/
├── _generated/          # Auto-generated Convex types and API bindings (do not edit)
├── auth.config.ts       # Convex Auth configuration & OAuth provider definitions
├── auth.ts              # Convex Auth server entry point
├── authz.ts             # Central RBAC calculation, hierarchy guards & auth helpers
├── http.ts              # HTTP router for auth endpoints and webhooks
├── invites.ts           # Organization invitation management and consumption
├── members.ts           # Member profiles, role assignment, kick/ban actions
├── myFunctions.ts       # Boilerplate / demo functions
├── numbers.ts           # Example org-scoped resource demonstrating RBAC guards
├── organizations.ts     # Organization lifecycle, settings, and ownership transfer
├── permissions.ts       # Permission bitsets, constants, and validators
├── roles.ts             # Role creation, hierarchy position ordering, and permissions
├── schema.ts            # Database schema definitions and indexes
└── tsconfig.json        # TypeScript configuration for Convex environment
```

---

## 7. Documentation Index

For in-depth guides and references, consult:

* **[Database Schema & ERD](schema.md)** — Complete table specifications, relationships, and lifecycle cascade rules.
* **[RBAC & Security Specification](rbac-security.md)** — Hierarchy calculations, permission sets, and owner superuser rules.
* **[API Reference Catalog](api-reference.md)** — Complete catalog of queries, mutations, parameters, returns, and error states.
* **[Client Integration Guide](integration-guide.md)** — React integration, subscription hooks, and client-side error handling.
