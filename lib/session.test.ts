import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAuthUserId,
  isStubUserId,
  mergeAppMetadataRole,
  optionalFieldRole,
  resolveSessionRole,
  roleFromAppMetadata,
} from "./session.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("auth.uid() ids are uuid; stub: prefix is rejected", () => {
  assert.equal(isAuthUserId("3d1c8a2e-4b7f-4a11-9c0d-1f2e3d4c5b6a"), true);
  assert.equal(isAuthUserId("stub:abc"), false);
  assert.equal(isStubUserId("stub:deadbeef"), true);
  assert.equal(isStubUserId("3d1c8a2e-4b7f-4a11-9c0d-1f2e3d4c5b6a"), false);
});

test("role mapping never reads user_metadata", () => {
  assert.equal(optionalFieldRole("viewer"), "viewer");
  assert.equal(optionalFieldRole("full"), "full");
  assert.equal(optionalFieldRole("puller"), "puller");
  assert.equal(optionalFieldRole("admin"), null);
  assert.equal(roleFromAppMetadata({ role: "full" }), "full");
  assert.equal(roleFromAppMetadata({ role: "nope" }), null);
});

test("resolveSessionRole prefers profiles, then app_metadata, then invite, else puller", async () => {
  const user = {
    id: "3d1c8a2e-4b7f-4a11-9c0d-1f2e3d4c5b6a",
    email: "pat.nguyen@crew.example",
    app_metadata: { role: "full" },
    user_metadata: { role: "viewer" },
  };
  assert.equal(
    await resolveSessionRole(user, { profileRole: "viewer" }),
    "viewer",
  );
  assert.equal(await resolveSessionRole(user), "full");
  assert.equal(
    await resolveSessionRole(
      { ...user, app_metadata: {} },
      { invitedRole: "viewer" },
    ),
    "viewer",
  );
  assert.equal(
    await resolveSessionRole({ ...user, app_metadata: {} }),
    "puller",
  );
});

test("invite role merge keeps existing app_metadata keys", () => {
  const merged = mergeAppMetadataRole(
    { provider: "email", providers: ["email"] },
    "viewer",
  );
  assert.equal(merged.role, "viewer");
  assert.equal(merged.provider, "email");
  assert.deepEqual(merged.providers, ["email"]);
});

test("session helpers stay Maple Point / fictional only", () => {
  const blob = [
    "Maple Point Medical Office",
    "pat.nguyen@crew.example",
    resolveSessionRole.toString(),
  ].join("\n");
  assert.equal(forbidden.test(blob), false);
});
