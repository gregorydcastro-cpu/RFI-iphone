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
  sheetPdfEmptySpeak,
  sheetPdfErrorSpeak,
  sheetPdfSurface,
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
  assert.equal(timedOut.title, "Sheet did not load");
  assert.match(timedOut.message, /timed out/);
  assert.match(missing.message, /service account/i);
  assert.match(shared.message, /not shared/i);
  assert.match(offline.message, /Shaky signal/);
  assert.match(offline.message, /Retry/);
  assert.equal(sheetPdfBanner({ code: "pdf_missing" }).retryable, false);
  const stopped = sheetPdfBanner({ interrupted: true });
  assert.equal(stopped.title, "Sheet did not load");
  assert.match(stopped.message, /Tap Retry/);
  assert.equal(stopped.retryable, true);
  const emptyBody = sheetPdfBanner({ code: "empty_body" });
  assert.equal(emptyBody.title, "Sheet did not load");
  assert.match(emptyBody.message, /empty/);
  assert.equal(emptyBody.retryable, true);
  assert.equal(stopped.code, undefined);
  assert.equal(sheetPdfBanner({ code: "timeout" }).code, "timeout");
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
  assert.equal(fromResponse.title, "Sheet did not load");
  assert.match(fromResponse.message, /timed out/);
  assert.equal(fromResponse.message.includes("eyJ"), false);
});

test("empty sheet is a status and a failed load is a retry", () => {
  const empty = sheetPdfSurface({
    hasPdfUrl: false,
    ready: false,
    error: null,
  });
  const missing = sheetPdfSurface({
    hasPdfUrl: true,
    ready: false,
    error: sheetPdfBanner({ code: "pdf_missing" }),
  });
  const failed = sheetPdfSurface({
    hasPdfUrl: true,
    ready: false,
    error: sheetPdfBanner({ network: true }),
  });
  const blank = sheetPdfSurface({
    hasPdfUrl: true,
    ready: false,
    error: sheetPdfBanner({ code: "empty_body" }),
  });
  const painted = sheetPdfSurface({
    hasPdfUrl: true,
    ready: true,
    error: null,
  });
  assert.equal(empty.kind, "empty");
  assert.equal(missing.kind, "empty");
  assert.equal(failed.kind, "error");
  assert.equal(blank.kind, "error");
  assert.equal(painted.kind, "sheet");
  if (empty.kind === "empty" && failed.kind === "error" && blank.kind === "error") {
    assert.equal(empty.title, "No PDF attached");
    assert.equal(empty.message.includes("Retry"), false);
    assert.match(sheetPdfEmptySpeak(), /No PDF attached/);
    assert.equal(sheetPdfEmptySpeak().includes("Retry"), false);
    assert.equal(failed.retryable, true);
    assert.match(failed.message, /Shaky signal/);
    assert.match(sheetPdfErrorSpeak(failed), /Retry/);
    assert.match(blank.message, /empty/);
    assert.equal(blank.retryable, true);
    assert.notEqual(empty.title, failed.title);
    assert.notEqual(empty.message, blank.message);
  }
  assert.equal(
    sheetPdfSurface({
      hasPdfUrl: true,
      ready: true,
      error: sheetPdfBanner({ code: "pdf_missing" }),
    }).kind,
    "sheet",
  );
  assert.equal(
    sheetPdfSurface({ hasPdfUrl: true, ready: false, error: null }).kind,
    "loading",
  );
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
