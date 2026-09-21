import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bannerFromSheetPdfBody,
  mapDriveDownloadStatus,
  mapDriveTokenStatus,
  publicSheetPdfError,
  readSheetPdfBanner,
  SHEET_PDF_MESSAGES,
  sheetPdfBanner,
} from "./sheetPdfErrors.ts";

const SECRET_MARKERS = [
  "BEGIN PRIVATE",
  "BEGIN RSA",
  "ya29.",
  "eyJ",
  "service_role",
  "AIza",
];

test("Drive download statuses map to distinct codes", () => {
  assert.deepEqual(mapDriveDownloadStatus(401), {
    httpStatus: 503,
    code: "drive_auth_rejected",
    retryable: false,
  });
  assert.deepEqual(mapDriveDownloadStatus(403), {
    httpStatus: 502,
    code: "drive_forbidden",
    retryable: false,
  });
  assert.deepEqual(mapDriveDownloadStatus(404), {
    httpStatus: 404,
    code: "not_found",
    retryable: false,
  });
  assert.deepEqual(mapDriveDownloadStatus(504), {
    httpStatus: 504,
    code: "timeout",
    retryable: true,
  });
  assert.equal(mapDriveDownloadStatus(503).code, "upstream_failed");
  assert.equal(mapDriveDownloadStatus(503).retryable, true);
  assert.equal(mapDriveDownloadStatus(500).retryable, true);
  assert.equal(mapDriveDownloadStatus(429).retryable, true);
  assert.equal(mapDriveDownloadStatus(400).retryable, false);
});

test("token 5xx is transient and 401 is auth rejection", () => {
  assert.deepEqual(mapDriveTokenStatus(503), {
    code: "upstream_failed",
    retryable: true,
  });
  assert.deepEqual(mapDriveTokenStatus(504), {
    code: "timeout",
    retryable: true,
  });
  assert.deepEqual(mapDriveTokenStatus(401), {
    code: "drive_auth_rejected",
    retryable: false,
  });
  assert.equal(mapDriveTokenStatus(400).retryable, false);
});

test("public JSON drops unknown codes and upstream text", () => {
  const forbidden = publicSheetPdfError({
    code: "drive_forbidden",
    configured: true,
  });
  assert.equal(forbidden.code, "drive_forbidden");
  assert.equal(forbidden.error, SHEET_PDF_MESSAGES.drive_forbidden);
  assert.equal(forbidden.configured, true);

  const poisoned = publicSheetPdfError({
    code: "BEGIN PRIVATE KEY ya29.secret",
  });
  assert.equal(poisoned.code, "upstream_failed");
  assert.equal(poisoned.error.includes("ya29"), false);
  assert.equal(poisoned.error.includes("BEGIN PRIVATE"), false);
  assert.equal("configured" in poisoned, false);
});

test("field banners differ for missing account, share, and network", () => {
  const missing = sheetPdfBanner({ code: "drive_auth_missing" });
  const shared = sheetPdfBanner({ code: "drive_forbidden" });
  const offline = sheetPdfBanner({ network: true });
  const timedOut = sheetPdfBanner({ code: "timeout" });
  assert.notEqual(missing.title, shared.title);
  assert.notEqual(missing.message, shared.message);
  assert.notEqual(missing.message, offline.message);
  assert.notEqual(shared.message, offline.message);
  assert.equal(missing.retryable, true);
  assert.equal(shared.retryable, true);
  assert.equal(offline.retryable, true);
  assert.equal(timedOut.title, "Sheet timed out");
  assert.match(missing.message, /service account/i);
  assert.match(shared.message, /not shared/i);
  assert.match(offline.message, /connection/i);
  assert.equal(sheetPdfBanner({ code: "pdf_missing" }).retryable, false);
});

test("banner uses the code and ignores a poisoned error string", async () => {
  const banner = bannerFromSheetPdfBody(
    {
      code: "drive_forbidden",
      error: "BEGIN PRIVATE KEY ya29.leaked-token",
    },
    502,
  );
  assert.equal(banner.title, "Sheet not shared");
  assert.equal(banner.message.includes("ya29"), false);
  assert.equal(banner.message.includes("BEGIN PRIVATE"), false);

  const fromResponse = await readSheetPdfBanner(
    new Response(JSON.stringify({ code: "timeout", error: "eyJhbGci" }), {
      status: 504,
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(fromResponse.title, "Sheet timed out");
  assert.equal(fromResponse.message.includes("eyJ"), false);
});

test("canonical messages do not contain secret material", () => {
  for (const message of Object.values(SHEET_PDF_MESSAGES)) {
    for (const marker of SECRET_MARKERS) {
      assert.equal(message.includes(marker), false, message);
    }
  }
  for (const code of [
    "drive_auth_missing",
    "drive_forbidden",
    "timeout",
    "not_found",
    "upstream_failed",
  ] as const) {
    const banner = sheetPdfBanner({ code });
    for (const marker of SECRET_MARKERS) {
      assert.equal(banner.message.includes(marker), false);
      assert.equal(banner.title.includes(marker), false);
    }
  }
});
