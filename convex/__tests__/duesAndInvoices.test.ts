/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { createTestUser, generateTestKeyPair, signPayload } from "./helpers";

const modules = import.meta.glob("../**/*.ts");

test("dues & invoices: config, cycle creation, spreadsheet grid, invoice lifecycle, and settlement", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(
    t,
    "Treasury Admin",
    "treasuryadmin@kasly.dev"
  );
  const { asUser: asStudent, userId: studentUserId } = await createTestUser(
    t,
    "Student Member",
    "student@kasly.dev"
  );

  // 1. Create Organization
  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Dues Test Class",
  });

  // Add student as member via invite
  const { code } = await asOwner.mutation(api.invites.create, {
    organizationId: orgId,
  });
  await asStudent.mutation(api.invites.accept, { code });

  // 2. Create Fund
  const fundId = await asOwner.mutation(api.treasury.funds.create, {
    organizationId: orgId,
    name: "Kas Kelas Rutin",
    currency: "IDR",
  });

  // 3. Configure Dues
  const duesConfigId = await asOwner.mutation(api.treasury.dues.upsertDuesConfig, {
    organizationId: orgId,
    fundId,
    isEnabled: true,
    intervalType: "monthly",
    intervalValue: 1,
    amount: 20000,
  });
  expect(duesConfigId).toBeDefined();

  const config = await asOwner.query(api.treasury.dues.getDuesConfig, {
    organizationId: orgId,
    fundId,
  });
  expect(config?.amount).toBe(20000);
  expect(config?.isEnabled).toBe(true);

  // 4. Create Manual Dues Cycle
  const now = Date.now();
  const eventId = await asOwner.mutation(api.treasury.dues.createManualDuesCycle, {
    organizationId: orgId,
    fundId,
    dueDate: now,
    periodLabel: "Oktober 2026",
    amount: 20000,
  });
  expect(eventId).toBeDefined();

  const events = await asOwner.query(api.treasury.dues.listDuesEvents, {
    organizationId: orgId,
    fundId,
  });
  expect(events.length).toBe(1);
  expect(events[0].periodLabel).toBe("Oktober 2026");

  // 5. Query Dues Spreadsheet Grid (Verifies our optimized indexed query)
  const spreadsheet = await asOwner.query(api.treasury.dues.getDuesSpreadsheet, {
    organizationId: orgId,
    fundId,
  });
  expect(spreadsheet.events.length).toBe(1);
  expect(spreadsheet.members.length).toBe(2); // Owner + Student
  expect(spreadsheet.cells.length).toBe(2);

  // 6. Register Treasurer Key
  const { keyPair, publicKeyJwk, keyId } = await generateTestKeyPair();
  await asOwner.mutation(api.treasury.keys.requestKeyRegistration, {
    organizationId: orgId,
    publicKeyJwk,
  });
  const pendingKeys = await asOwner.query(api.treasury.keys.listPendingKeys, {
    organizationId: orgId,
  });
  await asOwner.mutation(api.treasury.keys.approveKey, {
    pendingKeyId: pendingKeys[0]._id,
  });

  // 7. Mark Dues Paid with Signed Cryptographic Commit
  const sig = await signPayload(keyPair.privateKey, {
    fundId,
    sequenceNumber: 1,
    previousHash: "GENESIS",
    direction: "credit",
    amount: 20000,
    memo: "Dues Payment (1 cycle: Oktober 2026) - Student Member",
    keyId,
  });

  const paidResult = await asOwner.mutation(api.treasury.dues.markDuesPaid, {
    organizationId: orgId,
    userId: studentUserId,
    fundId,
    periodCount: 1,
    keyId,
    previousHash: "GENESIS",
    signature: sig,
  });
  expect(paidResult.markedPeriods).toBe(1);
  expect(paidResult.totalAmount).toBe(20000);

  // Verify spreadsheet reflects paid status
  const spreadsheetAfter = await asOwner.query(api.treasury.dues.getDuesSpreadsheet, {
    organizationId: orgId,
    fundId,
  });
  const studentCell = spreadsheetAfter.cells.find((c) => c.userId === studentUserId);
  expect(studentCell?.hasPaid).toBe(true);

  // 8. Create Custom Invoice
  const customInvNumber = await asOwner.mutation(api.treasury.invoices.createCustomInvoice, {
    organizationId: orgId,
    fundId,
    title: "Kaos Kelas Angkatan",
    amount: 75000,
    payerName: "Student Member",
    payerEmail: "student@kasly.dev",
  });
  expect(customInvNumber).toBeDefined();

  // 9. Query Invoices with Compound Indexed Filters
  const invoicesList = await asOwner.query(api.treasury.invoices.listInvoices, {
    organizationId: orgId,
    fundId,
    status: "draft",
  });
  expect(invoicesList.length).toBe(1);
  expect(invoicesList[0].invoiceNumber).toBe(customInvNumber);
  expect(invoicesList[0].totalAmount).toBe(75000);

  // 10. Settle Invoice via Internal Mutation
  await t.mutation(internal.treasury.settlement._completeInvoicePaidMutation, {
    invoiceId: invoicesList[0]._id,
    paidAt: Date.now(),
    provider: "test_gateway",
  });

  const paidInvoice = await asOwner.query(api.treasury.invoices.getInvoice, {
    invoiceNumber: customInvNumber,
  });
  expect(paidInvoice?.status).toBe("paid");
});
