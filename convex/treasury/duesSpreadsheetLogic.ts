import { QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

export interface SpreadsheetEventOutput {
  _id: Id<"duesEvents">;
  fundId: Id<"funds">;
  periodLabel: string;
  dueDate: number;
  amount: number;
  totalMembers: number;
  paidCount: number;
}

export interface SpreadsheetMemberOutput {
  _id: Id<"members">;
  userId: Id<"users">;
  name: string;
  email?: string;
  nickname?: string;
  image?: string;
  unpaidPeriodsCount: number;
  totalPaidAmount: number;
}

export interface SpreadsheetCellOutput {
  _id: Id<"duesMemberships">;
  duesEventId: Id<"duesEvents">;
  fundId: Id<"funds">;
  memberId: Id<"members">;
  userId: Id<"users">;
  hasPaid: boolean;
  isWaived?: boolean;
  paidAt?: number;
  ledgerEntryId?: Id<"ledgerEntries">;
  invoiceId?: Id<"invoices">;
}

export interface DuesSpreadsheetResult {
  events: SpreadsheetEventOutput[];
  members: SpreadsheetMemberOutput[];
  cells: SpreadsheetCellOutput[];
}

/**
 * Builds the spreadsheet matrix for a given fund:
 * - Fetches active events in chronological order (oldest to newest)
 * - Fetches organization members and hydrates user profiles in batch
 * - Performs single-indexed query for all fund memberships
 * - Maps unpaid counts and total paid amounts per member
 * - Sorts member rows alphabetically
 */
export async function buildDuesSpreadsheetMatrix(
  ctx: QueryCtx,
  organizationId: Id<"organizations">,
  fundId: Id<"funds">,
  limitEvents?: number
): Promise<DuesSpreadsheetResult> {
  // 1. Fetch events (ordered oldest to newest for spreadsheet left-to-right)
  const rawEventsQuery = ctx.db
    .query("duesEvents")
    .withIndex("by_fundId_and_dueDate", (q) => q.eq("fundId", fundId))
    .order("desc");

  const rawEvents =
    limitEvents !== undefined
      ? await rawEventsQuery.take(limitEvents)
      : await rawEventsQuery.collect();

  const events = [...rawEvents].filter((e) => !e.isArchived).reverse();

  // 2. Fetch members
  const rawMembers = await ctx.db
    .query("members")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .collect();

  // 3. Single indexed query for all memberships belonging to this fund
  const eventIdSet = new Set(events.map((e) => e._id));
  const allFundMemberships = await ctx.db
    .query("duesMemberships")
    .withIndex("by_fundId", (q) => q.eq("fundId", fundId))
    .collect();
  const allMemberships = allFundMemberships.filter((m) =>
    eventIdSet.has(m.duesEventId)
  );

  // Map memberships by memberId
  const membershipsByMember = new Map<string, typeof allMemberships>();
  for (const m of allMemberships) {
    const list = membershipsByMember.get(m.memberId) ?? [];
    list.push(m);
    membershipsByMember.set(m.memberId, list);
  }

  // Batch hydrate unique user documents in parallel
  const userDocs = await Promise.all(
    rawMembers.map((m) => ctx.db.get("users", m.userId))
  );
  const userMap = new Map<string, Doc<"users">>();
  userDocs.forEach((u) => {
    if (u) userMap.set(u._id, u);
  });

  // Build event amount map for fast O(1) total calculations
  const eventAmountMap = new Map(events.map((e) => [e._id, e.amount]));

  // Build member rows with aggregated unpaid counts
  const memberRows: SpreadsheetMemberOutput[] = [];
  for (const member of rawMembers) {
    const user = userMap.get(member.userId);
    const userMemberships = membershipsByMember.get(member._id) ?? [];
    const unpaidCount = userMemberships.filter((m) => !m.hasPaid).length;
    const totalPaidAmount = userMemberships
      .filter((m) => m.hasPaid && !m.isWaived)
      .reduce((sum, m) => sum + (eventAmountMap.get(m.duesEventId) ?? 0), 0);

    memberRows.push({
      _id: member._id,
      userId: member.userId,
      name: member.nickname || user?.name || "Unknown Member",
      email: user?.email,
      nickname: member.nickname,
      image: user?.image,
      unpaidPeriodsCount: unpaidCount,
      totalPaidAmount,
    });
  }

  // Sort members alphabetically by display name
  memberRows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    events: events.map((e) => ({
      _id: e._id,
      fundId: e.fundId,
      periodLabel: e.periodLabel,
      dueDate: e.dueDate,
      amount: e.amount,
      totalMembers: e.totalMembers,
      paidCount: e.paidCount,
    })),
    members: memberRows,
    cells: allMemberships.map((c) => ({
      _id: c._id,
      duesEventId: c.duesEventId,
      fundId: c.fundId,
      memberId: c.memberId,
      userId: c.userId,
      hasPaid: c.hasPaid,
      isWaived: c.isWaived,
      paidAt: c.paidAt,
      ledgerEntryId: c.ledgerEntryId,
      invoiceId: c.invoiceId,
    })),
  };
}
