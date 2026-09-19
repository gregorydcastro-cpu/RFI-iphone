import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DEMO_JOBS, isDemoOrFictionalJob } from "./jobs.ts";
import {
  buildProcoreBotRefreshPayload,
  PROCORE_BOT_ID,
  PROCORE_BOT_REFRESH_SCHEMA,
  requestProcoreBotRefresh,
  shouldWakeProcoreBot,
  skippedDemoProcoreBotRefresh,
} from "./procoreBot.ts";
import {
  memoryBotRequests,
  resetMemoryBotRequests,
} from "./procoreBotQueue.ts";
import {
  MAPLE_POINT_PROJECT_NAME,
  MAPLE_POINT_REQUEST_ID,
} from "./shareCatalog.ts";

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

function recordingFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response("{}", { status: 202 });
  };
  return { calls, fetchImpl };
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

test("Maple Point / DEMO_JOBS never enqueue or POST a bot wake", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.PROCORE_BOT_WAKE_URL = "https://bots.example.test/procore-wake";
  process.env.PROCORE_BOT_WAKE_SECRET = "wake-secret";

  const { calls, fetchImpl } = recordingFetch();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    const maple = DEMO_JOBS.find((job) => job.slug === "maple-point");
    assert.ok(maple);

    const sites = [
      {
        site: "weekly-refresh",
        projectName: MAPLE_POINT_PROJECT_NAME,
        requestId: MAPLE_POINT_REQUEST_ID,
      },
      {
        site: "refresh-all",
        projectName: MAPLE_POINT_PROJECT_NAME,
        requestId: MAPLE_POINT_REQUEST_ID,
      },
      {
        site: "livePack",
        projectName: maple.name,
        requestId: "maple-point-733",
      },
      {
        site: "cedar-ridge",
        projectName: "Cedar Ridge Outpatient",
        requestId: "cedar-ridge-200",
      },
    ];

    for (const site of sites) {
      assert.equal(
        isDemoOrFictionalJob({
          name: site.projectName,
          requestId: site.requestId,
        }),
        true,
        site.site,
      );
      assert.equal(
        shouldWakeProcoreBot({
          name: site.projectName,
          requestId: site.requestId,
        }),
        false,
        site.site,
      );
      const result = await requestProcoreBotRefresh(
        {
          projectName: site.projectName,
          room: "101",
          requestId: site.requestId,
          reason: site.site,
        },
        { fetch: fetchImpl },
      );
      assert.equal(result.ok, false, site.site);
      assert.equal(result.requested, false, site.site);
      assert.equal(result.skipped, true, site.site);
      assert.equal(result.queued, false, site.site);
      assert.equal(result.delivered, false, site.site);
      assert.equal(result.hook, "none", site.site);
      assert.equal(result.reason, "demo_skipped", site.site);
    }

    assert.equal(calls.length, 0);
    assert.equal(memoryBotRequests().length, 0);
    assert.deepEqual(skippedDemoProcoreBotRefresh().reason, "demo_skipped");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bot fallback without a hook is not a successful wake", async () => {
  delete process.env.PROCORE_BOT_WAKE_URL;
  delete process.env.PROCORE_BOT_WAKE_SECRET;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const result = await requestProcoreBotRefresh({
    projectName: "Some Real Client Job",
    room: "101",
    requestId: "some-real-client-job",
  });
  assert.equal(result.ok, false);
  assert.equal(result.queued, false);
  assert.equal(result.delivered, false);
  assert.equal(result.hook, "none");
  assert.equal(result.reason, "hook_unconfigured");
  assert.equal(result.botId, PROCORE_BOT_ID);
  assert.equal(memoryBotRequests().length, 1);
});

test("non-demo name still POSTs the structured request to PROCORE_BOT_WAKE_URL", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.PROCORE_BOT_WAKE_URL = "https://bots.example.test/procore-wake";
  process.env.PROCORE_BOT_WAKE_SECRET = "wake-secret";

  const { calls, fetchImpl } = recordingFetch();
  const result = await requestProcoreBotRefresh(
    {
      projectName: "Some Real Client Job",
      room: "733",
      requestId: "some-real-client-job-733",
      reason: "missing_tokens",
    },
    {
      now: () => "2026-09-19T12:00:00.000Z",
      fetch: fetchImpl,
    },
  );

  assert.equal(shouldWakeProcoreBot({
    name: "Some Real Client Job",
    requestId: "some-real-client-job-733",
  }), true);
  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(result.queued, false);
  assert.equal(result.skipped, undefined);
  assert.equal(result.hook, "http");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://bots.example.test/procore-wake");
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get("authorization"), "Bearer wake-secret");
  assert.equal(headers.get("x-gcfieldlog-bot-id"), PROCORE_BOT_ID);
  const body = JSON.parse(String(calls[0]?.init.body)) as {
    schema: string;
    requestId: string;
    projectName: string;
  };
  assert.equal(body.schema, PROCORE_BOT_REFRESH_SCHEMA);
  assert.equal(body.requestId, "some-real-client-job-733");
  assert.equal(body.projectName, "Some Real Client Job");
});

test("allowlisted non-demo name can still wake when hooks are configured", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.PROCORE_BOT_WAKE_URL = "https://bots.example.test/procore-wake";

  const { calls, fetchImpl } = recordingFetch();
  const result = await requestProcoreBotRefresh(
    {
      projectName: "Danoff High School",
      room: "733",
      requestId: "sample-arch-bounds-733",
      reason: "refresh",
    },
    { fetch: fetchImpl },
  );
  assert.equal(isDemoOrFictionalJob({
    name: "Danoff High School",
    requestId: "sample-arch-bounds-733",
  }), false);
  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(result.reason, "ok");
  assert.equal(calls.length, 1);
});
