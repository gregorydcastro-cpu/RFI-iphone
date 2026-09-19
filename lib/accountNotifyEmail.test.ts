import assert from "node:assert/strict";
import { test } from "node:test";
import { canManageNotifyEmail } from "./accountRole.ts";
import { parseNotifyEmailInput } from "./notifyMike.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("account notify helpers stay Maple Point / fictional only", () => {
  const parsed = parseNotifyEmailInput("  Foreman@Crew.Example ");
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.notify_email, "foreman@crew.example");
  assert.equal(forbidden.test(JSON.stringify(parsed)), false);
});

test("parseNotifyEmailInput trims and lowercases for Account save", () => {
  assert.deepEqual(parseNotifyEmailInput("  Pat.Nguyen@Crew.Example "), {
    ok: true,
    notify_email: "pat.nguyen@crew.example",
  });
  assert.deepEqual(parseNotifyEmailInput(""), { ok: true, notify_email: null });
  assert.equal(parseNotifyEmailInput("not-an-email").ok, false);
});

test("canManageNotifyEmail is puller / GC / foreman stub role", () => {
  assert.equal(canManageNotifyEmail("puller"), true);
  assert.equal(canManageNotifyEmail("viewer"), false);
  assert.equal(canManageNotifyEmail(null), false);
});
