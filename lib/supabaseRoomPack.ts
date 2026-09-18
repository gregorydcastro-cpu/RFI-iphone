/**
 * Server-only reader/writer for `public.room_packs` on the gc-field-log
 * Supabase project (aejevzkqvlwbmjbqdxuu).
 *
 * Env (exact names, already on Vercel):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *
 * Live website views always fetch with `cache: "no-store"`. Maple Point
 * local demo is used when these keys are unset.
 */

import { readEnv } from "./env";
import { stampRoomPack, type RoomPack } from "./pack";
import { coerceRoomPack } from "./packNormalize";
import { isRoomPackShape } from "./packStatus";

export const SUPABASE_URL_KEY = "SUPABASE_URL" as const;
export const SUPABASE_ANON_KEY_KEY = "SUPABASE_ANON_KEY" as const;

const FETCH_TIMEOUT_MS = 8_000;

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export type RoomPackRow = {
  id: string;
  project_name: string;
  pack_data: unknown;
  created_at: string;
  request_id?: string | null;
  room?: string | null;
  pulled_at?: string | null;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = readEnv(SUPABASE_URL_KEY);
  const anonKey = readEnv(SUPABASE_ANON_KEY_KEY);
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

function restHeaders(anonKey: string): HeadersInit {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function restUrl(config: SupabaseConfig, pathAndQuery: string): string {
  return `${config.url}/rest/v1/${pathAndQuery}`;
}

async function restFetch(
  config: SupabaseConfig,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(restUrl(config, pathAndQuery), {
      ...init,
      headers: {
        ...restHeaders(config.anonKey),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] supabase room_packs request failed", {
      aborted,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function roomPackFromRow(row: RoomPackRow): RoomPack | null {
  const coerced = coerceRoomPack(row.pack_data);
  const pack = coerced ?? (isRoomPackShape(row.pack_data) ? row.pack_data : null);
  if (!pack) return null;
  const pulledAt =
    typeof pack.pulled_at === "string" && pack.pulled_at
      ? pack.pulled_at
      : (row.pulled_at ?? undefined);
  return stampRoomPack(pack, { pulledAt });
}

function selectQuery(): string {
  return "id,project_name,pack_data,created_at";
}

async function fetchRows(
  config: SupabaseConfig,
  filters: URLSearchParams,
): Promise<RoomPackRow[] | null> {
  filters.set("select", selectQuery());
  if (!filters.has("order")) {
    filters.set("order", "created_at.desc");
  }
  if (!filters.has("limit")) filters.set("limit", "5");

  const response = await restFetch(
    config,
    `room_packs?${filters.toString()}`,
    { method: "GET" },
  );
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] supabase room_packs read was not ok", {
      status: response.status,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json as RoomPackRow[];
}

function packDataRequestId(row: RoomPackRow): string | undefined {
  if (!row.pack_data || typeof row.pack_data !== "object") return undefined;
  const id = (row.pack_data as { request_id?: unknown }).request_id;
  return typeof id === "string" ? id : undefined;
}

function packDataRoom(row: RoomPackRow): string | undefined {
  if (!row.pack_data || typeof row.pack_data !== "object") return undefined;
  const room = (row.pack_data as { room?: unknown }).room;
  if (typeof room === "string" || typeof room === "number") return String(room);
  if (room && typeof room === "object") {
    const rec = room as { number?: unknown; name?: unknown; id?: unknown };
    if (typeof rec.number === "string") return rec.number;
    if (typeof rec.id === "string") return rec.id;
  }
  return undefined;
}

/**
 * Latest `public.room_packs` row for this request/room/project.
 * Live table columns are id, project_name, pack_data, created_at.
 * request_id / room / pulled_at live inside pack_data.
 */
export async function fetchLatestRoomPackRow(input: {
  requestId: string;
  projectName?: string;
  projectSlug?: string;
  room?: string;
}): Promise<RoomPackRow | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const requestIds = [input.requestId];
  if (input.projectSlug && input.projectSlug !== input.requestId) {
    requestIds.push(input.projectSlug);
  }

  for (const requestId of requestIds) {
    const filters = new URLSearchParams();
    filters.set("pack_data->>request_id", `eq.${requestId}`);
    filters.set("limit", "1");
    const rows = await fetchRows(config, filters);
    if (rows && rows[0]) return rows[0];
  }

  if (input.projectName && input.room) {
    const filters = new URLSearchParams();
    filters.set("project_name", `eq.${input.projectName}`);
    filters.set("limit", "5");
    const rows = await fetchRows(config, filters);
    const match = rows?.find((row) => packDataRoom(row) === input.room);
    if (match) return match;
  }

  if (input.projectName) {
    const filters = new URLSearchParams();
    filters.set("project_name", `eq.${input.projectName}`);
    filters.set("limit", "1");
    const rows = await fetchRows(config, filters);
    if (rows && rows[0]) return rows[0];
  }

  const recent = new URLSearchParams();
  recent.set("limit", "25");
  const rows = await fetchRows(config, recent);
  const found = rows?.find((row) => {
    const id = packDataRequestId(row);
    return id === input.requestId || Boolean(input.projectSlug && id === input.projectSlug);
  });
  return found ?? null;
}

/**
 * Insert a new room_packs row (history). Latest pulled_at/created_at wins.
 * Used when the Procore bot / ops posts pack JSON after a refresh.
 */
export async function insertRoomPackRow(input: {
  projectName: string;
  requestId: string;
  room: string;
  pack: RoomPack;
}): Promise<RoomPackRow | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const stamped = stampRoomPack(input.pack, { touch: true });
  const body = {
    project_name: input.projectName,
    pack_data: {
      ...stamped,
      request_id: input.requestId,
      room: stamped.room,
      pulled_at: stamped.pulled_at ?? null,
    },
  };

  const response = await restFetch(config, "room_packs", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] supabase room_packs upsert was not ok", {
      status: response.status,
      request_id: input.requestId,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  if (Array.isArray(json) && json[0]) return json[0] as RoomPackRow;
  if (json && typeof json === "object" && "id" in json) {
    return json as RoomPackRow;
  }
  return null;
}
