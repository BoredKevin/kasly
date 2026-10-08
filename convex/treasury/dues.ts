import { v } from "convex/values";
import { query, mutation, internalMutation } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { internal } from "../_generated/api";
import { requirePermission } from "../authz";
import { PERMISSIONS } from "../permissions";
import { executeCommit } from "./ledger";
import { computeNextFireTime, generatePeriodLabel } from "./helpers";

/**
 * Returns the dues configuration for a specific fund.
 */
export const getDuesConfig = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("duesConfig"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      fundId: v.id("funds"),
      isEnabled: v.boolean(),
      intervalType: v.union(
        v.literal("weekly"),
        v.literal("monthly"),
        v.literal("custom_days")
      ),
      intervalValue: v.number(),
      amount: v.number(),
      nextScheduledAt: v.optional(v.number()),
      scheduledJobId: v.optional(v.id("_scheduled_functions")),
      createdBy: v.id("users"),
      updatedBy: v.optional(v.id("users")),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    return await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();
  },
});

/**
 * Creates or updates the dues schedule configuration for a fund.
 * Dynamically reschedules the next due cycle using ctx.scheduler.runAt.
 */
export const upsertDuesConfig = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    isEnabled: v.boolean(),
    intervalType: v.union(
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("custom_days")
    ),
    intervalValue: v.number(),
    amount: v.number(),
  },
  returns: v.id("duesConfig"),
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    if (args.amount <= 0 || !Number.isInteger(args.amount)) {
      throw new Error("Invalid due amount: Amount must be a positive integer.");
    }

    if (args.intervalType === "weekly") {
      if (args.intervalValue < 0 || args.intervalValue > 6) {
        throw new Error("Invalid day of week: Must be between 0 (Sun) and 6 (Sat).");
      }
    } else if (args.intervalType === "monthly") {
      if (args.intervalValue < 1 || args.intervalValue > 28) {
        throw new Error("Invalid day of month: Must be between 1 and 28.");
      }
    } else if (args.intervalType === "custom_days") {
      if (args.intervalValue < 1 || !Number.isInteger(args.intervalValue)) {
        throw new Error("Invalid interval: Must be at least 1 day.");
      }
    }

    const existing = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    // Cancel existing scheduled job if any
    if (existing?.scheduledJobId) {
      try {
        await ctx.scheduler.cancel(existing.scheduledJobId);
      } catch (err) {
        // Job may have already executed or been cancelled
        console.warn("Could not cancel existing dues scheduled job:", err);
      }
    }

    let nextScheduledAt: number | undefined = undefined;
    let scheduledJobId: any = undefined;

    if (args.isEnabled) {
      nextScheduledAt = computeNextFireTime(args.intervalType, args.intervalValue);
      scheduledJobId = await ctx.scheduler.runAt(
        nextScheduledAt,
        internal.treasury.dues._runDuesCycle,
        { organizationId: args.organizationId, fundId: args.fundId }
      );
    }

    if (existing) {
      await ctx.db.patch("duesConfig", existing._id, {
        isEnabled: args.isEnabled,
        intervalType: args.intervalType,
        intervalValue: args.intervalValue,
        amount: args.amount,
        nextScheduledAt,
        scheduledJobId,
        updatedBy: user._id,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("duesConfig", {
        organizationId: args.organizationId,
        fundId: args.fundId,
        isEnabled: args.isEnabled,
        intervalType: args.intervalType,
        intervalValue: args.intervalValue,
        amount: args.amount,
        nextScheduledAt,
        scheduledJobId,
        createdBy: user._id,
      });
    }
  },
});

/**
 * Disables the dues schedule and cancels any pending scheduled jobs for a fund.
 */
export const disableDues = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const existing = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    if (existing) {
      if (existing.scheduledJobId) {
        try {
          await ctx.scheduler.cancel(existing.scheduledJobId);
        } catch (err) {
          console.warn("Could not cancel dues scheduled job on disable:", err);
        }
      }

      await ctx.db.patch("duesConfig", existing._id, {
        isEnabled: false,
        nextScheduledAt: undefined,
        scheduledJobId: undefined,
        updatedBy: user._id,
      });
    }

    return null;
  },
});

/**
 * Internal mutation called by Convex scheduler to trigger a scheduled dues cycle for a specific fund.
 */
export const _runDuesCycle = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.isArchived) {
      return null;
    }

    const config = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    if (!config || !config.isEnabled) {
      return null;
    }

    // 1. Fetch active members (exclude banned)
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bannedUserIds = new Set(bans.map((b) => b.userId));
    const activeMembers = members.filter((m) => !bannedUserIds.has(m.userId));

    // 2. Generate period label
    const now = new Date();
    const periodLabel = generatePeriodLabel(config.intervalType, now);
    const dueDate = now.getTime();

    // 3. Create dues event scoped to this fund
    const duesEventId = await ctx.db.insert("duesEvents", {
      organizationId: args.organizationId,
      fundId: args.fundId,
      periodLabel,
      dueDate,
      amount: config.amount,
      totalMembers: activeMembers.length,
      paidCount: 0,
    });

    // 4. Create dues memberships for each active member scoped to this fund
    for (const member of activeMembers) {
      await ctx.db.insert("duesMemberships", {
        duesEventId,
        organizationId: args.organizationId,
        fundId: args.fundId,
        memberId: member._id,
        userId: member.userId,
        hasPaid: false,
      });
    }

    // 5. Schedule next cycle
    const nextScheduledAt = computeNextFireTime(
      config.intervalType,
      config.intervalValue,
      new Date(dueDate + 1000)
    );

    const scheduledJobId = await ctx.scheduler.runAt(
      nextScheduledAt,
      internal.treasury.dues._runDuesCycle,
      { organizationId: args.organizationId, fundId: args.fundId }
    );

    await ctx.db.patch("duesConfig", config._id, {
      nextScheduledAt,
      scheduledJobId,
    });

    return null;
  },
});

/**
 * Allows admin to manually create a dues cycle for any date (past, present, or future)
 * with custom or defaulted amount & period label.
 */
export const createManualDuesCycle = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    dueDate: v.number(), // timestamp in milliseconds
    amount: v.optional(v.number()), // custom amount or defaults to config amount
    periodLabel: v.optional(v.string()), // custom label or auto-generated
  },
  returns: v.id("duesEvents"),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const config = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    const targetDate = new Date(args.dueDate);
    if (isNaN(targetDate.getTime())) {
      throw new Error("Invalid due date provided.");
    }

    const intervalType = config?.intervalType ?? "monthly";
    const amount = args.amount !== undefined ? args.amount : (config?.amount ?? 10000);

    if (amount <= 0 || !Number.isInteger(amount)) {
      throw new Error("Invalid due amount: Amount must be a positive integer.");
    }

    const label = args.periodLabel?.trim()
      ? args.periodLabel.trim()
      : generatePeriodLabel(intervalType, targetDate);

    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bannedUserIds = new Set(bans.map((b) => b.userId));
    const activeMembers = members.filter((m) => !bannedUserIds.has(m.userId));

    const duesEventId = await ctx.db.insert("duesEvents", {
      organizationId: args.organizationId,
      fundId: args.fundId,
      periodLabel: label,
      dueDate: args.dueDate,
      amount,
      totalMembers: activeMembers.length,
      paidCount: 0,
    });

    for (const member of activeMembers) {
      await ctx.db.insert("duesMemberships", {
        duesEventId,
        organizationId: args.organizationId,
        fundId: args.fundId,
        memberId: member._id,
        userId: member.userId,
        hasPaid: false,
      });
    }

    return duesEventId;
  },
});

/**
 * Allows admin to batch create multiple dues cycles across a range of periods.
 * Optionally skips duplicate cycles if they already exist in the fund.
 */
export const createBatchDuesCycles = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    cycles: v.array(
      v.object({
        dueDate: v.number(),
        periodLabel: v.string(),
        amount: v.optional(v.number()),
      })
    ),
    skipDuplicates: v.optional(v.boolean()),
  },
  returns: v.object({
    createdCount: v.number(),
    skippedCount: v.number(),
    eventIds: v.array(v.id("duesEvents")),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    if (args.cycles.length === 0) {
      throw new Error("No cycles provided to create.");
    }

    if (args.cycles.length > 100) {
      throw new Error("Cannot create more than 100 dues cycles in a single batch.");
    }

    const config = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    const defaultAmount = config?.amount ?? 10000;

    // Fetch existing events to check for duplicates
    const existingEvents = await ctx.db
      .query("duesEvents")
      .withIndex("by_fundId", (q) => q.eq("fundId", args.fundId))
      .collect();

    const existingLabels = new Set(existingEvents.map((e) => e.periodLabel.toLowerCase().trim()));

    // Fetch active members
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bannedUserIds = new Set(bans.map((b) => b.userId));
    const activeMembers = members.filter((m) => !bannedUserIds.has(m.userId));

    const skipDuplicates = args.skipDuplicates !== false; // default true
    const createdEventIds: any[] = [];
    let skippedCount = 0;

    // Track labels within this batch to prevent duplicates inside the batch itself
    const processedLabels = new Set<string>();

    for (const cycle of args.cycles) {
      const normalizedLabel = cycle.periodLabel.toLowerCase().trim();
      const isDuplicate = existingLabels.has(normalizedLabel) || processedLabels.has(normalizedLabel);

      if (isDuplicate) {
        if (skipDuplicates) {
          skippedCount++;
          continue;
        } else {
          throw new Error(`Dues cycle '${cycle.periodLabel}' already exists in this fund.`);
        }
      }

      processedLabels.add(normalizedLabel);

      const cycleAmount = cycle.amount !== undefined ? cycle.amount : defaultAmount;
      if (cycleAmount <= 0 || !Number.isInteger(cycleAmount)) {
        throw new Error(`Invalid amount for cycle '${cycle.periodLabel}'. Must be a positive integer.`);
      }

      const duesEventId = await ctx.db.insert("duesEvents", {
        organizationId: args.organizationId,
        fundId: args.fundId,
        periodLabel: cycle.periodLabel.trim(),
        dueDate: cycle.dueDate,
        amount: cycleAmount,
        totalMembers: activeMembers.length,
        paidCount: 0,
      });

      for (const member of activeMembers) {
        await ctx.db.insert("duesMemberships", {
          duesEventId,
          organizationId: args.organizationId,
          fundId: args.fundId,
          memberId: member._id,
          userId: member.userId,
          hasPaid: false,
        });
      }

      createdEventIds.push(duesEventId);
    }

    return {
      createdCount: createdEventIds.length,
      skippedCount,
      eventIds: createdEventIds,
    };
  },
});

/**
 * Allows admin to manually trigger a dues cycle immediately for a specific fund.
 */
export const triggerDuesCycleNow = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
  },
  returns: v.id("duesEvents"),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const config = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    const amount = config?.amount ?? 10000;
    const intervalType = config?.intervalType ?? "monthly";

    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bannedUserIds = new Set(bans.map((b) => b.userId));
    const activeMembers = members.filter((m) => !bannedUserIds.has(m.userId));

    const now = new Date();
    const periodLabel = generatePeriodLabel(intervalType, now);
    const dueDate = now.getTime();

    const duesEventId = await ctx.db.insert("duesEvents", {
      organizationId: args.organizationId,
      fundId: args.fundId,
      periodLabel,
      dueDate,
      amount,
      totalMembers: activeMembers.length,
      paidCount: 0,
    });

    for (const member of activeMembers) {
      await ctx.db.insert("duesMemberships", {
        duesEventId,
        organizationId: args.organizationId,
        fundId: args.fundId,
        memberId: member._id,
        userId: member.userId,
        hasPaid: false,
      });
    }

    return duesEventId;
  },
});

/**
 * Lists all dues cycles in a specific fund.
 */
export const listDuesEvents = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    limit: v.optional(v.number()),
    includeArchived: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("duesEvents"),
      _creationTime: v.number(),
      organizationId: v.id("organizations"),
      fundId: v.id("funds"),
      periodLabel: v.string(),
      dueDate: v.number(),
      amount: v.number(),
      totalMembers: v.number(),
      paidCount: v.number(),
      isArchived: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const eventsQuery = ctx.db
      .query("duesEvents")
      .withIndex("by_fundId_and_dueDate", (q) =>
        q.eq("fundId", args.fundId)
      )
      .order("desc");

    const events =
      args.limit !== undefined
        ? await eventsQuery.take(args.limit)
        : await eventsQuery.collect();

    if (args.includeArchived) {
      return events;
    }
    return events.filter((e) => !e.isArchived);
  },
});

/**
 * Returns overview statistics for the dues system in a specific fund.
 */
export const getDuesSummary = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
  },
  returns: v.object({
    totalEvents: v.number(),
    totalUnpaidMemberships: v.number(),
    latestEvent: v.union(
      v.null(),
      v.object({
        _id: v.id("duesEvents"),
        periodLabel: v.string(),
        dueDate: v.number(),
        amount: v.number(),
        totalMembers: v.number(),
        paidCount: v.number(),
      })
    ),
    config: v.union(
      v.null(),
      v.object({
        isEnabled: v.boolean(),
        intervalType: v.string(),
        intervalValue: v.number(),
        amount: v.number(),
        nextScheduledAt: v.optional(v.number()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const config = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) =>
        q.eq("fundId", args.fundId)
      )
      .first();

    const events = await ctx.db
      .query("duesEvents")
      .withIndex("by_fundId_and_dueDate", (q) =>
        q.eq("fundId", args.fundId)
      )
      .order("desc")
      .collect();

    let totalUnpaid = 0;
    for (const event of events) {
      totalUnpaid += Math.max(0, event.totalMembers - event.paidCount);
    }

    const latest = events[0] ?? null;

    return {
      totalEvents: events.length,
      totalUnpaidMemberships: totalUnpaid,
      latestEvent: latest
        ? {
            _id: latest._id,
            periodLabel: latest.periodLabel,
            dueDate: latest.dueDate,
            amount: latest.amount,
            totalMembers: latest.totalMembers,
            paidCount: latest.paidCount,
          }
        : null,
      config: config
        ? {
            isEnabled: config.isEnabled,
            intervalType: config.intervalType,
            intervalValue: config.intervalValue,
            amount: config.amount,
            nextScheduledAt: config.nextScheduledAt,
          }
        : null,
    };
  },
});

/**
 * Returns full spreadsheet grid data for a specific fund:
 * - Members (rows, sorted alphabetically)
 * - Events (columns, sorted oldest to newest)
 * - Memberships lookup map
 */
export const getDuesSpreadsheet = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    limitEvents: v.optional(v.number()),
  },
  returns: v.object({
    events: v.array(
      v.object({
        _id: v.id("duesEvents"),
        fundId: v.id("funds"),
        periodLabel: v.string(),
        dueDate: v.number(),
        amount: v.number(),
        totalMembers: v.number(),
        paidCount: v.number(),
      })
    ),
    members: v.array(
      v.object({
        _id: v.id("members"),
        userId: v.id("users"),
        name: v.string(),
        email: v.optional(v.string()),
        nickname: v.optional(v.string()),
        image: v.optional(v.string()),
        unpaidPeriodsCount: v.number(),
        totalPaidAmount: v.number(),
      })
    ),
    cells: v.array(
      v.object({
        _id: v.id("duesMemberships"),
        duesEventId: v.id("duesEvents"),
        fundId: v.id("funds"),
        memberId: v.id("members"),
        userId: v.id("users"),
        hasPaid: v.boolean(),
        isWaived: v.optional(v.boolean()),
        paidAt: v.optional(v.number()),
        ledgerEntryId: v.optional(v.id("ledgerEntries")),
        invoiceId: v.optional(v.id("invoices")),
      })
    ),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    // 1. Fetch events (ordered oldest to newest for spreadsheet left-to-right)
    const rawEventsQuery = ctx.db
      .query("duesEvents")
      .withIndex("by_fundId_and_dueDate", (q) =>
        q.eq("fundId", args.fundId)
      )
      .order("desc");

    const rawEvents =
      args.limitEvents !== undefined
        ? await rawEventsQuery.take(args.limitEvents)
        : await rawEventsQuery.collect();

    const events = [...rawEvents].filter((e) => !e.isArchived).reverse();

    // 2. Fetch members and their user profiles
    const rawMembers = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    // 3. Fetch dues memberships for these events
    const allMemberships = [];
    for (const event of events) {
      const eventMemberships = await ctx.db
        .query("duesMemberships")
        .withIndex("by_duesEventId", (q) => q.eq("duesEventId", event._id))
        .collect();
      allMemberships.push(...eventMemberships);
    }

    // Map memberships by memberId
    const membershipsByMember = new Map<string, typeof allMemberships>();
    for (const m of allMemberships) {
      const list = membershipsByMember.get(m.memberId) ?? [];
      list.push(m);
      membershipsByMember.set(m.memberId, list);
    }

    // Build member rows with aggregated unpaid counts
    const memberRows = [];
    for (const member of rawMembers) {
      const user = await ctx.db.get("users", member.userId);
      const userMemberships = membershipsByMember.get(member._id) ?? [];
      const unpaidCount = userMemberships.filter((m) => !m.hasPaid).length;
      const totalPaidAmount = userMemberships
        .filter((m) => m.hasPaid && !m.isWaived)
        .reduce((sum, m) => {
          const ev = events.find((e) => e._id === m.duesEventId);
          return sum + (ev?.amount ?? 0);
        }, 0);

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
  },
});

/**
 * Returns unpaid dues periods for a specific member in a specific fund, ordered oldest first.
 */
export const getMemberUnpaidPeriods = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      membershipId: v.id("duesMemberships"),
      duesEventId: v.id("duesEvents"),
      periodLabel: v.string(),
      dueDate: v.number(),
      amount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const memberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_fundId_and_userId", (q) =>
        q.eq("fundId", args.fundId).eq("userId", args.userId)
      )
      .collect();

    const unpaid = memberships.filter((m) => !m.hasPaid);
    const results = [];

    for (const m of unpaid) {
      const event = await ctx.db.get("duesEvents", m.duesEventId);
      if (event) {
        results.push({
          membershipId: m._id,
          duesEventId: event._id,
          periodLabel: event.periodLabel,
          dueDate: event.dueDate,
          amount: event.amount,
        });
      }
    }

    // Sort oldest first
    results.sort((a, b) => a.dueDate - b.dueDate);
    return results;
  },
});

/**
 * Records a cryptographically signed payment for a member's outstanding dues in a fund.
 * Covers N oldest unpaid periods in a single CLE ledger transaction.
 */
export const markDuesPaid = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    fundId: v.id("funds"),
    periodCount: v.number(),
    keyId: v.string(),
    previousHash: v.string(),
    signature: v.string(),
    memo: v.optional(v.string()),
  },
  returns: v.object({
    entryId: v.id("ledgerEntries"),
    sequenceNumber: v.number(),
    entryHash: v.string(),
    timestamp: v.number(),
    markedPeriods: v.number(),
    totalAmount: v.number(),
  }),
  handler: async (ctx, args) => {
    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Selected fund not found.");
    }

    if (fund.organizationId !== args.organizationId) {
      throw new Error("Fund does not belong to this organization.");
    }

    const { user } = await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    const targetUser = await ctx.db.get("users", args.userId);
    if (!targetUser) {
      throw new Error("Target member user not found.");
    }

    if (args.periodCount <= 0 || !Number.isInteger(args.periodCount)) {
      throw new Error("Period count must be a positive integer.");
    }

    // 1. Fetch unpaid dues memberships for this user in this fund
    const memberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_fundId_and_userId", (q) =>
        q.eq("fundId", args.fundId).eq("userId", args.userId)
      )
      .collect();

    const unpaid = memberships.filter((m) => !m.hasPaid);
    const resolvedUnpaid = [];

    for (const m of unpaid) {
      const event = await ctx.db.get("duesEvents", m.duesEventId);
      if (event) {
        resolvedUnpaid.push({ membership: m, event });
      }
    }

    // Sort oldest first
    resolvedUnpaid.sort((a, b) => a.event.dueDate - b.event.dueDate);

    if (resolvedUnpaid.length === 0) {
      throw new Error("This member has no outstanding unpaid dues periods for this fund.");
    }

    if (args.periodCount > resolvedUnpaid.length) {
      throw new Error(
        `Cannot pay ${args.periodCount} periods: Member only has ${resolvedUnpaid.length} unpaid period(s).`
      );
    }

    const selectedToPay = resolvedUnpaid.slice(0, args.periodCount);
    const totalAmount = selectedToPay.reduce((sum, item) => sum + item.event.amount, 0);

    const memberName = targetUser.name || "Member";
    const periodsLabel = selectedToPay.map((item) => item.event.periodLabel).join(" / ");
    const defaultMemo = `Dues Payment (${selectedToPay.length} cycle${selectedToPay.length > 1 ? "s" : ""}: ${periodsLabel}) - ${memberName}`;
    const finalMemo = (args.memo && args.memo.trim()) ? args.memo.trim() : defaultMemo;

    // 2. Commit signed entry to the Cryptographic Ledger Engine
    const commitResult = await executeCommit(ctx, user, fund, {
      direction: "credit",
      amount: totalAmount,
      memo: finalMemo,
      keyId: args.keyId,
      previousHash: args.previousHash,
      signature: args.signature,
      duesEventId: selectedToPay[0].event._id,
    });

    // 3. Mark memberships as paid
    const now = Date.now();
    for (const item of selectedToPay) {
      await ctx.db.patch("duesMemberships", item.membership._id, {
        hasPaid: true,
        paidAt: now,
        ledgerEntryId: commitResult.entryId,
        recordedBy: user._id,
      });

      // Update event paid count
      await ctx.db.patch("duesEvents", item.event._id, {
        paidCount: item.event.paidCount + 1,
      });
    }

    return {
      entryId: commitResult.entryId,
      sequenceNumber: commitResult.sequenceNumber,
      entryHash: commitResult.entryHash,
      timestamp: commitResult.timestamp,
      markedPeriods: selectedToPay.length,
      totalAmount,
    };
  },
});

/**
 * Waives a dues obligation for a member for a specific cycle.
 * Appends a zero-amount cryptographically signed CLE waiver entry.
 */
export const waiveDues = mutation({
  args: {
    duesMembershipId: v.id("duesMemberships"),
    fundId: v.id("funds"),
    reason: v.string(),
    keyId: v.string(),
    previousHash: v.string(),
    signature: v.string(),
  },
  returns: v.object({
    entryId: v.id("ledgerEntries"),
    sequenceNumber: v.number(),
    entryHash: v.string(),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    const membership = await ctx.db.get("duesMemberships", args.duesMembershipId);
    if (!membership) {
      throw new Error("Dues membership record not found.");
    }

    if (membership.hasPaid) {
      throw new Error("This dues period has already been paid or waived.");
    }

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund) {
      throw new Error("Target fund not found.");
    }

    if (fund.organizationId !== membership.organizationId || membership.fundId !== args.fundId) {
      throw new Error("Fund does not match dues record.");
    }

    const { user } = await requirePermission(
      ctx,
      membership.organizationId,
      PERMISSIONS.SIGN_TREASURY
    );

    const event = await ctx.db.get("duesEvents", membership.duesEventId);
    if (!event) {
      throw new Error("Associated dues cycle event not found.");
    }

    const targetUser = await ctx.db.get("users", membership.userId);
    const memberName = targetUser?.name || "Member";

    const trimmedReason = args.reason.trim();
    if (!trimmedReason) {
      throw new Error("Waiver reason cannot be empty.");
    }

    const memo = `Dues Waived (${event.periodLabel}) - ${memberName}: ${trimmedReason}`;

    // Zero-amount signed waiver entry
    const commitResult = await executeCommit(ctx, user, fund, {
      direction: "credit",
      amount: 0,
      memo,
      keyId: args.keyId,
      previousHash: args.previousHash,
      signature: args.signature,
      entryType: "waiver",
      duesEventId: event._id,
    });

    const now = Date.now();
    await ctx.db.patch("duesMemberships", membership._id, {
      hasPaid: true,
      isWaived: true,
      paidAt: now,
      ledgerEntryId: commitResult.entryId,
      recordedBy: user._id,
    });

    await ctx.db.patch("duesEvents", event._id, {
      paidCount: event.paidCount + 1,
    });

    return {
      entryId: commitResult.entryId,
      sequenceNumber: commitResult.sequenceNumber,
      entryHash: commitResult.entryHash,
      timestamp: commitResult.timestamp,
    };
  },
});

/**
 * Returns paginated dues cycles for a specific fund using Convex reactive cursor pagination.
 */
export const listDuesEventsPaginated = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    paginationOpts: paginationOptsValidator,
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    if (args.includeArchived) {
      return await ctx.db
        .query("duesEvents")
        .withIndex("by_fundId_and_dueDate", (q) =>
          q.eq("fundId", args.fundId)
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    // By default, filter active non-archived events
    const paginated = await ctx.db
      .query("duesEvents")
      .withIndex("by_fundId_and_dueDate", (q) =>
        q.eq("fundId", args.fundId)
      )
      .order("desc")
      // eslint-disable-next-line @convex-dev/no-filter-in-query
      .filter((q) => q.or(
        q.eq(q.field("isArchived"), false),
        q.eq(q.field("isArchived"), undefined)
      ))
      .paginate(args.paginationOpts);

    return paginated;
  },
});

/**
 * Returns detailed inspection data for a single dues cycle, including collection metrics
 * and individual member status records.
 */
export const getDuesEventDetails = query({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventId: v.id("duesEvents"),
  },
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.VIEW_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const event = await ctx.db.get("duesEvents", args.duesEventId);
    if (!event || event.fundId !== args.fundId) {
      throw new Error("Dues cycle event not found.");
    }

    const memberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_duesEventId", (q) => q.eq("duesEventId", event._id))
      .collect();

    const memberDetails = [];
    let paidAmountTotal = 0;

    for (const m of memberships) {
      const user = await ctx.db.get("users", m.userId);
      const member = await ctx.db.get("members", m.memberId);

      if (m.hasPaid && !m.isWaived) {
        paidAmountTotal += event.amount;
      }

      memberDetails.push({
        _id: m._id,
        memberId: m.memberId,
        userId: m.userId,
        hasPaid: m.hasPaid,
        isWaived: m.isWaived,
        paidAt: m.paidAt,
        paymentMethod: m.paymentMethod,
        invoiceId: m.invoiceId,
        name: member?.nickname || user?.name || "Unknown Member",
        nickname: member?.nickname,
        email: user?.email,
        image: user?.image,
      });
    }

    memberDetails.sort((a, b) => a.name.localeCompare(b.name));

    const totalExpectedAmount = event.totalMembers * event.amount;
    const unpaidCount = Math.max(0, event.totalMembers - event.paidCount);
    const collectionRate = event.totalMembers > 0
      ? Math.round((event.paidCount / event.totalMembers) * 100)
      : 0;

    return {
      event: {
        _id: event._id,
        _creationTime: event._creationTime,
        periodLabel: event.periodLabel,
        dueDate: event.dueDate,
        amount: event.amount,
        totalMembers: event.totalMembers,
        paidCount: event.paidCount,
        isArchived: Boolean(event.isArchived),
      },
      stats: {
        totalExpectedAmount,
        totalCollectedAmount: paidAmountTotal,
        unpaidCount,
        collectionRate,
      },
      members: memberDetails,
    };
  },
});

/**
 * Updates an existing dues cycle's metadata (periodLabel, dueDate, amount, isArchived).
 * Protects CLE ledger integrity: dues amount cannot be modified once payments exist.
 * Auto-syncs newly joined organization members into the cycle roster.
 */
export const updateDuesCycle = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventId: v.id("duesEvents"),
    periodLabel: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    amount: v.optional(v.number()),
    isArchived: v.optional(v.boolean()),
  },
  returns: v.id("duesEvents"),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const event = await ctx.db.get("duesEvents", args.duesEventId);
    if (!event || event.fundId !== args.fundId) {
      throw new Error("Dues cycle event not found.");
    }

    const patchPayload: Record<string, any> = {};

    // 1. Period Label update
    if (args.periodLabel !== undefined) {
      const trimmedLabel = args.periodLabel.trim();
      if (!trimmedLabel) {
        throw new Error("Period label cannot be empty.");
      }

      if (trimmedLabel.toLowerCase() !== event.periodLabel.toLowerCase()) {
        const existingEvents = await ctx.db
          .query("duesEvents")
          .withIndex("by_fundId", (q) => q.eq("fundId", args.fundId))
          .collect();

        const duplicate = existingEvents.some(
          (e) => e._id !== event._id && e.periodLabel.toLowerCase().trim() === trimmedLabel.toLowerCase()
        );

        if (duplicate) {
          throw new Error(`A dues cycle with label '${trimmedLabel}' already exists in this fund.`);
        }
      }

      patchPayload.periodLabel = trimmedLabel;
    }

    // 2. Due Date update
    if (args.dueDate !== undefined) {
      if (isNaN(args.dueDate) || args.dueDate <= 0) {
        throw new Error("Invalid due date provided.");
      }
      patchPayload.dueDate = args.dueDate;
    }

    // 3. Amount update (with CLE payment protection)
    if (args.amount !== undefined && args.amount !== event.amount) {
      if (args.amount <= 0 || !Number.isInteger(args.amount)) {
        throw new Error("Amount must be a positive integer.");
      }

      if (event.paidCount > 0) {
        throw new Error(
          `Cannot modify dues amount for cycle '${event.periodLabel}': ${event.paidCount} payment(s) have already been committed to the cryptographic ledger. Revert payments first.`
        );
      }

      patchPayload.amount = args.amount;
    }

    // 4. Archive state update
    if (args.isArchived !== undefined) {
      patchPayload.isArchived = args.isArchived;
    }

    // 5. Auto-sync active organization members into this cycle
    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bannedUserIds = new Set(bans.map((b) => b.userId));
    const activeMembers = members.filter((m) => !bannedUserIds.has(m.userId));

    const existingMemberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_duesEventId", (q) => q.eq("duesEventId", event._id))
      .collect();

    const existingMemberIds = new Set(existingMemberships.map((m) => m.memberId));

    for (const member of activeMembers) {
      if (!existingMemberIds.has(member._id)) {
        await ctx.db.insert("duesMemberships", {
          duesEventId: event._id,
          organizationId: args.organizationId,
          fundId: args.fundId,
          memberId: member._id,
          userId: member.userId,
          hasPaid: false,
        });
      }
    }

    patchPayload.totalMembers = activeMembers.length;

    await ctx.db.patch("duesEvents", event._id, patchPayload);
    return event._id;
  },
});

/**
 * Deletes or archives a single dues cycle.
 * - If unpaid: permanently deletes cycle, memberships, and cancels pending draft invoices.
 * - If payments exist: safely soft-archives the cycle if allowArchive is true, preserving ledger proofs.
 */
export const deleteDuesCycle = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventId: v.id("duesEvents"),
    allowArchive: v.optional(v.boolean()),
  },
  returns: v.object({
    action: v.union(v.literal("deleted"), v.literal("archived")),
    eventId: v.id("duesEvents"),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const event = await ctx.db.get("duesEvents", args.duesEventId);
    if (!event || event.fundId !== args.fundId) {
      throw new Error("Dues cycle event not found.");
    }

    const memberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_duesEventId", (q) => q.eq("duesEventId", event._id))
      .collect();

    const hasPaidMembers = event.paidCount > 0 || memberships.some((m) => m.hasPaid || m.ledgerEntryId);

    if (hasPaidMembers) {
      if (args.allowArchive !== false) {
        await ctx.db.patch("duesEvents", event._id, { isArchived: true });
        return { action: "archived" as const, eventId: event._id };
      }

      throw new Error(
        `Cannot delete cycle '${event.periodLabel}': Payments have already been committed to the cryptographic ledger. You can archive this cycle instead.`
      );
    }

    // Cancel any open draft/pending invoices linked to this cycle's memberships
    for (const m of memberships) {
      if (m.invoiceId) {
        const inv = await ctx.db.get("invoices", m.invoiceId);
        if (inv && (inv.status === "draft" || inv.status === "pending")) {
          await ctx.db.patch("invoices", inv._id, { status: "cancelled" });
        }
      }
      await ctx.db.delete("duesMemberships", m._id);
    }

    await ctx.db.delete("duesEvents", event._id);
    return { action: "deleted" as const, eventId: event._id };
  },
});

/**
 * Multi-select batch deletion and archival of dues cycles.
 * Safely removes unpaid cycles and soft-archives paid cycles.
 */
export const deleteBatchDuesCycles = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventIds: v.array(v.id("duesEvents")),
    allowArchive: v.optional(v.boolean()),
  },
  returns: v.object({
    deletedCount: v.number(),
    archivedCount: v.number(),
    skippedCount: v.number(),
    processedIds: v.array(v.id("duesEvents")),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    let deletedCount = 0;
    let archivedCount = 0;
    let skippedCount = 0;
    const processedIds: any[] = [];
    const shouldArchivePaid = args.allowArchive !== false;

    for (const eventId of args.duesEventIds) {
      const event = await ctx.db.get("duesEvents", eventId);
      if (!event || event.fundId !== args.fundId) {
        skippedCount++;
        continue;
      }

      const memberships = await ctx.db
        .query("duesMemberships")
        .withIndex("by_duesEventId", (q) => q.eq("duesEventId", event._id))
        .collect();

      const hasPaidMembers = event.paidCount > 0 || memberships.some((m) => m.hasPaid || m.ledgerEntryId);

      if (hasPaidMembers) {
        if (shouldArchivePaid) {
          await ctx.db.patch("duesEvents", event._id, { isArchived: true });
          archivedCount++;
          processedIds.push(event._id);
        } else {
          skippedCount++;
        }
      } else {
        for (const m of memberships) {
          if (m.invoiceId) {
            const inv = await ctx.db.get("invoices", m.invoiceId);
            if (inv && (inv.status === "draft" || inv.status === "pending")) {
              await ctx.db.patch("invoices", inv._id, { status: "cancelled" });
            }
          }
          await ctx.db.delete("duesMemberships", m._id);
        }
        await ctx.db.delete("duesEvents", event._id);
        deletedCount++;
        processedIds.push(event._id);
      }
    }

    return {
      deletedCount,
      archivedCount,
      skippedCount,
      processedIds,
    };
  },
});

/**
 * Shifts due dates for selected dues cycles by +/- N days.
 */
export const bulkAdjustDates = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventIds: v.array(v.id("duesEvents")),
    offsetDays: v.number(),
  },
  returns: v.object({
    updatedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const offsetMs = args.offsetDays * 86400000;
    let updatedCount = 0;

    for (const eventId of args.duesEventIds) {
      const event = await ctx.db.get("duesEvents", eventId);
      if (event && event.fundId === args.fundId) {
        const newDate = Math.max(0, event.dueDate + offsetMs);
        await ctx.db.patch("duesEvents", event._id, { dueDate: newDate });
        updatedCount++;
      }
    }

    return { updatedCount };
  },
});

/**
 * Updates dues rate/amount across selected cycles that have zero recorded payments.
 * Cycles with existing payments are safely skipped to preserve ledger continuity.
 */
export const bulkAdjustAmounts = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventIds: v.array(v.id("duesEvents")),
    amount: v.number(),
  },
  returns: v.object({
    updatedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    if (args.amount <= 0 || !Number.isInteger(args.amount)) {
      throw new Error("Amount must be a positive integer.");
    }

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const eventId of args.duesEventIds) {
      const event = await ctx.db.get("duesEvents", eventId);
      if (!event || event.fundId !== args.fundId) {
        skippedCount++;
        continue;
      }

      if (event.paidCount > 0) {
        skippedCount++;
        continue;
      }

      await ctx.db.patch("duesEvents", event._id, { amount: args.amount });
      updatedCount++;
    }

    return { updatedCount, skippedCount };
  },
});

/**
 * Enrolls any missing active organization members into an existing dues cycle roster.
 */
export const syncCycleMembers = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.id("funds"),
    duesEventId: v.id("duesEvents"),
  },
  returns: v.object({
    addedCount: v.number(),
    totalMembers: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_TREASURY
    );

    const fund = await ctx.db.get("funds", args.fundId);
    if (!fund || fund.organizationId !== args.organizationId) {
      throw new Error("Fund not found or does not belong to this organization.");
    }

    const event = await ctx.db.get("duesEvents", args.duesEventId);
    if (!event || event.fundId !== args.fundId) {
      throw new Error("Dues cycle event not found.");
    }

    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bans = await ctx.db
      .query("bans")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    const bannedUserIds = new Set(bans.map((b) => b.userId));
    const activeMembers = members.filter((m) => !bannedUserIds.has(m.userId));

    const existingMemberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_duesEventId", (q) => q.eq("duesEventId", event._id))
      .collect();

    const existingMemberIds = new Set(existingMemberships.map((m) => m.memberId));
    let addedCount = 0;

    for (const member of activeMembers) {
      if (!existingMemberIds.has(member._id)) {
        await ctx.db.insert("duesMemberships", {
          duesEventId: event._id,
          organizationId: args.organizationId,
          fundId: args.fundId,
          memberId: member._id,
          userId: member.userId,
          hasPaid: false,
        });
        addedCount++;
      }
    }

    await ctx.db.patch("duesEvents", event._id, {
      totalMembers: activeMembers.length,
    });

    return {
      addedCount,
      totalMembers: activeMembers.length,
    };
  },
});

