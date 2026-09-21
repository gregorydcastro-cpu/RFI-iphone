import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  SHEET_PDF_FAILURE_CODES,
  SHEET_PDF_MAX_AUTO_RETRIES,
  SHEET_PDF_PULLER_HINT,
  SHEET_PDF_RETRY_BACKOFF_MS,
  SheetPdfLoadError,
  classifyUpstreamHttpStatus,
  fetchSheetPdfBytes,
  isSheetPdfAbortError,
  parseSheetPdfErrorBody,
  readSheetPdfFailure,
  sheetPdfAutoRetry,
  sheetPdfCrewMessage,
  waitForSheetPdfRetry,
} from "./sheetPdfFailure.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const secretLeak =
  /eyJ[A-Za-z0-9_-]{8,}|sb_secret_|BEGIN PRIVATE KEY|GOOGLE_PRIVATE_KEY/;

const PDF = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("parseSheetPdfErrorBody keeps code, configured, and error", () => {
  const parsed = parseSheetPdfErrorBody(
    {
      ok: false,
      code: "drive_forbidden",
      configured: true,
      error: "Drive file is missing or not shared.",
    },
    502,
  );
  assert.equal(parsed.code, "drive_forbidden");
  assert.equal(parsed.configured, true);
  assert.equal(parsed.serverError, "Drive file is missing or not shared.");
  assert.equal(parsed.network, false);
  assert.equal(parsed.status, 502);
});

test("missing code with configured false is Drive not configured", () => {
  const parsed = parseSheetPdfErrorBody({ ok: false, configured: false }, 503);
  assert.equal(parsed.code, "drive_auth_missing");
  assert.match(sheetPdfCrewMessage(parsed).message, /not configured/i);
});

test("readSheetPdfFailure reads a JSON error body", async () => {
  const failure = await readSheetPdfFailure(
    jsonResponse(502, {
      ok: false,
      code: "upstream_timeout",
      error: "Timed out fetching the sheet PDF.",
    }),
  );
  assert.equal(failure.code, "upstream_timeout");
  assert.equal(failure.serverError, "Timed out fetching the sheet PDF.");
});

test("crew copy maps known codes and hides server env jargon", () => {
  const cases: Array<{ code: string; status: number; match: RegExp }> = [
    { code: "drive_auth_missing", status: 503, match: /not configured/i },
    { code: "drive_forbidden", status: 502, match: /not shared/i },
    { code: "drive_auth_rejected", status: 503, match: /rejected/i },
    { code: "sheet_not_found", status: 404, match: /not in the pack/i },
    { code: "pack_not_found", status: 404, match: /not on the server/i },
    { code: "pdf_missing", status: 404, match: /No PDF/i },
    { code: "upstream_timeout", status: 502, match: /timed out/i },
    { code: "not_pdf", status: 502, match: /not a PDF/i },
    { code: "network", status: 0, match: /connection/i },
    { code: "upstream_failed", status: 502, match: /failed/i },
    { code: "procore_pdf_unsupported", status: 502, match: /Procore/i },
  ];

  for (const entry of cases) {
    const copy = sheetPdfCrewMessage({
      code: entry.code,
      status: entry.status,
      network: entry.code === "network",
    });
    assert.match(copy.message, entry.match, entry.code);
    assert.doesNotMatch(copy.message, /GOOGLE_CLIENT_EMAIL|GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON/);
    assert.doesNotMatch(`${copy.message} ${copy.detail ?? ""}`, forbidden);
    assert.doesNotMatch(`${copy.message} ${copy.detail ?? ""}`, secretLeak);
  }
});

test("empty or missing pack data mentions the Procore puller and issue 53", () => {
  for (const code of ["pack_not_found", "sheet_not_found", "pdf_missing"]) {
    const copy = sheetPdfCrewMessage({ code, status: 404, network: false });
    assert.equal(copy.detail, SHEET_PDF_PULLER_HINT);
    assert.match(copy.detail ?? "", /puller/i);
    assert.match(copy.detail ?? "", /SUPABASE_SERVICE_ROLE_KEY/);
    assert.match(copy.detail ?? "", /#53/);
    assert.doesNotMatch(copy.detail ?? "", /eyJ|sb_secret_/);
  }
  const drive = sheetPdfCrewMessage({
    code: "drive_forbidden",
    status: 502,
    network: false,
    configured: true,
  });
  assert.equal(drive.detail, undefined);
});

test("auto-retry is only for network and transient 5xx, twice", () => {
  const retry = (code: string, status: number, autoRetriesUsed: number, network = false) =>
    sheetPdfAutoRetry({
      failure: { code, status, network },
      autoRetriesUsed,
    });

  assert.deepEqual(retry("network", 0, 0, true), { retry: true, delayMs: 400 });
  assert.deepEqual(retry("network", 0, 1, true), { retry: true, delayMs: 900 });
  assert.deepEqual(retry("network", 0, 2, true), { retry: false });
  assert.equal(SHEET_PDF_MAX_AUTO_RETRIES, 2);
  assert.deepEqual(SHEET_PDF_RETRY_BACKOFF_MS, [400, 900]);

  assert.equal(retry("upstream_timeout", 502, 0).retry, true);
  assert.equal(retry("upstream_failed", 502, 0).retry, true);
  assert.equal(retry("gateway", 500, 0).retry, true);
  assert.equal(retry("drive_auth_missing", 503, 0).retry, false);
  assert.equal(retry("drive_auth_rejected", 503, 0).retry, false);
  assert.equal(retry("drive_forbidden", 502, 0).retry, false);
  assert.equal(retry("not_pdf", 502, 0).retry, false);
  assert.equal(retry("pack_not_found", 404, 0).retry, false);
  assert.equal(retry("sheet_not_found", 404, 0).retry, false);
  assert.equal(retry("pdf_missing", 404, 0).retry, false);
  assert.equal(retry("bad_request", 400, 0).retry, false);
  assert.equal(retry("http", 404, 0).retry, false);
});

test("408 and 504 upstream statuses are timeouts", () => {
  assert.equal(classifyUpstreamHttpStatus(408), "upstream_timeout");
  assert.equal(classifyUpstreamHttpStatus(504), "upstream_timeout");
  assert.equal(classifyUpstreamHttpStatus(500), "upstream_failed");
  assert.equal(classifyUpstreamHttpStatus(403), "upstream_failed");
});

test("every loadSheetPdf fail code has crew copy", () => {
  const src = readFileSync(new URL("./sheetPdf.ts", import.meta.url), "utf8");
  const route = readFileSync(
    new URL("../app/api/sheet-pdf/route.ts", import.meta.url),
    "utf8",
  );
  const codes = new Set<string>();
  for (const match of src.matchAll(
    /fail\(\s*\d+\s*,\s*(?:[A-Za-z]+ \? )?"([a-z0-9_]+)"(?:\s*:\s*"([a-z0-9_]+)")?/g,
  )) {
    if (match[1]) codes.add(match[1]);
    if (match[2]) codes.add(match[2]);
  }
  for (const match of route.matchAll(/code:\s*"([a-z0-9_]+)"/g)) {
    if (match[1]) codes.add(match[1]);
  }
  assert.ok(codes.size >= 8);
  for (const code of codes) {
    assert.ok(
      (SHEET_PDF_FAILURE_CODES as readonly string[]).includes(code),
      code,
    );
    const copy = sheetPdfCrewMessage({ code, status: 500, network: false });
    assert.notEqual(copy.message, "Could not load this sheet. Tap Retry.");
  }
});

test("fetch retries a flaky network twice then returns PDF bytes", async () => {
  let calls = 0;
  const waits: number[] = [];
  const bytes = await fetchSheetPdfBytes({
    url: "/api/sheet-pdf?requestId=maple-point&sheetId=A-101",
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) throw new TypeError("Failed to fetch");
      return new Response(PDF, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    },
    wait: async (ms) => {
      waits.push(ms);
    },
  });
  assert.equal(calls, 3);
  assert.deepEqual(waits, [400, 900]);
  assert.equal(bytes[0], 0x25);
});

test("fetch does not retry Drive config or a non-PDF body", async () => {
  let driveCalls = 0;
  await assert.rejects(
    () =>
      fetchSheetPdfBytes({
        url: "/api/sheet-pdf?requestId=maple-point&sheetId=A-101",
        fetchImpl: async () => {
          driveCalls += 1;
          return jsonResponse(503, {
            ok: false,
            code: "drive_auth_missing",
            configured: false,
            error: "Google Drive credentials are not configured.",
          });
        },
        wait: async () => {
          throw new Error("should not wait");
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof SheetPdfLoadError);
      assert.equal(error.failure.code, "drive_auth_missing");
      assert.match(error.copy.message, /not configured/i);
      return true;
    },
  );
  assert.equal(driveCalls, 1);

  let pdfCalls = 0;
  await assert.rejects(
    () =>
      fetchSheetPdfBytes({
        url: "/packs/maple-point-a101.pdf",
        fetchImpl: async () => {
          pdfCalls += 1;
          return new Response("<html>login</html>", {
            status: 200,
            headers: { "content-type": "text/html" },
          });
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof SheetPdfLoadError);
      assert.equal(error.failure.code, "not_pdf");
      assert.match(error.copy.message, /not a PDF/i);
      return true;
    },
  );
  assert.equal(pdfCalls, 1);
});

test("fetch retries upstream 5xx then surfaces the banner error", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      fetchSheetPdfBytes({
        url: "/api/sheet-pdf?requestId=maple-point&sheetId=A-101",
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(502, {
            ok: false,
            code: "upstream_failed",
            error: "Google Drive download failed (503).",
          });
        },
        wait: async () => undefined,
      }),
    (error: unknown) => {
      assert.ok(error instanceof SheetPdfLoadError);
      assert.equal(error.copy.message, "The sheet server failed. Tap Retry.");
      assert.doesNotMatch(error.message, /GOOGLE_/);
      return true;
    },
  );
  assert.equal(calls, 3);
});

test("waitForSheetPdfRetry rejects an already aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => waitForSheetPdfRetry(400, controller.signal),
    (error: unknown) => isSheetPdfAbortError(error),
  );
});
