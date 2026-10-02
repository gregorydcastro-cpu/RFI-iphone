import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isOfflinePdfResponse,
  isSheetPaintTimeout,
  isShortPdfDownload,
  OFFLINE_PDF_HEADER,
  SHEET_PDF_CLIENT_TIMEOUT_MS,
  SHEET_PDF_PAINT_TIMEOUT_MS,
  sheetPdfFetchCatch,
  shouldAutoRetrySheetPdf,
} from "./sheetPdfLoad.ts";

test("viewer retries a dropped connection once, not a finished Drive error", () => {
  assert.equal(shouldAutoRetrySheetPdf({ attempt: 0, network: true }), true);
  assert.equal(shouldAutoRetrySheetPdf({ attempt: 0, interrupted: true }), true);
  assert.equal(shouldAutoRetrySheetPdf({ attempt: 1, network: true }), false);
  assert.equal(shouldAutoRetrySheetPdf({ attempt: 1, interrupted: true }), false);
  assert.equal(shouldAutoRetrySheetPdf({ attempt: 0 }), false);
});

test("short identity bodies are incomplete; gzip lengths are not", () => {
  assert.equal(isShortPdfDownload(4, "8000", null), true);
  assert.equal(isShortPdfDownload(8000, "8000", null), false);
  assert.equal(isShortPdfDownload(4, "8000", "gzip"), false);
  assert.equal(isShortPdfDownload(4, null, null), false);
  assert.equal(isShortPdfDownload(4, "nope", null), false);
});

test("a hung proxy becomes one timeout banner, a drop retries once", () => {
  assert.equal(
    sheetPdfFetchCatch({
      cancelled: false,
      timedOut: true,
      aborted: true,
      attempt: 0,
    }),
    "timeout",
  );
  assert.equal(
    sheetPdfFetchCatch({
      cancelled: true,
      timedOut: true,
      aborted: true,
      attempt: 0,
    }),
    "ignore",
  );
  assert.equal(
    sheetPdfFetchCatch({
      cancelled: false,
      timedOut: false,
      aborted: false,
      attempt: 0,
    }),
    "retry",
  );
  assert.equal(
    sheetPdfFetchCatch({
      cancelled: false,
      timedOut: false,
      aborted: false,
      attempt: 1,
    }),
    "banner",
  );
  assert.ok(SHEET_PDF_CLIENT_TIMEOUT_MS > 60_000);
  assert.ok(SHEET_PDF_CLIENT_TIMEOUT_MS < 90_000);
  assert.ok(SHEET_PDF_PAINT_TIMEOUT_MS < SHEET_PDF_CLIENT_TIMEOUT_MS);
  const paint = new Error("sheet paint timed out");
  paint.name = "TimeoutError";
  assert.equal(isSheetPaintTimeout(paint), true);
  assert.equal(isSheetPaintTimeout(new Error("ECONNRESET")), false);
});

test("offline copy header is the cache marker", () => {
  assert.equal(
    isOfflinePdfResponse(new Headers({ [OFFLINE_PDF_HEADER]: "1" })),
    true,
  );
  assert.equal(isOfflinePdfResponse(new Headers()), false);
});
