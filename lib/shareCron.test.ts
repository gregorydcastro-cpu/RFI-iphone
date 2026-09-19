import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { MAPLE_POINT_PROJECT_NAME, MAPLE_POINT_REQUEST_ID } from "./shareCatalog.ts";
import {
  authorizeCronHeaders,
  cronSecretConfigured,
  procoreRestSummary,
  weeklyPdfRedownloadFlag,
  weeklyProcoreRestEnabled,
} from "./shareCronAuth.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const previous = {
  CRON_SECRET: process.env.CRON_SECRET,
  SHARE_WEEKLY_PROCORE_REST: process.env.SHARE_WEEKLY_PROCORE_REST,
  SHARE_WEEKLY_PDF_REDOWNLOAD: process.env.SHARE_WEEKLY_PDF_REDOWNLOAD,
};

afterEach(() => {
  restoreEnv("CRON_SECRET", previous.CRON_SECRET);
  restoreEnv("SHARE_WEEKLY_PROCORE_REST", previous.SHARE_WEEKLY_PROCORE_REST);
  restoreEnv("SHARE_WEEKLY_PDF_REDOWNLOAD", previous.SHARE_WEEKLY_PDF_REDOWNLOAD);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

test("weekly cron helpers stay Maple Point / fictional only", () => {
  const blob = JSON.stringify({
    project: MAPLE_POINT_PROJECT_NAME,
    requestId: MAPLE_POINT_REQUEST_ID,
    rest: procoreRestSummary(),
  });
  assert.equal(forbidden.test(blob), false);
  assert.match(blob, /Maple Point/);
  assert.match(blob, /SHARE_WEEKLY_PROCORE_REST/);
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

test("weekly cron does not call Procore REST (bot/catalog fallback)", () => {
  delete process.env.SHARE_WEEKLY_PROCORE_REST;
  assert.equal(weeklyProcoreRestEnabled(), false);
  const off = procoreRestSummary();
  assert.equal(off.called, false);
  assert.equal(off.todo, false);
  assert.equal(off.issue, 25);
  assert.match(off.note, /catalog|room_packs|REST/);

  process.env.SHARE_WEEKLY_PROCORE_REST = "1";
  assert.equal(weeklyProcoreRestEnabled(), true);
  const reserved = procoreRestSummary();
  assert.equal(reserved.called, false);
  assert.equal(reserved.enabled, true);
  assert.match(reserved.note, /bot|catalog|no per-user token/);
});

test("SHARE_WEEKLY_PDF_REDOWNLOAD flag is 1 / 0 / inherit", () => {
  delete process.env.SHARE_WEEKLY_PDF_REDOWNLOAD;
  assert.equal(weeklyPdfRedownloadFlag(), null);

  process.env.SHARE_WEEKLY_PDF_REDOWNLOAD = "1";
  assert.equal(weeklyPdfRedownloadFlag(), true);

  process.env.SHARE_WEEKLY_PDF_REDOWNLOAD = "0";
  assert.equal(weeklyPdfRedownloadFlag(), false);
});
