import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { sendFieldEmail } from "./fieldEmail.ts";

const previous = process.env.RESEND_API_KEY;

afterEach(() => {
  if (previous === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previous;
});

const message = {
  to: "alex.rivera@crew.example",
  subject: "GC Field Log invite — Maple Point Medical Office",
  text: "You are invited to GC Field Log as full crew.\nJob: Maple Point Medical Office\n",
};

test("a missing mailer key is email_failed and does not call the sender", async () => {
  delete process.env.RESEND_API_KEY;
  let calls = 0;
  const result = await sendFieldEmail({
    ...message,
    fetchImpl: async () => {
      calls += 1;
      return new Response("no", { status: 500 });
    },
  });
  assert.equal(calls, 0);
  assert.deepEqual(result, { ok: false, code: "email_failed" });
  assert.equal("error" in result, false);
});

test("a non-2xx from the sender is email_failed and drops the provider body", async () => {
  process.env.RESEND_API_KEY = "test-key-not-real";
  const result = await sendFieldEmail({
    ...message,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: "Resend domain is not verified" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
  });
  assert.deepEqual(result, { ok: false, code: "email_failed" });
  assert.equal(JSON.stringify(result).toLowerCase().includes("resend"), false);
});

test("a dropped sender call is offline and a stalled call is timeout", async () => {
  process.env.RESEND_API_KEY = "test-key-not-real";
  const dropped = await sendFieldEmail({
    ...message,
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });
  assert.deepEqual(dropped, { ok: false, code: "offline" });

  const stalled = await sendFieldEmail({
    ...message,
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        const abort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener("abort", abort);
      }),
  });
  assert.deepEqual(stalled, { ok: false, code: "timeout" });
});

test("a 2xx confirms the send", async () => {
  process.env.RESEND_API_KEY = "test-key-not-real";
  let auth = "";
  const result = await sendFieldEmail({
    ...message,
    fetchImpl: async (_url, init) => {
      auth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? "");
      return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
    },
  });
  assert.deepEqual(result, { ok: true });
  assert.match(auth, /^Bearer /);
  assert.equal(auth.includes("RESEND"), false);
});
