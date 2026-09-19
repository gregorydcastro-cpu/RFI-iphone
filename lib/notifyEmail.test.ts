import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeNotifyEmail,
  parseNotifyEmailInput,
  resolveBumpNotifyRecipients,
} from "./notifyMike.ts";
import type { ShareRefreshBump } from "./shareRefresh.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const mapleOwner = "stub:maple-puller";

const mapleBump: ShareRefreshBump = {
  sheet_id: "E-101",
  old_rev: "A",
  new_rev: "B",
  project_name: "Maple Point Medical Office",
  owner_user_id: mapleOwner,
};

test("notify email helpers stay Maple Point / fictional only", () => {
  const plan = resolveBumpNotifyRecipients(
    [mapleBump],
    new Map([[mapleOwner, "foreman@crew.example"]]),
  );
  const blob = JSON.stringify({ mapleBump, plan });
  assert.equal(forbidden.test(blob), false);
  assert.match(blob, /Maple Point Medical Office/);
});

test("parseNotifyEmailInput trims and lowercases on write", () => {
  assert.deepEqual(parseNotifyEmailInput("  Pat@Crew.Example  "), {
    ok: true,
    notify_email: "pat@crew.example",
  });
  assert.deepEqual(parseNotifyEmailInput("   "), { ok: true, notify_email: null });
  assert.deepEqual(parseNotifyEmailInput(null), { ok: true, notify_email: null });
  assert.equal(parseNotifyEmailInput("not-an-email").ok, false);
  assert.equal(normalizeNotifyEmail("  FOREMAN@crew.example "), "foreman@crew.example");
  assert.equal(normalizeNotifyEmail("nope"), null);
});

test("resolveBumpNotifyRecipients uses notify_email and ignores fallback", () => {
  const plan = resolveBumpNotifyRecipients(
    [mapleBump],
    new Map([[mapleOwner, "foreman@crew.example"]]),
    "mike@crew.example",
  );
  assert.equal(plan.deliveries.length, 1);
  assert.equal(plan.deliveries[0]?.to, "foreman@crew.example");
  assert.equal(plan.deliveries[0]?.source, "notify_email");
  assert.equal(plan.skipped.length, 0);
});

test("resolveBumpNotifyRecipients skips when notify_email is unset", () => {
  const plan = resolveBumpNotifyRecipients(
    [mapleBump],
    new Map([[mapleOwner, null]]),
  );
  assert.equal(plan.deliveries.length, 0);
  assert.equal(plan.skipped.length, 1);
  assert.equal(plan.skipped[0]?.reason, "unset");
  assert.equal(plan.skipped[0]?.owner_user_id, mapleOwner);
});

test("resolveBumpNotifyRecipients uses temporary NOTIFY_MIKE_EMAIL fallback", () => {
  const plan = resolveBumpNotifyRecipients(
    [mapleBump],
    new Map([[mapleOwner, ""]]),
    "mike@crew.example",
  );
  assert.equal(plan.deliveries[0]?.to, "mike@crew.example");
  assert.equal(plan.deliveries[0]?.source, "fallback");
});

test("resolveBumpNotifyRecipients groups by owner and skips orphan pins", () => {
  const other: ShareRefreshBump = {
    ...mapleBump,
    sheet_id: "A-101",
    owner_user_id: "stub:other-gc",
  };
  const orphan: ShareRefreshBump = {
    ...mapleBump,
    sheet_id: "E-102",
    owner_user_id: null,
  };
  const plan = resolveBumpNotifyRecipients(
    [mapleBump, other, orphan],
    new Map([
      [mapleOwner, "foreman@crew.example"],
      ["stub:other-gc", null],
    ]),
  );
  assert.equal(plan.deliveries.length, 1);
  assert.equal(plan.deliveries[0]?.owner_user_id, mapleOwner);
  assert.equal(plan.skipped.length, 2);
  assert.deepEqual(
    plan.skipped.map((item) => item.reason).sort(),
    ["no_owner", "unset"],
  );
});
