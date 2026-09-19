import assert from "node:assert/strict";
import { test } from "node:test";
import { readFieldRole, STUB_SESSION_COOKIE } from "./auth.ts";

test("readFieldRole keeps invited viewer even if Procore is linked", () => {
  const role = readFieldRole({
    cookieValue: "1",
    header: "true",
    sessionRole: "viewer",
  });
  assert.deepEqual(role, { procoreLinked: false, role: "viewer" });
});

test("readFieldRole keeps invited full / puller session", () => {
  const linked = readFieldRole({
    cookieValue: "1",
    sessionRole: "puller",
  });
  assert.deepEqual(linked, { procoreLinked: true, role: "puller" });

  const unlinked = readFieldRole({
    sessionRole: "puller",
  });
  assert.deepEqual(unlinked, { procoreLinked: false, role: "puller" });

  const invitedFull = readFieldRole({
    cookieValue: "1",
    sessionRole: "full",
  });
  assert.deepEqual(invitedFull, { procoreLinked: true, role: "full" });
});

test("readFieldRole falls back to Procore cookie when no stub role", () => {
  assert.deepEqual(readFieldRole({ cookieValue: "1" }), {
    procoreLinked: true,
    role: "puller",
  });
  assert.deepEqual(readFieldRole({}), {
    procoreLinked: false,
    role: "viewer",
  });
});

test("readFieldRoleFrom cookie header prefers stub session role", () => {
  const session = encodeURIComponent(
    JSON.stringify({
      userId: "stub:abc",
      email: "alex.rivera@crew.example",
      role: "viewer",
    }),
  );
  const role = readFieldRole({
    cookieHeader: `${STUB_SESSION_COOKIE}=${session}; gcfieldlog_procore_linked=1`,
  });
  assert.equal(role.role, "viewer");
  assert.equal(role.procoreLinked, false);
});
