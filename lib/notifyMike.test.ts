import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  formatNotifyMikeMessage,
  maskEmail,
  notifyEligibleBumps,
  notifyMailerConfigured,
  notifyMikeConfigured,
  notifyMikeOnBumps,
  readNotifyMikeEmail,
} from "./notifyMike.ts";
import type { ShareRefreshBump } from "./shareRefresh.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const previous = {
  NOTIFY_MIKE_EMAIL: process.env.NOTIFY_MIKE_EMAIL,
  NOTIFY_FROM_EMAIL: process.env.NOTIFY_FROM_EMAIL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM: process.env.RESEND_FROM,
  GMAIL_USER: process.env.GMAIL_USER,
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD,
  NOTIFY_MIKE_SMS: process.env.NOTIFY_MIKE_SMS,
};

afterEach(() => {
  restoreEnv("NOTIFY_MIKE_EMAIL", previous.NOTIFY_MIKE_EMAIL);
  restoreEnv("NOTIFY_FROM_EMAIL", previous.NOTIFY_FROM_EMAIL);
  restoreEnv("RESEND_API_KEY", previous.RESEND_API_KEY);
  restoreEnv("RESEND_FROM", previous.RESEND_FROM);
  restoreEnv("GMAIL_USER", previous.GMAIL_USER);
  restoreEnv("GMAIL_APP_PASSWORD", previous.GMAIL_APP_PASSWORD);
  restoreEnv("NOTIFY_MIKE_SMS", previous.NOTIFY_MIKE_SMS);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function clearNotifyEnv() {
  delete process.env.NOTIFY_MIKE_EMAIL;
  delete process.env.NOTIFY_FROM_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM;
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.NOTIFY_MIKE_SMS;
}

const mapleBump: ShareRefreshBump = {
  sheet_id: "E-101",
  old_rev: "A",
  new_rev: "B",
  project_name: "Maple Point Medical Office",
};

test("notify copy stays Maple Point / fictional only", () => {
  const message = formatNotifyMikeMessage([mapleBump]);
  const blob = JSON.stringify({ message, bump: mapleBump });
  assert.equal(forbidden.test(blob), false);
  assert.match(message.subject, /E-101/);
  assert.match(message.subject, /Rev B/);
  assert.match(message.text, /Maple Point Medical Office/);
  assert.match(message.text, /E-101/);
  assert.match(message.text, /A → B/);
});

test("maskEmail never returns the full local part", () => {
  assert.equal(maskEmail("mike@crew.example"), "m***@crew.example");
});

test("notifyEligibleBumps skips unchanged and persist failures", () => {
  assert.deepEqual(notifyEligibleBumps([]), []);
  assert.deepEqual(notifyEligibleBumps([mapleBump]), [mapleBump]);
  assert.deepEqual(
    notifyEligibleBumps([mapleBump], [
      { sheet_id: "E-101", project_name: mapleBump.project_name, error: "pinned_sheets rev patch failed" },
    ]),
    [],
  );
  assert.deepEqual(
    notifyEligibleBumps([mapleBump], [{ error: "sheet_revision_cache upsert failed" }]),
    [],
  );
});

test("missing notify env skips without sending", async () => {
  clearNotifyEnv();
  assert.equal(notifyMikeConfigured(), false);
  assert.equal(notifyMailerConfigured(), false);
  assert.equal(readNotifyMikeEmail(), undefined);

  const result = await notifyMikeOnBumps([mapleBump], [], {
    fetch: async () => {
      throw new Error("fetch should not run when unconfigured");
    },
  });
  assert.equal(result.skipped, true);
  assert.equal(result.sent, false);
  assert.equal(result.attempted, false);
  assert.equal(result.code, "notify_unconfigured");
  assert.equal(result.status, 503);
  assert.equal(result.bumps, 1);
  assert.equal(result.sms.attempted, false);
  assert.match(result.note, /NOTIFY_MIKE_EMAIL/);
});

test("unchanged sheets do not notify even when mail env is set", async () => {
  clearNotifyEnv();
  process.env.NOTIFY_MIKE_EMAIL = "mike@crew.example";
  process.env.RESEND_API_KEY = "re_test_key";
  const result = await notifyMikeOnBumps([], [], {
    fetch: async () => {
      throw new Error("fetch should not run when there are no bumps");
    },
  });
  assert.equal(result.code, "no_bumps");
  assert.equal(result.sent, false);
  assert.equal(result.skipped, true);
  assert.equal(result.status, 200);
  assert.equal(result.bumps, 0);
  assert.equal(result.to_configured, true);
});

test("Resend send uses sheet id + new rev and does not leak the key", async () => {
  clearNotifyEnv();
  process.env.NOTIFY_MIKE_EMAIL = "mike@crew.example";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM = "GC Field Log <notify@gcfieldlog.com>";

  let called = 0;
  const result = await notifyMikeOnBumps([mapleBump], [], {
    fetch: async (input, init) => {
      called += 1;
      assert.equal(String(input), "https://api.resend.com/emails");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), "Bearer re_test_key");
      const body = JSON.parse(String(init?.body)) as {
        to: string[];
        subject: string;
        text: string;
      };
      assert.deepEqual(body.to, ["mike@crew.example"]);
      assert.match(body.subject, /E-101/);
      assert.match(body.subject, /Rev B/);
      assert.match(body.text, /A → B/);
      assert.equal(forbidden.test(JSON.stringify(body)), false);
      return new Response(JSON.stringify({ id: "mock" }), { status: 200 });
    },
  });
  assert.equal(called, 1);
  assert.equal(result.code, "sent");
  assert.equal(result.sent, true);
  assert.equal(result.provider, "resend");
  assert.equal(result.status, 200);
  assert.equal(result.bumps, 1);
  assert.equal(JSON.stringify(result).includes("re_test_key"), false);
});

test("Gmail path sends when app password is set", async () => {
  clearNotifyEnv();
  process.env.NOTIFY_MIKE_EMAIL = "mike@crew.example";
  process.env.GMAIL_USER = "mike@crew.example";
  process.env.GMAIL_APP_PASSWORD = "not-a-real-password";

  let called = 0;
  const result = await notifyMikeOnBumps([mapleBump], [], {
    sendGmail: async (input) => {
      called += 1;
      assert.equal(input.to, "mike@crew.example");
      assert.match(input.subject, /E-101 bumped to Rev B/);
      return { ok: true };
    },
  });
  assert.equal(called, 1);
  assert.equal(result.code, "sent");
  assert.equal(result.provider, "gmail");
});

test("GMAIL_USER is the destination when NOTIFY_MIKE_EMAIL is unset", () => {
  clearNotifyEnv();
  process.env.GMAIL_USER = "mike@crew.example";
  process.env.GMAIL_APP_PASSWORD = "not-a-real-password";
  assert.equal(readNotifyMikeEmail(), "mike@crew.example");
  assert.equal(notifyMikeConfigured(), true);
});

test("persist failure skips notify", async () => {
  clearNotifyEnv();
  process.env.NOTIFY_MIKE_EMAIL = "mike@crew.example";
  process.env.RESEND_API_KEY = "re_test_key";
  const result = await notifyMikeOnBumps([mapleBump], [
    { error: "sheet_revision_cache upsert failed" },
  ], {
    fetch: async () => {
      throw new Error("fetch should not run after persist failure");
    },
  });
  assert.equal(result.code, "persist_failed");
  assert.equal(result.sent, false);
  assert.equal(result.status, 200);
});

test("send failure does not throw and stays structured", async () => {
  clearNotifyEnv();
  process.env.NOTIFY_MIKE_EMAIL = "mike@crew.example";
  process.env.RESEND_API_KEY = "re_test_key";
  const result = await notifyMikeOnBumps([mapleBump], [], {
    fetch: async () => new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }),
  });
  assert.equal(result.code, "send_failed");
  assert.equal(result.sent, false);
  assert.equal(result.status, 503);
  assert.match(result.note, /Refresh still saved/);
});
