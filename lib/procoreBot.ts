/**
 * Procore pull is owned by the Field Log Procore bot — not the deleted
 * Room pack webhook routine. Do not call `procore_room_pack_webhook_url`
 * or webhook Authorization from the website live path.
 *
 * Bot id (ops): 969a9d8e-c07f-44c3-ae9d-862704cd60c7
 * The bot pulls drawings from Procore and upserts `public.room_packs`.
 *
 * Wake (not log-only):
 *   1. Insert gcfieldlog.procore_bot_refresh.v1 into
 *      public.procore_bot_requests (service role) for the fleet to poll.
 *   2. POST the same payload to PROCORE_BOT_WAKE_URL when set
 *      (optional Bearer PROCORE_BOT_WAKE_SECRET).
 * Console logs are diagnostics only — they do not count as a wake.
 */

import { readEnvAlias } from "./env.ts";
import { enqueueProcoreBotRequest } from "./procoreBotQueue.ts";

export const PROCORE_BOT_ID = "969a9d8e-c07f-44c3-ae9d-862704cd60c7";
export const PROCORE_BOT_REFRESH_SCHEMA = "gcfieldlog.procore_bot_refresh.v1";
export const PROCORE_BOT_WAKE_URL_KEY = "PROCORE_BOT_WAKE_URL";
export const PROCORE_BOT_WAKE_SECRET_KEY = "PROCORE_BOT_WAKE_SECRET";

const WAKE_TIMEOUT_MS = 8_000;

export type ProcoreBotRefreshRequest = {
  projectName: string;
  room: string;
  requestId: string;
  reason?: string | null;
};

export type ProcoreBotRefreshPayload = {
  schema: typeof PROCORE_BOT_REFRESH_SCHEMA;
  botId: typeof PROCORE_BOT_ID;
  projectName: string;
  room: string;
  requestId: string;
  reason: string | null;
  requestedAt: string;
};

export type ProcoreBotHook = "queue" | "http" | "queue+http" | "none";

export type ProcoreBotRefreshResult = {
  ok: boolean;
  requested: true;
  botId: typeof PROCORE_BOT_ID;
  queued: boolean;
  delivered: boolean;
  hook: ProcoreBotHook;
  reason: "ok" | "hook_unconfigured" | "queue_failed" | "http_failed";
};

export type ProcoreBotDeps = {
  fetch?: typeof fetch;
  now?: () => string;
};

export function readProcoreBotWakeUrl(): string | undefined {
  return readEnvAlias(PROCORE_BOT_WAKE_URL_KEY, "procore_bot_wake_url");
}

export function readProcoreBotWakeSecret(): string | undefined {
  return readEnvAlias(PROCORE_BOT_WAKE_SECRET_KEY, "procore_bot_wake_secret");
}

export function buildProcoreBotRefreshPayload(
  input: ProcoreBotRefreshRequest,
  requestedAt = new Date().toISOString(),
): ProcoreBotRefreshPayload {
  return {
    schema: PROCORE_BOT_REFRESH_SCHEMA,
    botId: PROCORE_BOT_ID,
    projectName: input.projectName.trim(),
    room: input.room.trim(),
    requestId: input.requestId.trim(),
    reason: input.reason?.trim() || null,
    requestedAt,
  };
}

function hookKind(queued: boolean, delivered: boolean): ProcoreBotHook {
  if (queued && delivered) return "queue+http";
  if (queued) return "queue";
  if (delivered) return "http";
  return "none";
}

/**
 * Ask the Procore bot to pull a fresh pack. Website callers then read
 * `public.room_packs` — they do not wait on a webhook.
 *
 * A wake is a queue insert and/or HTTP POST. Logging alone is not a wake.
 */
export async function requestProcoreBotRefresh(
  input: ProcoreBotRefreshRequest,
  deps: ProcoreBotDeps = {},
): Promise<ProcoreBotRefreshResult> {
  const requestedAt = deps.now?.() ?? new Date().toISOString();
  const payload = buildProcoreBotRefreshPayload(input, requestedAt);
  const wakeUrl = readProcoreBotWakeUrl();

  const queuedRow = await enqueueProcoreBotRequest({
    botId: PROCORE_BOT_ID,
    projectName: payload.projectName,
    room: payload.room,
    requestId: payload.requestId,
    reason: payload.reason,
    payload,
    createdAt: requestedAt,
  });
  const queued = queuedRow.queued;

  let delivered = false;
  let httpAttempted = false;
  if (wakeUrl) {
    httpAttempted = true;
    delivered = await postBotWake(wakeUrl, payload, deps.fetch ?? fetch);
  }

  const ok = queued || delivered;
  const reason = ok
    ? "ok"
    : httpAttempted
      ? "http_failed"
      : queuedRow.storage === "none"
        ? "queue_failed"
        : "hook_unconfigured";

  console.info("[gcfieldlog] procore bot refresh requested", {
    request_id: payload.requestId,
    room: payload.room,
    bot_id: PROCORE_BOT_ID,
    queued,
    delivered,
    hook: hookKind(queued, delivered),
    reason,
  });

  return {
    ok,
    requested: true,
    botId: PROCORE_BOT_ID,
    queued,
    delivered,
    hook: hookKind(queued, delivered),
    reason,
  };
}

async function postBotWake(
  url: string,
  payload: ProcoreBotRefreshPayload,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  const secret = readProcoreBotWakeSecret();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAKE_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-GCFieldLog-Bot-Id": PROCORE_BOT_ID,
    };
    if (secret) headers.Authorization = `Bearer ${secret}`;
    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[gcfieldlog] procore bot wake HTTP was not ok", {
        status: response.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] procore bot wake HTTP failed", { aborted });
    return false;
  } finally {
    clearTimeout(timer);
  }
}
