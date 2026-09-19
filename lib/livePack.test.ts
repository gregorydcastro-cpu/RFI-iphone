import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getJob } from "./jobs.ts";
import { refreshLiveRoomPack } from "./livePack.ts";
import {
  memoryBotRequests,
  resetMemoryBotRequests,
} from "./procoreBotQueue.ts";

const previous = {
  PROCORE_BOT_WAKE_URL: process.env.PROCORE_BOT_WAKE_URL,
  PROCORE_BOT_WAKE_SECRET: process.env.PROCORE_BOT_WAKE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

afterEach(() => {
  restoreEnv("PROCORE_BOT_WAKE_URL", previous.PROCORE_BOT_WAKE_URL);
  restoreEnv("PROCORE_BOT_WAKE_SECRET", previous.PROCORE_BOT_WAKE_SECRET);
  restoreEnv("SUPABASE_URL", previous.SUPABASE_URL);
  restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previous.SUPABASE_SERVICE_ROLE_KEY);
  restoreEnv("SUPABASE_ANON_KEY", previous.SUPABASE_ANON_KEY);
  resetMemoryBotRequests();
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

test("livePack fallback does not enqueue or POST a wake for Maple Point", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.PROCORE_BOT_WAKE_URL = "https://bots.example.test/procore-wake";
  process.env.PROCORE_BOT_WAKE_SECRET = "wake-secret";

  const job = getJob("maple-point");
  assert.ok(job);

  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response("{}", { status: 202 });
  };
  try {
    const live = await refreshLiveRoomPack({
      requestId: "maple-point-733",
      job,
      room: "733",
    });
    assert.ok(live);
    assert.equal(live.pull, "none");
    assert.equal(live.bot?.reason, "demo_skipped");
    assert.equal(live.bot?.queued, false);
    assert.equal(live.bot?.delivered, false);
    assert.equal(calls.length, 0);
    assert.equal(memoryBotRequests().length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("livePack fallback can still wake a non-demo job", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.PROCORE_BOT_WAKE_URL = "https://bots.example.test/procore-wake";

  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response("{}", { status: 202 });
  };
  try {
    const live = await refreshLiveRoomPack({
      requestId: "some-real-client-job-733",
      job: {
        slug: "some-real-client-job",
        name: "Some Real Client Job",
        city: "",
        phase: "Live",
        roomsHint: "",
      },
      room: "733",
    });
    assert.ok(live);
    assert.equal(live.pull, "bot");
    assert.equal(live.bot?.delivered, true);
    assert.equal(live.bot?.reason, "ok");
    assert.deepEqual(calls, ["https://bots.example.test/procore-wake"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
