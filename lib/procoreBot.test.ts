import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  buildProcoreBotRefreshPayload,
  PROCORE_BOT_ID,
  PROCORE_BOT_REFRESH_SCHEMA,
  requestProcoreBotRefresh,
} from "./procoreBot.ts";
import { resetMemoryBotRequests } from "./procoreBotQueue.ts";

const previous = {
  PROCORE_BOT_WAKE_URL: process.env.PROCORE_BOT_WAKE_URL,
  PROCORE_BOT_WAKE_SECRET: process.env.PROCORE_BOT_WAKE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

afterEach(() => {
  restoreEnv("PROCORE_BOT_WAKE_URL", previous.PROCORE_BOT_WAKE_URL);
  restoreEnv("PROCORE_BOT_WAKE_SECRET", previous.PROCORE_BOT_WAKE_SECRET);
  restoreEnv("SUPABASE_URL", previous.SUPABASE_URL);
  restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previous.SUPABASE_SERVICE_ROLE_KEY);
  resetMemoryBotRequests();
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

test("bot wake payload is the documented structured request", () => {
  const payload = buildProcoreBotRefreshPayload(
    {
      projectName: "Maple Point Medical Office",
      room: "733",
      requestId: "maple-point-733",
      reason: "project_not_found",
    },
    "2026-09-19T00:00:00.000Z",
  );
  assert.deepEqual(payload, {
    schema: PROCORE_BOT_REFRESH_SCHEMA,
    botId: PROCORE_BOT_ID,
    projectName: "Maple Point Medical Office",
    room: "733",
    requestId: "maple-point-733",
    reason: "project_not_found",
    requestedAt: "2026-09-19T00:00:00.000Z",
  });
  assert.equal(payload.schema, "gcfieldlog.procore_bot_refresh.v1");
});

test("bot fallback without a hook is not a successful wake", async () => {
  delete process.env.PROCORE_BOT_WAKE_URL;
  delete process.env.PROCORE_BOT_WAKE_SECRET;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result = await requestProcoreBotRefresh({
    projectName: "Maple Point Medical Office",
    room: "101",
    requestId: "maple-point",
  });
  assert.equal(result.ok, false);
  assert.equal(result.queued, false);
  assert.equal(result.delivered, false);
  assert.equal(result.hook, "none");
  assert.equal(result.reason, "hook_unconfigured");
  assert.equal(result.botId, PROCORE_BOT_ID);
});

test("bot fallback POSTs the structured request to PROCORE_BOT_WAKE_URL", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.PROCORE_BOT_WAKE_URL = "https://bots.example.test/procore-wake";
  process.env.PROCORE_BOT_WAKE_SECRET = "wake-secret";

  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await requestProcoreBotRefresh(
    {
      projectName: "Maple Point Medical Office",
      room: "733",
      requestId: "maple-point-733",
      reason: "missing_tokens",
    },
    {
      now: () => "2026-09-19T12:00:00.000Z",
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response("{}", { status: 202 });
      },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(result.queued, false);
  assert.equal(result.hook, "http");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://bots.example.test/procore-wake");
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get("authorization"), "Bearer wake-secret");
  assert.equal(headers.get("x-gcfieldlog-bot-id"), PROCORE_BOT_ID);
  const body = JSON.parse(String(calls[0]?.init.body)) as {
    schema: string;
    requestId: string;
  };
  assert.equal(body.schema, PROCORE_BOT_REFRESH_SCHEMA);
  assert.equal(body.requestId, "maple-point-733");
});
