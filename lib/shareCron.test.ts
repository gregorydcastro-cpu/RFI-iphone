import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  authorizeCronHeaders,
  cronSecretConfigured,
  procoreRestSummary,
  requestIdForPinnedSheet,
  weeklyPdfRedownloadEnabled,
  weeklyProcoreRestEnabled,
} from "./shareCron.ts";
import { MAPLE_POINT_PROJECT_NAME } from "./shareCatalog.ts";
import {
  createShareFolder,
  pinSheetsToFolder,
  resetShareMemoryForTests,
  weeklyRefreshPinnedSheets,
} from "./shareStore.ts";
import { isShareTableWriteConfigured } from "./supabaseShare.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const previous = {
  CRON_SECRET: process.env.CRON_SECRET,
  SHARE_WEEKLY_PROCORE_REST: process.env.SHARE_WEEKLY_PROCORE_REST,
  SHARE_WEEKLY_PDF_REDOWNLOAD: process.env.SHARE_WEEKLY_PDF_REDOWNLOAD,
  GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
  GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  GOOGLE_DRIVE_API_KEY: process.env.GOOGLE_DRIVE_API_KEY,
};

afterEach(() => {
  restoreEnv("CRON_SECRET", previous.CRON_SECRET);
  restoreEnv("SHARE_WEEKLY_PROCORE_REST", previous.SHARE_WEEKLY_PROCORE_REST);
  restoreEnv("SHARE_WEEKLY_PDF_REDOWNLOAD", previous.SHARE_WEEKLY_PDF_REDOWNLOAD);
  restoreEnv(
    "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
    previous.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON,
  );
  restoreEnv("GOOGLE_CLIENT_EMAIL", previous.GOOGLE_CLIENT_EMAIL);
  restoreEnv("GOOGLE_PRIVATE_KEY", previous.GOOGLE_PRIVATE_KEY);
  restoreEnv("GOOGLE_DRIVE_API_KEY", previous.GOOGLE_DRIVE_API_KEY);
  resetShareMemoryForTests();
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

test("weekly cron helpers stay Maple Point / fictional only", () => {
  const blob = JSON.stringify({
    requestId: requestIdForPinnedSheet(MAPLE_POINT_PROJECT_NAME, "A-101"),
    rest: procoreRestSummary(),
  });
  assert.equal(forbidden.test(blob), false);
  assert.match(blob, /Maple Point|issue #25|SHARE_WEEKLY_PROCORE_REST/);
});

test("authorizeCronHeaders requires CRON_SECRET bearer or x-cron-secret", () => {
  delete process.env.CRON_SECRET;
  assert.equal(cronSecretConfigured(), false);
  assert.equal(authorizeCronHeaders(new Headers({ authorization: "Bearer x" })), false);

  process.env.CRON_SECRET = "weekly-test-secret";
  assert.equal(cronSecretConfigured(), true);
  assert.equal(authorizeCronHeaders(new Headers()), false);
  assert.equal(
    authorizeCronHeaders(new Headers({ authorization: "Bearer wrong" })),
    false,
  );
  assert.equal(
    authorizeCronHeaders(new Headers({ authorization: "Bearer weekly-test-secret" })),
    true,
  );
  assert.equal(
    authorizeCronHeaders(new Headers({ "x-cron-secret": "weekly-test-secret" })),
    true,
  );
});

test("SHARE_WEEKLY_PROCORE_REST stays a no-call TODO flag", () => {
  delete process.env.SHARE_WEEKLY_PROCORE_REST;
  assert.equal(weeklyProcoreRestEnabled(), false);
  const off = procoreRestSummary();
  assert.equal(off.called, false);
  assert.equal(off.todo, true);
  assert.equal(off.issue, 25);

  process.env.SHARE_WEEKLY_PROCORE_REST = "1";
  assert.equal(weeklyProcoreRestEnabled(), true);
  const reserved = procoreRestSummary();
  assert.equal(reserved.called, false);
  assert.equal(reserved.enabled, true);
  assert.match(reserved.note, /did not call Procore|not wired/);
});

test("weekly PDF re-download is off without Drive or explicit flag", () => {
  delete process.env.SHARE_WEEKLY_PDF_REDOWNLOAD;
  delete process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_CLIENT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_DRIVE_API_KEY;
  assert.equal(weeklyPdfRedownloadEnabled(), false);

  process.env.SHARE_WEEKLY_PDF_REDOWNLOAD = "1";
  assert.equal(weeklyPdfRedownloadEnabled(), true);

  process.env.SHARE_WEEKLY_PDF_REDOWNLOAD = "0";
  assert.equal(weeklyPdfRedownloadEnabled(), false);
});

test("weeklyRefreshPinnedSheets reuses Refresh all compare and writes cache", async (t) => {
  if (isShareTableWriteConfigured()) {
    t.skip("service role configured; this case covers the in-memory weekly path");
    return;
  }
  resetShareMemoryForTests();
  const created = await createShareFolder({
    ownerUserId: "stub:weekly-refresh",
    name: "Maple Point weekly set",
  });
  assert.ok(!("error" in created));
  const pinned = await pinSheetsToFolder({
    ownerUserId: "stub:weekly-refresh",
    folderId: created.folder.id,
    drafts: [
      {
        project_name: MAPLE_POINT_PROJECT_NAME,
        sheet_id: "A-101",
        discipline: "architectural",
        last_seen_rev: "Z",
        request_id: "maple-point",
      },
      {
        project_name: MAPLE_POINT_PROJECT_NAME,
        sheet_id: "E-101",
        discipline: "electrical",
        last_seen_rev: "A",
        request_id: "maple-point",
      },
      {
        project_name: MAPLE_POINT_PROJECT_NAME,
        sheet_id: "Z-999",
        discipline: "electrical",
        last_seen_rev: "A",
        request_id: "maple-point",
      },
    ],
  });
  assert.ok(!("error" in pinned));

  const result = await weeklyRefreshPinnedSheets();
  assert.equal(result.storage, "memory");
  assert.equal(result.plan.scanned, 3);
  assert.equal(result.plan.bumped, 1);
  assert.equal(result.plan.unchanged, 1);
  assert.equal(result.plan.missing, 1);
  assert.deepEqual(result.bumps, [
    {
      sheet_id: "A-101",
      old_rev: "Z",
      new_rev: "A",
      project_name: MAPLE_POINT_PROJECT_NAME,
    },
  ]);
  assert.equal(result.errors.length, 0);

  const again = await weeklyRefreshPinnedSheets();
  assert.equal(again.plan.bumped, 0);
  assert.equal(again.plan.unchanged, 2);
  assert.equal(again.plan.missing, 1);
  assert.deepEqual(again.bumps, []);
});
