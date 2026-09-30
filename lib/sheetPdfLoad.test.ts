import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isOfflinePdfResponse,
  isShortPdfDownload,
  OFFLINE_PDF_HEADER,
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

test("offline copy header is the cache marker", () => {
  assert.equal(
    isOfflinePdfResponse(new Headers({ [OFFLINE_PDF_HEADER]: "1" })),
    true,
  );
  assert.equal(isOfflinePdfResponse(new Headers()), false);
});
