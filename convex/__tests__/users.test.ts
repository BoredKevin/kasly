/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { createTestUser } from "./helpers";

const modules = import.meta.glob("../**/*.ts");

test("users: viewer returns null when unauthenticated", async () => {
  const t = convexTest(schema, modules);
  const profile = await t.query(api.users.viewer);
  expect(profile).toBeNull();
});

test("users: viewer returns profile for authenticated user", async () => {
  const t = convexTest(schema, modules);
  const { asUser, userId } = await createTestUser(t, "Alice Wonderland", "alice@kasly.dev");

  const profile = await asUser.query(api.users.viewer);
  expect(profile).not.toBeNull();
  expect(profile?._id).toBe(userId);
  expect(profile?.name).toBe("Alice Wonderland");
  expect(profile?.email).toBe("alice@kasly.dev");
});

test("users: updateProfile updates display name", async () => {
  const t = convexTest(schema, modules);
  const { asUser } = await createTestUser(t, "Bob Builder", "bob@kasly.dev");

  await asUser.mutation(api.users.updateProfile, { name: "Bob The Builder" });
  const profile = await asUser.query(api.users.viewer);
  expect(profile?.name).toBe("Bob The Builder");
});

test("users: changeEmail updates email address", async () => {
  const t = convexTest(schema, modules);
  const { asUser } = await createTestUser(t, "Charlie Brown", "charlie@kasly.dev");

  await asUser.mutation(api.users.changeEmail, { newEmail: "charlie.new@kasly.dev" });
  const profile = await asUser.query(api.users.viewer);
  expect(profile?.email).toBe("charlie.new@kasly.dev");
});
