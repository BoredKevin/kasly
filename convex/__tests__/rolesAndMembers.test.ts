/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { createTestUser } from "./helpers";

const modules = import.meta.glob("../**/*.ts");

test("roles: create, list, update, and delete custom role", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Owner", "owner@kasly.dev");

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Role Test Org",
  });

  // Create custom role
  const roleId = await asOwner.mutation(api.roles.create, {
    organizationId: orgId,
    name: "Moderator",
    color: "#22c55e",
    position: 10,
    permissions: ["VIEW_AUDIT_LOG", "MANAGE_MEMBERS"],
  });

  const roles = await asOwner.query(api.roles.list, { organizationId: orgId });
  const modRole = roles.find((r) => r._id === roleId);
  expect(modRole).toBeDefined();
  expect(modRole?.name).toBe("Moderator");
  expect(modRole?.position).toBe(10);

  // Update role
  await asOwner.mutation(api.roles.update, {
    roleId,
    name: "Senior Moderator",
  });

  const updatedRoles = await asOwner.query(api.roles.list, { organizationId: orgId });
  expect(updatedRoles.find((r) => r._id === roleId)?.name).toBe("Senior Moderator");

  // Delete role
  await asOwner.mutation(api.roles.deleteRole, { roleId });
  const finalRoles = await asOwner.query(api.roles.list, { organizationId: orgId });
  expect(finalRoles.some((r) => r._id === roleId)).toBe(false);
});

test("members: assignRoles, updateNickname, kick, ban, and unban", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Owner", "owner@kasly.dev");
  const { asUser: asMember, userId: memberUserId } = await createTestUser(
    t,
    "Target Member",
    "target@kasly.dev"
  );

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Member Test Org",
  });

  // Join member via invite
  const { code: inviteCode } = await asOwner.mutation(api.invites.create, {
    organizationId: orgId,
  });

  await asMember.mutation(api.invites.accept, { code: inviteCode });

  // List members
  const memberList = await asOwner.query(api.members.list, { organizationId: orgId });
  expect(memberList.length).toBe(2);
  const targetMemberDoc = memberList.find((m) => m.userId === memberUserId);
  expect(targetMemberDoc).toBeDefined();

  // Update nickname
  await asOwner.mutation(api.members.updateNickname, {
    organizationId: orgId,
    targetUserId: memberUserId,
    nickname: "Target Nickname",
  });

  const updatedMemberList = await asOwner.query(api.members.list, { organizationId: orgId });
  expect(
    updatedMemberList.find((m) => m.userId === memberUserId)?.nickname
  ).toBe("Target Nickname");

  // Ban member
  await asOwner.mutation(api.members.ban, {
    organizationId: orgId,
    targetUserId: memberUserId,
    reason: "Testing ban behavior",
  });

  // Check ban list
  const bans = await asOwner.query(api.members.listBans, { organizationId: orgId });
  expect(bans.length).toBe(1);
  expect(bans[0].userId).toBe(memberUserId);

  // Unban member
  await asOwner.mutation(api.members.unban, {
    organizationId: orgId,
    targetUserId: memberUserId,
  });

  const bansAfter = await asOwner.query(api.members.listBans, { organizationId: orgId });
  expect(bansAfter.length).toBe(0);
});

test("invites: create, list, and revoke invite", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Owner", "owner@kasly.dev");

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "Invite Test Org",
  });

  const { code } = await asOwner.mutation(api.invites.create, {
    organizationId: orgId,
    maxUses: 5,
  });

  const invite = await asOwner.query(api.invites.get, { code });
  expect(invite).not.toBeNull();
  expect(invite?.organizationName).toBe("Invite Test Org");

  const invitesList = await asOwner.query(api.invites.list, { organizationId: orgId });
  expect(invitesList.length).toBe(1);
  expect(invitesList[0].code).toBe(code);

  // Revoke invite
  await asOwner.mutation(api.invites.revoke, {
    inviteId: invitesList[0]._id,
  });

  const inviteAfterRevoke = await asOwner.query(api.invites.get, { code });
  expect(inviteAfterRevoke).toBeNull();
});
