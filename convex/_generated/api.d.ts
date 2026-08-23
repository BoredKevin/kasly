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
