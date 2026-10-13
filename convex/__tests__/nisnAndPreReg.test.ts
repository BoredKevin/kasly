/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { createTestUser } from "./helpers";

const modules = import.meta.glob("../**/*.ts");

test("nisn: getStatus and internal set followed by verify", async () => {
  const t = convexTest(schema, modules);
  const { asUser, userId } = await createTestUser(t, "Student One", "student1@kasly.dev");

  // Initial status: not configured
  const status1 = await asUser.query(api.nisn.getStatus);
  expect(status1?.isSet).toBe(false);

  // Set NISN via internal mutation
  await t.mutation(internal.nisn.setInternal, {
    userId,
    nisn: "0012345678",
  });

  const status2 = await asUser.query(api.nisn.getStatus);
  expect(status2?.isSet).toBe(true);

  // Verify wrong NISN fails
  const failedVerify = await asUser.mutation(api.nisn.verify, {
    nisn: "0099999999",
  });
  expect(failedVerify.verified).toBe(false);

  // Verify correct NISN succeeds
  const successVerify = await asUser.mutation(api.nisn.verify, {
    nisn: "0012345678",
  });
  expect(successVerify.verified).toBe(true);
});

test("preRegistration: import roster, verify link, list placeholders, and delete placeholder", async () => {
  const t = convexTest(schema, modules);
  const { asUser: asOwner } = await createTestUser(t, "Teacher Admin", "teacher@kasly.dev");

  const orgId = await asOwner.mutation(api.organizations.create, {
    name: "SMAN 1 Class X",
  });

  // Import student roster
  const importResult = await asOwner.mutation(api.preRegistration.importRoster, {
    organizationId: orgId,
    students: [
      {
        name: "Citra Dewi",
        nisn: "1234567890",
        birthYear: "2008",
        phone: "081234567890",
      },
    ],
  });

  expect(importResult.insertedCount).toBe(1);
  const token = importResult.insertedStudents[0].token;
  const placeholderUserId = importResult.insertedStudents[0].userId;
  expect(token).toBeDefined();

  // List placeholder members
  const placeholders = await asOwner.query(api.preRegistration.listPlaceholderMembers, {
    organizationId: orgId,
  });
  expect(placeholders.length).toBe(1);
  expect(placeholders[0].name).toBe("Citra Dewi");

  // Check registration link public info
  const linkInfo = await t.query(api.preRegistration.getRegistrationLinkInfo, {
    token,
  });
  expect(linkInfo.isValid).toBe(true);
  expect(linkInfo.organizationName).toBe("SMAN 1 Class X");

  // Verify 3-factor identity for registration link
  const verifyResult = await t.mutation(api.preRegistration.verifyRegistrationLinkIdentity, {
    token,
    nisn: "1234567890",
    birthYear: "2008",
    phone: "081234567890",
  });
  expect(verifyResult.claimToken).toBeDefined();
  expect(verifyResult.displayName).toBe("Citra Dewi");

  // Delete placeholder member
  await asOwner.mutation(api.preRegistration.deletePlaceholderMember, {
    organizationId: orgId,
    userId: placeholderUserId,
  });

  const placeholdersAfter = await asOwner.query(api.preRegistration.listPlaceholderMembers, {
    organizationId: orgId,
  });
  expect(placeholdersAfter.length).toBe(0);
});
