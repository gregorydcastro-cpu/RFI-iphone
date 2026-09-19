import assert from "node:assert/strict";
import { test } from "node:test";
import {
  backoffMs,
  fetchXaiWithRetry,
  isRetryableVoiceStatus,
  mapUpstreamVoiceError,
  parseRetryAfterMs,
  VOICE_RETRY_MAX_WAIT_MS,
} from "./xaiUpstream.ts";

test("retries 503 then succeeds; does not retry 401", async () => {
  let calls = 0;
  const retried = await fetchXaiWithRetry(
    () => ({ url: "https://api.x.ai/v1/stt", init: { method: "POST" } }),
    {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response("busy", { status: 503 });
        return new Response("ok", { status: 200 });
      },
      sleep: async () => {},
    },
  );
  assert.equal(retried.ok, true);
  if (retried.ok) assert.equal(retried.response.status, 200);
  assert.equal(calls, 2);

  calls = 0;
  const rejected = await fetchXaiWithRetry(
    () => ({ url: "https://api.x.ai/v1/stt", init: { method: "POST" } }),
    {
      fetchImpl: async () => {
        calls += 1;
        return new Response("no", { status: 401 });
      },
    },
  );
  assert.equal(rejected.ok, true);
  if (rejected.ok) assert.equal(rejected.response.status, 401);
  assert.equal(calls, 1);
});

test("network failure becomes unreachable after retries", async () => {
  let calls = 0;
  const result = await fetchXaiWithRetry(
    () => ({ url: "https://api.x.ai/v1/tts", init: { method: "POST" } }),
    {
      fetchImpl: async () => {
        calls += 1;
        throw new Error("ECONNRESET");
      },
      sleep: async () => {},
    },
  );
  assert.deepEqual(result, { ok: false, kind: "unreachable" });
  assert.equal(calls, 2);
});

test("Retry-After over the wait cap is not slept", () => {
  assert.equal(isRetryableVoiceStatus(429), true);
  assert.equal(isRetryableVoiceStatus(400), false);
  assert.equal(parseRetryAfterMs("1"), 1000);
  assert.equal(backoffMs(0, VOICE_RETRY_MAX_WAIT_MS + 1), -1);
  assert.equal(backoffMs(0, 250), 250);
  assert.equal(mapUpstreamVoiceError(429, "stt").code, "busy");
  assert.equal(mapUpstreamVoiceError(404, "tts").code, "unknown_voice");
});
