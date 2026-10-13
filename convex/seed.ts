import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { PERMISSIONS } from "./permissions";
import {
  canonicalizeSigningPayload,
  canonicalizeEntryPayload,
  computeSha256,
  computeKeyIdFromJwk,
  bufferToBase64url,
} from "./treasury/helpers";

/**
 * Seeds comprehensive development data for testing Kasly.
 * Creates an organization, users, roles, members, crypto keys, funds,
 * cryptographically valid chained ledger entries, dues cycles, and invoices.
 *
 * Idempotent: Can be called multiple times without duplicate errors.
 */
export const seedDevData = mutation({
  args: {
    forceReset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // 1. App Settings
    const defaultSettings = [
      {
        key: "allowOrganizationCreation",
        value: true,
        description: "Allow users to create new organizations",
      },
      {
        key: "enableNISN",
        value: true,
        description: "Enable student NISN identity hashing and verification",
      },
    ];

    for (const setting of defaultSettings) {
      const existing = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", setting.key))
        .unique();
      if (!existing) {
        await ctx.db.insert("appSettings", setting);
      } else if (args.forceReset) {
        await ctx.db.patch("appSettings", existing._id, { value: setting.value });
      }
    }

    // 2. Users
    const existingAdmin = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "admin@kasly.dev"))
      .first();

    if (existingAdmin && !args.forceReset) {
      // Find existing organization
      const existingOrg = await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", "xii-mipa-1"))
        .first();

      return {
        status: "already_seeded",
        message: "Development data is already present. Pass forceReset: true to recreate.",
        organizationId: existingOrg?._id,
        adminUserId: existingAdmin._id,
      };
    }

    // Create or retrieve users
    const userSpecs = [
      {
        email: "admin@kasly.dev",
        name: "Kevin Admin (Ketua Kelas)",
        isClaimed: true,
      },
      {
        email: "treasurer@kasly.dev",
        name: "Siti Rahma (Bendahara)",
        isClaimed: true,
      },
      {
        email: "rizky@kasly.dev",
        name: "Ahmad Rizky Pratama",
        isClaimed: true,
        nisn: "v1$demo000000000001$d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
      },
      {
        email: "budi@kasly.dev",
        name: "Budi Santoso",
        isClaimed: true,
        nisn: "v1$demo000000000002$4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
      },
      {
        name: "Citra Lestari",
        isClaimed: false, // Unclaimed placeholder student
        birthYearHash: "v1$demo$2008hash",
        phoneHash: "v1$demo$08123456789hash",
      },
    ];

    const usersMap: Record<string, any> = {};

    for (const spec of userSpecs) {
      let user = spec.email
        ? await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", spec.email))
            .first()
        : null;

      if (!user) {
        const id = await ctx.db.insert("users", spec);
        user = await ctx.db.get("users", id);
      }
      usersMap[spec.email || "citra"] = user!;
    }

    const adminUser = usersMap["admin@kasly.dev"];
    const treasurerUser = usersMap["treasurer@kasly.dev"];
    const rizkyUser = usersMap["rizky@kasly.dev"];
    const budiUser = usersMap["budi@kasly.dev"];
    const citraUser = usersMap["citra"];

    // 3. Organization
    let org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", "xii-mipa-1"))
      .first();

    if (!org) {
      const orgId = await ctx.db.insert("organizations", {
        name: "SMA Negeri 1 Nusantara - XII MIPA 1",
        slug: "xii-mipa-1",
        description: "Organisasi resmi kas dan kepengurusan kelas XII MIPA 1 angkatan 2026.",
        ownerId: adminUser._id,
      });
      org = (await ctx.db.get("organizations", orgId))!;
    }

    // 4. Roles
    const existingRoles = await ctx.db
      .query("roles")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .collect();

    let everyoneRole = existingRoles.find((r) => r.isDefault);
    if (!everyoneRole) {
      const roleId = await ctx.db.insert("roles", {
        organizationId: org._id,
        name: "@everyone",
        description: "Default role for all enrolled members",
        position: 0,
        permissions: [
          PERMISSIONS.VIEW_ORGANIZATION,
          PERMISSIONS.CREATE_CONTENT,
          PERMISSIONS.CREATE_INVITES,
          PERMISSIONS.VIEW_TREASURY,
        ],
        isDefault: true,
        isSystem: true,
      });
      everyoneRole = (await ctx.db.get("roles", roleId))!;
    }

    let treasurerRole = existingRoles.find((r) => r.name === "Bendahara");
    if (!treasurerRole) {
      const roleId = await ctx.db.insert("roles", {
        organizationId: org._id,
        name: "Bendahara",
        description: "Pengelola kas dan otoritas penandatanganan transaksi",
        position: 10,
        color: "#10b981",
        permissions: [
          PERMISSIONS.VIEW_TREASURY,
          PERMISSIONS.SIGN_TREASURY,
          PERMISSIONS.MANAGE_TREASURY,
          PERMISSIONS.VIEW_AUDIT_LOG,
        ],
        isDefault: false,
      });
      treasurerRole = (await ctx.db.get("roles", roleId))!;
    }

    let ketuaRole = existingRoles.find((r) => r.name === "Ketua Kelas");
    if (!ketuaRole) {
      const roleId = await ctx.db.insert("roles", {
        organizationId: org._id,
        name: "Ketua Kelas",
        description: "Administrator utama kelas dengan wewenang penuh",
        position: 20,
        color: "#6366f1",
        permissions: [PERMISSIONS.ADMINISTRATOR],
        isDefault: false,
      });
      ketuaRole = (await ctx.db.get("roles", roleId))!;
    }

    // 5. Memberships
    const membersToEnsure = [
      { user: adminUser, roles: [ketuaRole._id, treasurerRole._id], nickname: "Kevin (Ketua)" },
      { user: treasurerUser, roles: [treasurerRole._id], nickname: "Siti (Bendahara)" },
      { user: rizkyUser, roles: [], nickname: "Rizky" },
      { user: budiUser, roles: [], nickname: "Budi" },
      { user: citraUser, roles: [], nickname: "Citra (Pending Claim)" },
    ];

    const memberDocsMap: Record<string, any> = {};

    for (const spec of membersToEnsure) {
      let member = await ctx.db
        .query("members")
        .withIndex("by_organizationId_and_userId", (q) =>
          q.eq("organizationId", org._id).eq("userId", spec.user._id)
        )
        .first();

      if (!member) {
        const memberId = await ctx.db.insert("members", {
          organizationId: org._id,
          userId: spec.user._id,
          roleIds: spec.roles,
          nickname: spec.nickname,
          joinedAt: Date.now() - 30 * 86400 * 1000,
        });
        member = (await ctx.db.get("members", memberId))!;
      }
      memberDocsMap[spec.user._id] = member;
    }

    // 6. Registration Link for Unclaimed Citra
    const existingRegLink = await ctx.db
      .query("registrationLinks")
      .withIndex("by_userId", (q) => q.eq("userId", citraUser._id))
      .first();

    if (!existingRegLink) {
      await ctx.db.insert("registrationLinks", {
        organizationId: org._id,
        userId: citraUser._id,
        token: "DEMO-CLAIM-CITRA-2026",
        createdAt: Date.now(),
        isClaimed: false,
      });
    }

    // 7. Invite Code
    const existingInvite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", "KELAS2026"))
      .first();

    if (!existingInvite) {
      await ctx.db.insert("invites", {
        organizationId: org._id,
        code: "KELAS2026",
        inviterId: adminUser._id,
        uses: 2,
        maxUses: 50,
      });
    }

    // 8. Generate Real ECDSA P-256 Keypair for Treasurer
    const keyPair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const publicKeyJwkObj = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJwkObj = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const publicKeyJwkString = JSON.stringify(publicKeyJwkObj);
    const privateKeyJwkString = JSON.stringify(privateKeyJwkObj);
    const keyId = await computeKeyIdFromJwk(publicKeyJwkString);

    // Register active treasurer key
    const existingKey = await ctx.db
      .query("treasurerKeys")
      .withIndex("by_organizationId_and_keyId", (q) =>
        q.eq("organizationId", org._id).eq("keyId", keyId)
      )
      .first();

    if (!existingKey) {
      await ctx.db.insert("treasurerKeys", {
        organizationId: org._id,
        userId: treasurerUser._id,
        publicKeyJwk: publicKeyJwkString,
        keyId,
        label: "Kunci Resmi Bendahara (Demo WebCrypto P-256)",
        registeredAt: Date.now() - 30 * 86400 * 1000,
        registeredBy: adminUser._id,
      });

      await ctx.db.insert("pendingKeys", {
        organizationId: org._id,
        userId: treasurerUser._id,
        publicKeyJwk: publicKeyJwkString,
        keyId,
        label: "Kunci Resmi Bendahara (Demo WebCrypto P-256)",
        requestedAt: Date.now() - 30 * 86400 * 1000,
        status: "approved",
        reviewedBy: adminUser._id,
        reviewedAt: Date.now() - 30 * 86400 * 1000,
      });
    }

    // 9. Treasury Funds
    const existingOrgFunds = await ctx.db
      .query("funds")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .collect();

    let kasUtama = existingOrgFunds.find((f) => f.name === "Kas Utama Kelas") ?? null;

    if (!kasUtama) {
      const fundId = await ctx.db.insert("funds", {
        organizationId: org._id,
        name: "Kas Utama Kelas",
        description: "Dana iuran kas rutin mingguan/bulanan untuk operasional kelas XII MIPA 1.",
        currency: "IDR",
        createdBy: adminUser._id,
        isArchived: false,
      });
      kasUtama = (await ctx.db.get("funds", fundId))!;
    }

    let danaBaksos = existingOrgFunds.find((f) => f.name === "Dana Kegiatan Baksos") ?? null;

    if (!danaBaksos) {
      const fundId = await ctx.db.insert("funds", {
        organizationId: org._id,
        name: "Dana Kegiatan Baksos",
        description: "Penggalangan dana sukarela untuk bakti sosial ke panti asuhan.",
        currency: "IDR",
        createdBy: adminUser._id,
        isArchived: false,
      });
      danaBaksos = (await ctx.db.get("funds", fundId))!;
    }

    // 10. Dues Schedule Configuration
    const existingDuesConfig = await ctx.db
      .query("duesConfig")
      .withIndex("by_fundId", (q) => q.eq("fundId", kasUtama._id))
      .first();

    if (!existingDuesConfig) {
      await ctx.db.insert("duesConfig", {
        organizationId: org._id,
        fundId: kasUtama._id,
        isEnabled: true,
        intervalType: "monthly",
        intervalValue: 1, // 1st day of the month
        amount: 25000, // IDR 25,000 per month
        createdBy: adminUser._id,
      });
    }

    // 11. Dues Cycles (duesEvents) & Memberships
    const existingDuesEvents = await ctx.db
      .query("duesEvents")
      .withIndex("by_fundId", (q) => q.eq("fundId", kasUtama._id))
      .collect();

    let eventJan = existingDuesEvents.find((e) => e.periodLabel === "Januari 2026") ?? null;

    const now = Date.now();
    const oneDay = 86400 * 1000;

    if (!eventJan) {
      const eventId = await ctx.db.insert("duesEvents", {
        organizationId: org._id,
        fundId: kasUtama._id,
        periodLabel: "Januari 2026",
        dueDate: now - 60 * oneDay,
        amount: 25000,
        totalMembers: 4,
        paidCount: 2,
      });
      eventJan = (await ctx.db.get("duesEvents", eventId))!;

      // Memberships for Event Jan
      await ctx.db.insert("duesMemberships", {
        organizationId: org._id,
        fundId: kasUtama._id,
        duesEventId: eventJan._id,
        memberId: memberDocsMap[rizkyUser._id]._id,
        userId: rizkyUser._id,
        hasPaid: true,
        paidAt: now - 58 * oneDay,
        paymentMethod: "manual_cle",
        recordedBy: treasurerUser._id,
      });

      await ctx.db.insert("duesMemberships", {
        organizationId: org._id,
        fundId: kasUtama._id,
        duesEventId: eventJan._id,
        memberId: memberDocsMap[budiUser._id]._id,
        userId: budiUser._id,
        hasPaid: true,
        paidAt: now - 55 * oneDay,
        paymentMethod: "gateway_borderpay",
        recordedBy: treasurerUser._id,
      });

      await ctx.db.insert("duesMemberships", {
        organizationId: org._id,
        fundId: kasUtama._id,
        duesEventId: eventJan._id,
        memberId: memberDocsMap[treasurerUser._id]._id,
        userId: treasurerUser._id,
        hasPaid: true,
        paidAt: now - 59 * oneDay,
        paymentMethod: "manual_cle",
        recordedBy: treasurerUser._id,
      });

      await ctx.db.insert("duesMemberships", {
        organizationId: org._id,
        fundId: kasUtama._id,
        duesEventId: eventJan._id,
        memberId: memberDocsMap[adminUser._id]._id,
        userId: adminUser._id,
        hasPaid: true,
        paidAt: now - 59 * oneDay,
        paymentMethod: "manual_cle",
        recordedBy: treasurerUser._id,
      });
    }

    let eventFeb = existingDuesEvents.find((e) => e.periodLabel === "Februari 2026") ?? null;

    if (!eventFeb) {
      const eventId = await ctx.db.insert("duesEvents", {
        organizationId: org._id,
        fundId: kasUtama._id,
        periodLabel: "Februari 2026",
        dueDate: now - 30 * oneDay,
        amount: 25000,
        totalMembers: 4,
        paidCount: 1,
      });
      eventFeb = (await ctx.db.get("duesEvents", eventId))!;

      await ctx.db.insert("duesMemberships", {
        organizationId: org._id,
        fundId: kasUtama._id,
        duesEventId: eventFeb._id,
        memberId: memberDocsMap[rizkyUser._id]._id,
        userId: rizkyUser._id,
        hasPaid: true,
        paidAt: now - 28 * oneDay,
        paymentMethod: "manual_cle",
        recordedBy: treasurerUser._id,
      });

      await ctx.db.insert("duesMemberships", {
        organizationId: org._id,
        fundId: kasUtama._id,
        duesEventId: eventFeb._id,
        memberId: memberDocsMap[budiUser._id]._id,
        userId: budiUser._id,
        hasPaid: false,
      });
    }

    // 12. Cryptographically Valid Chained Ledger Entries for "Kas Utama Kelas"
    const existingEntries = await ctx.db
      .query("ledgerEntries")
      .withIndex("by_fundId", (q) => q.eq("fundId", kasUtama._id))
      .collect();

    if (existingEntries.length === 0) {
      const entriesToCreate = [
        {
          direction: "credit" as const,
          amount: 500000,
          memo: "Saldo Awal Kas Kelas XII MIPA 1 (Transfer Kas Angkatan)",
          timestamp: now - 60 * oneDay,
          duesEventId: undefined,
        },
        {
          direction: "credit" as const,
          amount: 25000,
          memo: "Iuran Kas Januari 2026 - Ahmad Rizky",
          timestamp: now - 58 * oneDay,
          duesEventId: eventJan?._id,
        },
        {
          direction: "credit" as const,
          amount: 25000,
          memo: "Iuran Kas Januari 2026 - Budi Santoso",
          timestamp: now - 55 * oneDay,
          duesEventId: eventJan?._id,
        },
        {
          direction: "debit" as const,
          amount: 120000,
          memo: "Pembelian Alat Kebersihan & Spidol Papan Tulis Kelas",
          timestamp: now - 40 * oneDay,
          duesEventId: undefined,
        },
        {
          direction: "credit" as const,
          amount: 25000,
          memo: "Iuran Kas Februari 2026 - Ahmad Rizky",
          timestamp: now - 28 * oneDay,
          duesEventId: eventFeb?._id,
        },
      ];

      let previousHash = "GENESIS";
      let seq = 1;
      let runningBalance = 0;

      for (const item of entriesToCreate) {
        // Sign using real WebCrypto private key
        const signPayload = canonicalizeSigningPayload({
          fundId: kasUtama._id,
          sequenceNumber: seq,
          previousHash,
          direction: item.direction,
          amount: item.amount,
          memo: item.memo,
          keyId,
        });

        const signBytes = new TextEncoder().encode(signPayload);
        const signatureBuf = await crypto.subtle.sign(
          { name: "ECDSA", hash: { name: "SHA-256" } },
          keyPair.privateKey,
          signBytes
        );
        const signature = bufferToBase64url(signatureBuf);

        // Compute full entry hash
        const entryPayload = canonicalizeEntryPayload({
          organizationId: org._id,
          fundId: kasUtama._id,
          sequenceNumber: seq,
          previousHash,
          timestamp: item.timestamp,
          direction: item.direction,
          amount: item.amount,
          memo: item.memo,
          keyId,
          signerId: treasurerUser._id,
          signature,
          duesEventId: item.duesEventId,
        });

        const entryHash = await computeSha256(entryPayload);

        await ctx.db.insert("ledgerEntries", {
          organizationId: org._id,
          fundId: kasUtama._id,
          sequenceNumber: seq,
          previousHash,
          entryHash,
          timestamp: item.timestamp,
          direction: item.direction,
          amount: item.amount,
          memo: item.memo,
          keyId,
          signerId: treasurerUser._id,
          signature,
          duesEventId: item.duesEventId,
        });

        if (item.direction === "credit") {
          runningBalance += item.amount;
        } else {
          runningBalance -= item.amount;
        }

        previousHash = entryHash;
        seq++;
      }

      // 13. Ledger Checkpoint at Seq 5
      await ctx.db.insert("ledgerCheckpoints", {
        organizationId: org._id,
        fundId: kasUtama._id,
        sequenceNumber: 5,
        entryHash: previousHash,
        balanceAtCheckpoint: runningBalance,
        createdAt: now - 20 * oneDay,
        createdBy: treasurerUser._id,
      });
    }

    // 14. Sample Invoices
    const existingInvoices = await ctx.db
      .query("invoices")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", org._id))
      .collect();

    if (existingInvoices.length === 0) {
      await ctx.db.insert("invoices", {
        organizationId: org._id,
        fundId: kasUtama._id,
        invoiceNumber: "INV-202601-0001",
        type: "dues",
        title: "Iuran Kas Januari 2026 - Ahmad Rizky",
        payerName: "Ahmad Rizky Pratama",
        payerEmail: "rizky@kasly.dev",
        userId: rizkyUser._id,
        memberId: memberDocsMap[rizkyUser._id]._id,
        periodLabels: ["Januari 2026"],
        subtotal: 25000,
        gatewayFee: 0,
        totalAmount: 25000,
        currency: "IDR",
        status: "paid",
        paidAt: now - 58 * oneDay,
        createdBy: treasurerUser._id,
        createdAt: now - 60 * oneDay,
      });

      await ctx.db.insert("invoices", {
        organizationId: org._id,
        fundId: kasUtama._id,
        invoiceNumber: "INV-202602-0002",
        type: "dues",
        title: "Iuran Kas Februari 2026 - Budi Santoso",
        payerName: "Budi Santoso",
        payerEmail: "budi@kasly.dev",
        userId: budiUser._id,
        memberId: memberDocsMap[budiUser._id]._id,
        periodLabels: ["Februari 2026"],
        subtotal: 25000,
        gatewayFee: 750,
        totalAmount: 25750,
        currency: "IDR",
        status: "pending",
        selectedMethod: "qris",
        qrString: "00020101021226670016ID.CO.BORDERPAY.WWW01189360091100223344550215INV20260200025204581253033605405257505802ID5914KAS KELAS XII MIPA 16007JAKARTA61051234062200116INV-202602-00026304A1B2",
        createdBy: treasurerUser._id,
        createdAt: now - 5 * oneDay,
      });

      await ctx.db.insert("invoices", {
        organizationId: org._id,
        fundId: danaBaksos._id,
        invoiceNumber: "INV-202603-0003",
        type: "custom",
        title: "Donasi Sukarela Bakti Sosial - Alumni Kelas",
        payerName: "Donatur Anonim (Alumni)",
        subtotal: 100000,
        gatewayFee: 0,
        totalAmount: 100000,
        currency: "IDR",
        status: "paid",
        paidAt: now - 2 * oneDay,
        createdBy: adminUser._id,
        createdAt: now - 3 * oneDay,
      });
    }

    return {
      status: "success",
      message: "Development data successfully seeded!",
      adminUserId: adminUser._id,
      organization: {
        id: org._id,
        name: org.name,
        slug: org.slug,
      },
      treasurerKey: {
        keyId,
        publicKeyJwk: publicKeyJwkString,
        privateKeyJwk: privateKeyJwkString,
      },
      funds: {
        kasUtamaId: kasUtama._id,
        danaBaksosId: danaBaksos._id,
      },
    };
  },
});
