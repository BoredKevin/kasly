/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { createTestUser, generateTestKeyPair, signPayload } from "./helpers";

const modules = import.meta.glob("../**/*.ts");

test("treasury: fund lifecycle, key approval, cryptographic entry commit, and chain verification", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(
    t,
    "Treasurer Owner",
    "treasurer@kasly.dev"
  );

  // 1. Create Organization
  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Treasury Org",
  });

  // 2. Create Fund
  const fundId = await asOwner.mutation(api.treasury.funds.create, {
    organizationId: orgId,
    name: "Kas Kelas",
    currency: "IDR",
    description: "Dana kas umum",
  });

  const fundsList = await asOwner.query(api.treasury.funds.list, {
    organizationId: orgId,
  });
  expect(fundsList.length).toBe(1);
  expect(fundsList[0].name).toBe("Kas Kelas");
  expect(fundsList[0].balance).toBe(0);

  // 3. Generate and Register Treasurer WebCrypto P-256 Key
  const { keyPair, publicKeyJwk, keyId } = await generateTestKeyPair();

  await asOwner.mutation(api.treasury.keys.requestKeyRegistration, {
    organizationId: orgId,
    publicKeyJwk,
    label: "Laptop Treasurer Key",
  });

  const pendingKeys = await asOwner.query(api.treasury.keys.listPendingKeys, {
    organizationId: orgId,
  });
  expect(pendingKeys.length).toBe(1);
  expect(pendingKeys[0].keyId).toBe(keyId);

  await asOwner.mutation(api.treasury.keys.approveKey, {
    pendingKeyId: pendingKeys[0]._id,
  });

  const activeKeys = await asOwner.query(api.treasury.keys.listActiveKeys, {
    organizationId: orgId,
  });
  expect(activeKeys.length).toBe(1);
  expect(activeKeys[0].keyId).toBe(keyId);

  // 4. Query Latest Entry (GENESIS state)
  const head0 = await asOwner.query(api.treasury.ledger.getLatestEntry, {
    fundId,
  });
  expect(head0.latestSequenceNumber).toBe(0);
  expect(head0.latestEntryHash).toBe("GENESIS");
  expect(head0.nextSequenceNumber).toBe(1);

  // 5. Commit Entry #1 (Credit Rp 100,000)
  const sig1 = await signPayload(keyPair.privateKey, {
    fundId,
    sequenceNumber: 1,
    previousHash: "GENESIS",
    direction: "credit",
    amount: 100000,
    memo: "Initial Deposit",
    keyId,
  });

  const entry1 = await asOwner.mutation(api.treasury.ledger.commitEntry, {
    fundId,
    previousHash: "GENESIS",
    direction: "credit",
    amount: 100000,
    memo: "Initial Deposit",
    keyId,
    signature: sig1,
  });

  expect(entry1.sequenceNumber).toBe(1);

  // 6. Commit Entry #2 (Debit Rp 30,000)
  const head1 = await asOwner.query(api.treasury.ledger.getLatestEntry, {
    fundId,
  });
  expect(head1.latestSequenceNumber).toBe(1);
  expect(head1.nextPreviousHash).toBe(entry1.entryHash);

  const sig2 = await signPayload(keyPair.privateKey, {
    fundId,
    sequenceNumber: 2,
    previousHash: entry1.entryHash,
    direction: "debit",
    amount: 30000,
    memo: "Stationery Expense",
    keyId,
  });

  const entry2 = await asOwner.mutation(api.treasury.ledger.commitEntry, {
    fundId,
    previousHash: entry1.entryHash,
    direction: "debit",
    amount: 30000,
    memo: "Stationery Expense",
    keyId,
    signature: sig2,
  });

  expect(entry2.sequenceNumber).toBe(2);

  // 7. Verify Checkpoints Creation
  const cpId = await asOwner.mutation(api.treasury.checkpoints.createCheckpoint, {
    fundId,
  });
  expect(cpId).toBeDefined();

  const checkpoints = await asOwner.query(
    api.treasury.checkpoints.listCheckpoints,
    { fundId }
  );
  expect(checkpoints.length).toBe(1);
  expect(checkpoints[0].sequenceNumber).toBe(2);
  expect(checkpoints[0].balanceAtCheckpoint).toBe(70000);

  // 8. Verify List Entries & Public Receipt
  const entriesList = await asOwner.query(api.treasury.ledger.listEntries, {
    fundId,
  });
  expect(entriesList.length).toBe(2);
  expect(entriesList[0].sequenceNumber).toBe(2); // newest first
  expect(entriesList[1].sequenceNumber).toBe(1);

  const audit = await asOwner.query(api.treasury.ledger.verifyChain, {
    fundId,
  });
  expect(audit.isValid).toBe(true);
  expect(audit.totalEntries).toBe(2);

  const receipt = await asOwner.query(api.treasury.ledger.getPublicEntry, {
    identifier: entry1.entryHash,
  });
  expect(receipt.status).toBe("success");
  if (receipt.status === "success") {
    expect(receipt.entry.memo).toBe("Initial Deposit");
    expect(receipt.entry.amount).toBe(100000);
  }

  // 9. Query Balances
  const balances = await asOwner.query(api.treasury.ledger.getBalances, {
    organizationId: orgId,
  });
  expect(balances.length).toBe(1);
  expect(balances[0].balance).toBe(70000);
});
