/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appSettings from "../appSettings.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as members from "../members.js";
import type * as nisn from "../nisn.js";
import type * as organizations from "../organizations.js";
import type * as permissions from "../permissions.js";
import type * as roles from "../roles.js";
import type * as treasury_checkpoints from "../treasury/checkpoints.js";
import type * as treasury_dues from "../treasury/dues.js";
import type * as treasury_funds from "../treasury/funds.js";
import type * as treasury_helpers from "../treasury/helpers.js";
import type * as treasury_keys from "../treasury/keys.js";
import type * as treasury_ledger from "../treasury/ledger.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appSettings: typeof appSettings;
  auth: typeof auth;
  authz: typeof authz;
  http: typeof http;
  invites: typeof invites;
  members: typeof members;
  nisn: typeof nisn;
  organizations: typeof organizations;
  permissions: typeof permissions;
  roles: typeof roles;
  "treasury/checkpoints": typeof treasury_checkpoints;
  "treasury/dues": typeof treasury_dues;
  "treasury/funds": typeof treasury_funds;
  "treasury/helpers": typeof treasury_helpers;
  "treasury/keys": typeof treasury_keys;
  "treasury/ledger": typeof treasury_ledger;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
