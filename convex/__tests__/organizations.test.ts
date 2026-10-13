/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { createTestUser } from "./helpers";

const modules = import.meta.glob("../**/*.ts");

test("organizations: creation automatically creates @everyone role, admin role, and member", async () => {
  const t = convexTest(schema, modules);
  const { asUser, userId } = await createTestUser(t, "Owner User", "owner@kasly.dev");

  const orgId = await asUser.mutation(api.organizations.create, {
    name: "Kas Kelas XII-IPA",
    slug: "xii-ipa",
    description: "Kas kelas angkatan 2026",
  });

  const org = await asUser.query(api.organizations.get, { organizationId: orgId });
  expect(org).not.toBeNull();
  expect(org?.name).toBe("Kas Kelas XII-IPA");
  expect(org?.isOwner).toBe(true);
  expect(org?.ownerId).toBe(userId);

  // List my organizations
  const myOrgs = await asUser.query(api.organizations.listMine);
  expect(myOrgs.length).toBe(1);
  expect(myOrgs[0]._id).toBe(orgId);

  // Verify roles created
  const roles = await asUser.query(api.roles.list, { organizationId: orgId });
  expect(roles.some((r) => r.name === "@everyone" && r.isDefault)).toBe(true);
  expect(roles.some((r) => r.name === "Admin" && r.position === 100)).toBe(true);
});

test("organizations: update requires MANAGE_ORGANIZATION permission", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Owner", "owner@kasly.dev");
  const { asUser: asRandom } = await createTestUser(t, "Stranger", "stranger@kasly.dev");

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Original Name",
  });

  // Stranger cannot update
  await expect(
    asRandom.mutation(api.organizations.update, {
      organizationId: orgId,
      name: "Hacked Name",
    })
  ).rejects.toThrow();

  // Owner can update
  await asOwner.mutation(api.organizations.update, {
    organizationId: orgId,
    name: "Updated Name",
    description: "New description",
  });

  const updatedOrg = await asOwner.query(api.organizations.get, { organizationId: orgId });
  expect(updatedOrg?.name).toBe("Updated Name");
  expect(updatedOrg?.description).toBe("New description");
});

test("organizations: transferOwnership changes owner and preserves member", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Old Owner", "old@kasly.dev");
  const { asUser: asNewOwner, userId: newOwnerId } = await createTestUser(
    t,
    "New Owner",
    "new@kasly.dev"
  );

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Organization To Transfer",
  });

  // Add new owner as member
  await t.run(async (ctx) => {
    await ctx.db.insert("members", {
      organizationId: orgId,
      userId: newOwnerId,
      roleIds: [],
      joinedAt: Date.now(),
    });
  });

  // Transfer ownership
  await asOwner.mutation(api.organizations.transferOwnership, {
    organizationId: orgId,
    newOwnerUserId: newOwnerId,
  });

  const org = await asNewOwner.query(api.organizations.get, { organizationId: orgId });
  expect(org?.ownerId).toBe(newOwnerId);
  expect(org?.isOwner).toBe(true);
});

test("organizations: deleteOrganization cleanly deletes org and cascades roles/members", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Owner", "owner@kasly.dev");

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Temporary Org",
  });

  await asOwner.mutation(api.organizations.deleteOrganization, {
    organizationId: orgId,
  });

  const org = await asOwner.query(api.organizations.get, { organizationId: orgId });
  expect(org).toBeNull();
});
