/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

test("seed: seedDevData successfully seeds initial development state and is idempotent", async () => {
  const t = convexTest(schema, modules);

  // Initial seeding run
  const result1 = await t.mutation(api.seed.seedDevData, {});
  expect(result1.status).toBe("success");
  expect(result1.organization?.name).toBe("SMA Negeri 1 Nusantara - XII MIPA 1");
  expect(result1.treasurerKey?.keyId).toBeDefined();
  expect(result1.treasurerKey?.privateKeyJwk).toBeDefined();
  expect(result1.funds?.kasUtamaId).toBeDefined();

  const asAdmin = t.withIdentity({
    name: "Kevin Admin",
    email: "admin@kasly.dev",
    subject: result1.adminUserId!,
  });

  // Audit cryptographic chain on seeded Kas Utama fund
  const audit = await asAdmin.query(api.treasury.ledger.verifyChain, {
    fundId: result1.funds!.kasUtamaId,
  });
  expect(audit.isValid).toBe(true);
  expect(audit.totalEntries).toBe(5);

  // Verify second run is idempotent
  const result2 = await t.mutation(api.seed.seedDevData, {});
  expect(result2.status).toBe("already_seeded");
});
