import { v } from "convex/values";
import { query, mutation, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePermission, requireUser } from "./authz";
import { PERMISSIONS } from "./permissions";

/**
 * Converts an ArrayBuffer or Uint8Array to a lowercase hex string.
 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Retrieves the global pre-registration salt, or initializes a CSPRNG salt if not present.
 */
async function getOrCreatePreRegistrationSalt(ctx: MutationCtx): Promise<string> {
  const existing = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", "preRegistrationSalt"))
    .unique();

  if (existing && existing.description) {
    return existing.description;
  }

  const saltBytes = new Uint8Array(32);
  crypto.getRandomValues(saltBytes);
  const saltHex = bufferToHex(saltBytes);

  if (existing) {
    await ctx.db.patch("appSettings", existing._id, {
      description: saltHex,
    });
  } else {
    await ctx.db.insert("appSettings", {
      key: "preRegistrationSalt",
      value: true,
      description: saltHex,
    });
  }

  return saltHex;
}

/**
 * Computes a salted SHA-256 hash using the global pre-registration salt.
 */
async function hashWithSalt(salt: string, rawValue: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${rawValue}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(hashBuffer);
}

/**
 * Normalizes phone numbers (strips spaces, dashes, parentheses).
 */
function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)]/g, "").trim();
}

/**
 * Validates strictly 10-digit NISN format.
 */
function validateNisnFormat(nisn: string): boolean {
  return /^\d{10}$/.test(nisn);
}

/**
 * Validates 4-digit birth year format.
 */
function validateBirthYearFormat(year: string): boolean {
  return /^\d{4}$/.test(year);
}

/**
 * Step 1: Verifies student identity against unclaimed pre-registered placeholder records.
 * On match, mints a 15-minute single-use claim token.
 */
export const verifyClaimIdentity = mutation({
  args: {
    nisn: v.string(),
    birthYear: v.string(),
    phone: v.string(),
  },
  returns: v.object({
    claimToken: v.string(),
    displayName: v.string(),
  }),
  handler: async (ctx, args) => {
    // Check if pre-registration claim requirement is enabled
    const preRegSetting = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enablePreRegistration"))
      .unique();

    const isEnabled = preRegSetting !== null ? preRegSetting.value : false;
    if (!isEnabled) {
      throw new Error(
        "Pre-registration identity verification is currently disabled in system settings.",
      );
    }

    const trimmedNisn = args.nisn.trim();
    const trimmedBirthYear = args.birthYear.trim();
    const normalizedPhone = normalizePhoneNumber(args.phone);

    if (!validateNisnFormat(trimmedNisn)) {
      throw new Error("Invalid NISN format: Must be exactly 10 digits.");
    }

    if (!validateBirthYearFormat(trimmedBirthYear)) {
      throw new Error("Invalid Birth Year format: Must be exactly 4 digits (e.g. 2008).");
    }

    if (!normalizedPhone || normalizedPhone.length < 8) {
      throw new Error("Invalid phone number format.");
    }

    const salt = await getOrCreatePreRegistrationSalt(ctx);
    const candidateNisnHash = await hashWithSalt(salt, trimmedNisn);
    const candidateBirthYearHash = await hashWithSalt(salt, trimmedBirthYear);
    const candidatePhoneHash = await hashWithSalt(salt, normalizedPhone);

    // Query candidate users by nisn index
    const candidateUsers = await ctx.db
      .query("users")
      .withIndex("by_nisn", (q) => q.eq("nisn", candidateNisnHash))
      .collect();

    // Must be an unclaimed placeholder user (no email and isClaimed is false or undefined)
    const matchedUser = candidateUsers.find(
      (u) =>
        u.isClaimed === false ||
        (!u.email && u.isClaimed !== true),
    );

    if (!matchedUser) {
      throw new Error(
        "No matching pre-registration record found. Please verify your NISN, birth year, and phone number.",
      );
    }

    // Verify birth year hash and phone hash
    if (
      matchedUser.birthYearHash !== candidateBirthYearHash ||
      matchedUser.phoneHash !== candidatePhoneHash
    ) {
      throw new Error(
        "No matching pre-registration record found. Please verify your NISN, birth year, and phone number.",
      );
    }

    // Generate CSPRNG 32-byte claim token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const claimToken = bufferToHex(tokenBytes);

    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes TTL

    await ctx.db.insert("claimTokens", {
      token: claimToken,
      userId: matchedUser._id,
      expiresAt,
      isUsed: false,
    });

    return {
      claimToken,
      displayName: matchedUser.name || "Student",
    };
  },
});

/**
 * Imports a batch of pre-registered students into a target organization.
 * Inserts placeholder users and members records, and optionally enrolls them in past dues cycles.
 */
export const importRoster = mutation({
  args: {
    organizationId: v.id("organizations"),
    fundId: v.optional(v.id("funds")),
    defaultDuesCount: v.optional(v.number()),
    students: v.array(
      v.object({
        name: v.string(),
        nisn: v.string(),
        birthYear: v.string(),
        phone: v.string(),
        duesCount: v.optional(v.number()),
      }),
    ),
  },
  returns: v.object({
    insertedCount: v.number(),
    skippedCount: v.number(),
    skippedNisns: v.array(v.string()),
    assignedDuesTotal: v.number(),
  }),
  handler: async (ctx, args) => {
    // Requires MANAGE_MEMBERS permission in the organization
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const organization = await ctx.db.get("organizations", args.organizationId);
    if (!organization) {
      throw new Error("Target organization not found.");
    }

    // Retrieve default @everyone role for the organization
    const defaultRole = await ctx.db
      .query("roles")
      .withIndex("by_organizationId_and_isDefault", (q) =>
        q.eq("organizationId", args.organizationId).eq("isDefault", true),
      )
      .unique();

    // If fundId is provided, query existing dues cycles for that fund; otherwise query all active funds
    let availableDuesTarget: Array<{ event: any; fundId: Id<"funds"> }> = [];
    if (args.fundId) {
      const events = await ctx.db
        .query("duesEvents")
        .withIndex("by_fundId_and_dueDate", (q) => q.eq("fundId", args.fundId!))
        .order("desc")
        .collect();
      availableDuesTarget = events.map((e) => ({ event: e, fundId: args.fundId! }));
    } else {
      const activeFunds = await ctx.db
        .query("funds")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
        .filter((q) => q.neq(q.field("isArchived"), true))
        .collect();

      for (const fund of activeFunds) {
        const events = await ctx.db
          .query("duesEvents")
          .withIndex("by_fundId_and_dueDate", (q) => q.eq("fundId", fund._id))
          .order("desc")
          .collect();
        availableDuesTarget.push(...events.map((e) => ({ event: e, fundId: fund._id })));
      }
    }

    const salt = await getOrCreatePreRegistrationSalt(ctx);

    let insertedCount = 0;
    let skippedCount = 0;
    let assignedDuesTotal = 0;
    const skippedNisns: string[] = [];

    for (const student of args.students) {
      const trimmedName = student.name.trim();
      const trimmedNisn = student.nisn.trim();
      const trimmedBirthYear = student.birthYear.trim();
      const normalizedPhone = normalizePhoneNumber(student.phone);

      if (
        !trimmedName ||
        !validateNisnFormat(trimmedNisn) ||
        !validateBirthYearFormat(trimmedBirthYear) ||
        !normalizedPhone
      ) {
        skippedCount++;
        skippedNisns.push(trimmedNisn || "INVALID_FORMAT");
        continue;
      }

      const nisnHash = await hashWithSalt(salt, trimmedNisn);
      const birthYearHash = await hashWithSalt(salt, trimmedBirthYear);
      const phoneHash = await hashWithSalt(salt, normalizedPhone);

      // Check if user with this NISN already exists
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_nisn", (q) => q.eq("nisn", nisnHash))
        .first();

      if (existingUser) {
        skippedCount++;
        skippedNisns.push(trimmedNisn);
        continue;
      }

      // Create placeholder user
      const placeholderUserId = await ctx.db.insert("users", {
        name: trimmedName,
        nisn: nisnHash,
        birthYearHash,
        phoneHash,
        isClaimed: false,
      });

      // Add to organization members
      const placeholderMemberId = await ctx.db.insert("members", {
        organizationId: args.organizationId,
        userId: placeholderUserId,
        roleIds: defaultRole ? [defaultRole._id] : [],
        joinedAt: Date.now(),
      });

      // Assign past dues cycles (default to all available cycles as unpaid unless explicitly specified)
      const requestedDuesCount =
        student.duesCount !== undefined
          ? student.duesCount
          : args.defaultDuesCount !== undefined
          ? args.defaultDuesCount
          : availableDuesTarget.length;

      if (requestedDuesCount > 0 && availableDuesTarget.length > 0) {
        const cyclesToAssign = availableDuesTarget.slice(0, requestedDuesCount);

        for (const { event, fundId } of cyclesToAssign) {
          await ctx.db.insert("duesMemberships", {
            duesEventId: event._id,
            organizationId: args.organizationId,
            fundId,
            memberId: placeholderMemberId,
            userId: placeholderUserId,
            hasPaid: false,
          });

          await ctx.db.patch("duesEvents", event._id, {
            totalMembers: event.totalMembers + 1,
          });

          assignedDuesTotal += event.amount;
        }
      }

      insertedCount++;
    }

    return {
      insertedCount,
      skippedCount,
      skippedNisns,
      assignedDuesTotal,
    };
  },
});

/**
 * Lists all unclaimed placeholder members in an organization along with their unpaid dues summary.
 */
export const listPlaceholderMembers = query({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.array(
    v.object({
      memberId: v.id("members"),
      userId: v.id("users"),
      name: v.string(),
      joinedAt: v.number(),
      isClaimed: v.boolean(),
      unpaidCyclesCount: v.number(),
      unpaidAmount: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const members = await ctx.db
      .query("members")
      .withIndex("by_organizationId", (q) =>
        q.eq("organizationId", args.organizationId),
      )
      .take(500);

    const results = [];
    for (const member of members) {
      const user = await ctx.db.get("users", member.userId);
      if (!user) continue;

      const isClaimed = user.isClaimed === true || Boolean(user.email);
      if (!isClaimed) {
        // Query unpaid dues memberships for this placeholder member
        const duesMemberships = await ctx.db
          .query("duesMemberships")
          .withIndex("by_organizationId_and_userId", (q) =>
            q.eq("organizationId", args.organizationId).eq("userId", member.userId),
          )
          .collect();

        const unpaidMemberships = duesMemberships.filter((dm) => !dm.hasPaid && !dm.isWaived);
        let unpaidAmount = 0;
        for (const dm of unpaidMemberships) {
          const event = await ctx.db.get("duesEvents", dm.duesEventId);
          if (event) {
            unpaidAmount += event.amount;
          }
        }

        results.push({
          memberId: member._id,
          userId: member.userId,
          name: user.name || "Unnamed Student",
          joinedAt: member.joinedAt,
          isClaimed: false,
          unpaidCyclesCount: unpaidMemberships.length,
          unpaidAmount,
        });
      }
    }

    return results;
  },
});

/**
 * Returns detailed dues cycle assignments and available cycles for an unclaimed placeholder member.
 */
export const getPlaceholderMemberDues = query({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.object({
    enrolled: v.array(
      v.object({
        membershipId: v.id("duesMemberships"),
        duesEventId: v.id("duesEvents"),
        fundId: v.id("funds"),
        fundName: v.string(),
        currency: v.string(),
        periodLabel: v.string(),
        amount: v.number(),
        dueDate: v.number(),
        hasPaid: v.boolean(),
        isWaived: v.optional(v.boolean()),
      }),
    ),
    available: v.array(
      v.object({
        duesEventId: v.id("duesEvents"),
        fundId: v.id("funds"),
        fundName: v.string(),
        currency: v.string(),
        periodLabel: v.string(),
        amount: v.number(),
        dueDate: v.number(),
      }),
    ),
    totalUnpaidAmount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new Error("Student user record not found.");
    }

    // Query all dues memberships for this user in the org
    const memberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .collect();

    const enrolledEventIds = new Set(memberships.map((m) => m.duesEventId));

    const enrolledResults = [];
    let totalUnpaid = 0;

    for (const m of memberships) {
      const event = await ctx.db.get("duesEvents", m.duesEventId);
      if (!event) continue;

      const fund = await ctx.db.get("funds", event.fundId);
      if (!m.hasPaid && !m.isWaived) {
        totalUnpaid += event.amount;
      }

      enrolledResults.push({
        membershipId: m._id,
        duesEventId: event._id,
        fundId: event.fundId,
        fundName: fund?.name || "General Fund",
        currency: fund?.currency || "IDR",
        periodLabel: event.periodLabel,
        amount: event.amount,
        dueDate: event.dueDate,
        hasPaid: m.hasPaid,
        isWaived: m.isWaived,
      });
    }

    // Query all available dues events in the org not yet assigned to this student
    const allOrgEvents = await ctx.db
      .query("duesEvents")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .take(100);

    const availableResults = [];
    for (const ev of allOrgEvents) {
      if (!enrolledEventIds.has(ev._id)) {
        const fund = await ctx.db.get("funds", ev.fundId);
        availableResults.push({
          duesEventId: ev._id,
          fundId: ev.fundId,
          fundName: fund?.name || "General Fund",
          currency: fund?.currency || "IDR",
          periodLabel: ev.periodLabel,
          amount: ev.amount,
          dueDate: ev.dueDate,
        });
      }
    }

    return {
      enrolled: enrolledResults,
      available: availableResults,
      totalUnpaidAmount: totalUnpaid,
    };
  },
});

/**
 * Assigns an additional dues cycle to an unclaimed placeholder member.
 */
export const assignPlaceholderDuesCycle = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    duesEventId: v.id("duesEvents"),
  },
  returns: v.id("duesMemberships"),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const event = await ctx.db.get("duesEvents", args.duesEventId);
    if (!event || event.organizationId !== args.organizationId) {
      throw new Error("Dues cycle not found or does not belong to this organization.");
    }

    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();

    if (!member) {
      throw new Error("Member record not found.");
    }

    // Check if already assigned
    const existing = await ctx.db
      .query("duesMemberships")
      .withIndex("by_duesEventId_and_memberId", (q) =>
        q.eq("duesEventId", args.duesEventId).eq("memberId", member._id),
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const membershipId = await ctx.db.insert("duesMemberships", {
      duesEventId: event._id,
      organizationId: args.organizationId,
      fundId: event.fundId,
      memberId: member._id,
      userId: args.userId,
      hasPaid: false,
    });

    await ctx.db.patch("duesEvents", event._id, {
      totalMembers: event.totalMembers + 1,
    });

    return membershipId;
  },
});

/**
 * Removes a dues cycle assignment from an unclaimed placeholder member.
 */
export const removePlaceholderDuesCycle = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipId: v.id("duesMemberships"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const membership = await ctx.db.get("duesMemberships", args.membershipId);
    if (!membership || membership.organizationId !== args.organizationId) {
      throw new Error("Dues membership not found.");
    }

    const event = await ctx.db.get("duesEvents", membership.duesEventId);
    if (event) {
      await ctx.db.patch("duesEvents", event._id, {
        totalMembers: Math.max(0, event.totalMembers - 1),
        paidCount: membership.hasPaid ? Math.max(0, event.paidCount - 1) : event.paidCount,
      });
    }

    await ctx.db.delete("duesMemberships", args.membershipId);
    return null;
  },
});

/**
 * Toggles payment status (Paid / Unpaid) on a placeholder member's dues cycle.
 */
export const togglePlaceholderDuesPayment = mutation({
  args: {
    organizationId: v.id("organizations"),
    membershipId: v.id("duesMemberships"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const membership = await ctx.db.get("duesMemberships", args.membershipId);
    if (!membership || membership.organizationId !== args.organizationId) {
      throw new Error("Dues membership not found.");
    }

    const event = await ctx.db.get("duesEvents", membership.duesEventId);
    if (!event) {
      throw new Error("Dues event not found.");
    }

    const newPaidStatus = !membership.hasPaid;

    await ctx.db.patch("duesMemberships", membership._id, {
      hasPaid: newPaidStatus,
      paidAt: newPaidStatus ? Date.now() : undefined,
    });

    await ctx.db.patch("duesEvents", event._id, {
      paidCount: newPaidStatus
        ? event.paidCount + 1
        : Math.max(0, event.paidCount - 1),
    });

    return newPaidStatus;
  },
});

/**
 * Deletes an unclaimed placeholder member from an organization and removes the placeholder user.
 */
export const deletePlaceholderMember = mutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requirePermission(
      ctx,
      args.organizationId,
      PERMISSIONS.MANAGE_MEMBERS,
    );

    const targetUser = await ctx.db.get("users", args.userId);
    if (!targetUser) {
      throw new Error("Target placeholder user not found.");
    }

    if (targetUser.isClaimed === true || targetUser.email) {
      throw new Error("Cannot delete a member who has already claimed their account.");
    }

    // Find and delete member record
    const member = await ctx.db
      .query("members")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .unique();

    if (member) {
      await ctx.db.delete("members", member._id);
    }

    // Delete any dues memberships for this placeholder
    const duesMemberships = await ctx.db
      .query("duesMemberships")
      .withIndex("by_organizationId_and_userId", (q) =>
        q.eq("organizationId", args.organizationId).eq("userId", args.userId),
      )
      .collect();

    for (const dm of duesMemberships) {
      await ctx.db.delete("duesMemberships", dm._id);
    }

    // Delete placeholder user
    await ctx.db.delete("users", targetUser._id);

    return null;
  },
});

/**
 * Toggles the global pre-registration requirement setting.
 */
export const togglePreRegistration = mutation({
  args: {
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireUser(ctx);

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "enablePreRegistration"))
      .unique();

    if (existing) {
      await ctx.db.patch("appSettings", existing._id, {
        value: args.enabled,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: "enablePreRegistration",
        value: args.enabled,
        description:
          "Controls whether user registration requires claiming a pre-registered identity.",
      });
    }

    return null;
  },
});
