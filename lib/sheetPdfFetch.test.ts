import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fetchWithBoundedRetry,
  parseRetryAfterMs,
  SHEET_PDF_RETRY_ATTEMPTS,
  SHEET_PDF_RETRY_MAX_WAIT_MS,
  sheetPdfBackoffMs,
} from "./sheetPdfFetch.ts";

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

test("retries 503 then succeeds and does not retry 403 or 404", async () => {
  let calls = 0;
  const retried = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: { method: "GET" } }),
    {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 503 });
        return new Response("%PDF-1.7", { status: 200 });
      },
      sleep: async () => {},
    },
  );
  assert.equal(retried.ok, true);
  if (retried.ok) assert.equal(retried.response.status, 200);
  assert.equal(calls, 2);
  assert.equal(SHEET_PDF_RETRY_ATTEMPTS, 2);

  calls = 0;
  const forbidden = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: { method: "GET" } }),
    {
      fetchImpl: async () => {
        calls += 1;
        return new Response("no", { status: 403 });
      },
      sleep: async () => {},
    },
  );
  assert.equal(forbidden.ok, true);
  if (forbidden.ok) assert.equal(forbidden.response.status, 403);
  assert.equal(calls, 1);

  calls = 0;
  const missing = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: { method: "GET" } }),
    {
      fetchImpl: async () => {
        calls += 1;
        return new Response("missing", { status: 404 });
      },
    },
  );
  assert.equal(missing.ok, true);
  if (missing.ok) assert.equal(missing.response.status, 404);
  assert.equal(calls, 1);
});

test("timeouts and network errors retry once", async () => {
  let calls = 0;
  const timedOut = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: {} }),
    {
      fetchImpl: async () => {
        calls += 1;
        throw abortError();
      },
      sleep: async () => {},
    },
  );
  assert.deepEqual(timedOut, { ok: false, kind: "timeout", attempts: 2 });

  calls = 0;
  const offline = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: {} }),
    {
      fetchImpl: async () => {
        calls += 1;
        throw new Error("ECONNRESET");
      },
      sleep: async () => {},
    },
  );
  assert.deepEqual(offline, { ok: false, kind: "unreachable", attempts: 2 });
  assert.equal(calls, 2);
});

test("a stalled PDF body retries, and a long Retry-After does not sleep", async () => {
  let calls = 0;
  const recovered = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: {} }),
    {
      fetchImpl: async () => {
        calls += 1;
        return new Response("%PDF", { status: 200 });
      },
      consumeBody: async () => {
        if (calls === 1) throw abortError();
        return new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      },
      sleep: async () => {},
    },
  );
  assert.equal(recovered.ok, true);
  if (recovered.ok) {
    assert.deepEqual(recovered.body, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  }
  assert.equal(calls, 2);

  calls = 0;
  let slept = 0;
  const capped = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: {} }),
    {
      fetchImpl: async () => {
        calls += 1;
        return new Response("later", {
          status: 503,
          headers: { "retry-after": "30" },
        });
      },
      sleep: async () => {
        slept += 1;
      },
    },
  );
  assert.equal(capped.ok, true);
  if (capped.ok) assert.equal(capped.response.status, 503);
  assert.equal(calls, 1);
  assert.equal(slept, 0);
  assert.equal(parseRetryAfterMs("1"), 1000);
  assert.equal(sheetPdfBackoffMs(0, SHEET_PDF_RETRY_MAX_WAIT_MS + 1), -1);
  assert.equal(sheetPdfBackoffMs(0, 250), 250);
});

test("403 does not read the error body", async () => {
  let consumed = 0;
  const result = await fetchWithBoundedRetry(
    () => ({ url: "https://www.googleapis.com/drive/v3/files/abc", init: {} }),
    {
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "BEGIN PRIVATE KEY" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      consumeBody: async () => {
        consumed += 1;
        return new Uint8Array();
      },
    },
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.body, undefined);
  assert.equal(consumed, 0);
});
