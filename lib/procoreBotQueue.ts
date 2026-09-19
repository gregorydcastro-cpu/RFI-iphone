/**
 * Persist a structured Procore bot wake to public.procore_bot_requests.
 * Service role only. Anon has no grants. Local / unset service role
 * keeps an in-process queue for tests — that is not a fleet wake.
 */

import { readEnvAlias } from "./env.ts";
import {
  PROCORE_BOT_REQUESTS_TABLE,
  type ProcoreBotRequestRow,
} from "./schema.ts";

type ServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

function getServiceConfig(): ServiceConfig | null {
  const url = readEnvAlias("SUPABASE_URL", "supabase_url");
  const serviceRoleKey = readEnvAlias(
    "SUPABASE_SERVICE_ROLE_KEY",
    "supabase_service_role_key",
  );
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

const FETCH_TIMEOUT_MS = 8_000;

const memoryQueue: ProcoreBotRequestRow[] = [];

export type EnqueueBotRequestInput = {
  botId: string;
  projectName: string;
  room: string;
  requestId: string;
  reason?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export function memoryBotRequests(): readonly ProcoreBotRequestRow[] {
  return memoryQueue;
}

export function resetMemoryBotRequests(): void {
  memoryQueue.length = 0;
}

export async function enqueueProcoreBotRequest(
  input: EnqueueBotRequestInput,
): Promise<{ queued: boolean; storage: "supabase" | "memory" | "none"; id?: string }> {
  const config = getServiceConfig();
  const row = {
    bot_id: input.botId,
    project_name: input.projectName,
    room: input.room,
    request_id: input.requestId,
    reason: input.reason ?? null,
    status: "queued" as const,
    payload: input.payload,
    created_at: input.createdAt,
  };

  if (config) {
    const inserted = await insertBotRequestRow(config, row);
    if (inserted) return { queued: true, storage: "supabase", id: inserted };
    return { queued: false, storage: "none" };
  }

  const local: ProcoreBotRequestRow = {
    id: `mem-${memoryQueue.length + 1}`,
    ...row,
  };
  memoryQueue.push(local);
  return { queued: false, storage: "memory", id: local.id };
}

async function insertBotRequestRow(
  config: ServiceConfig,
  row: Omit<ProcoreBotRequestRow, "id">,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${config.url}/rest/v1/${PROCORE_BOT_REQUESTS_TABLE}`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(row),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.error("[gcfieldlog] procore_bot_requests insert was not ok", {
        status: response.status,
      });
      return null;
    }
    const body: unknown = await response.json().catch(() => null);
    const first = Array.isArray(body) ? body[0] : body;
    if (first && typeof first === "object" && "id" in first) {
      const id = (first as { id: unknown }).id;
      if (typeof id === "string" && id.trim()) return id;
    }
    return "ok";
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] procore_bot_requests insert failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
