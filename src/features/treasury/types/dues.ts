import { Doc, Id } from "../../../../convex/_generated/dataModel";

export type DueEventDoc = Doc<"duesEvents">;
export type DueEventId = Id<"duesEvents">;
export type DuesMembershipDoc = Doc<"duesMemberships">;
export type DuesMembershipId = Id<"duesMemberships">;

export type DuesStatus = "PAID" | "INVOICED" | "UNPAID" | "WAIVED";
