/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("../**/*.ts");

test("appSettings: returns default settings when unconfigured", async () => {
  const t = convexTest(schema, modules);
  const settings = await t.query(api.appSettings.get);
  expect(settings.allowOrganizationCreation).toBe(true);
  expect(settings.enableNISN).toBe(true);
  expect(settings.allowProfileNameChange).toBe(true);
  expect(settings.enablePreRegistration).toBe(false);
});

test("appSettings: populates default settings idempotently", async () => {
  const t = convexTest(schema, modules);
  const result1 = await t.mutation(api.appSettings.populate);
  expect(result1.added.length).toBeGreaterThan(0);
  expect(result1.skipped.length).toBe(0);

  // Calling populate again should skip already existing keys
  const result2 = await t.mutation(api.appSettings.populate);
  expect(result2.added.length).toBe(0);
  expect(result2.skipped.length).toBe(result1.added.length);
});
