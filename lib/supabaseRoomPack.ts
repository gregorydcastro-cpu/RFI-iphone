/**
 * Optional read of `public.room_packs` when Vercel has SUPABASE_URL +
 * SUPABASE_ANON_KEY. Used only to serve the latest pulled pack after a
 * webhook refresh — not a schema redesign.
 */

import { readEnv } from "./env";
import { stampRoomPack, type RoomPack } from "./pack";
import { isRoomPackShape } from "./packStatus";

export const SUPABASE_URL_KEY = "SUPABASE_URL" as const;
export const SUPABASE_ANON_KEY_KEY = "SUPABASE_ANON_KEY" as const;

const FETCH_TIMEOUT_MS = 8_000;

type SupabaseConfig = { url: string; anonKey: string };

type RoomPackRow = {
  pack_data?: unknown;
  pulled_at?: string | null;
  request_id?: string | null;
  project_name?: string | null;
  room?: string | null;
  created_at?: string;
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
  };
}

export function roomPackFromRow(row: RoomPackRow): RoomPack | null {
  if (!isRoomPackShape(row.pack_data)) return null;
  const pulledAt =
    typeof row.pack_data.pulled_at === "string" && row.pack_data.pulled_at
      ? row.pack_data.pulled_at
      : (row.pulled_at ?? undefined);
  return stampRoomPack(row.pack_data, { pulledAt });
}

export async function fetchLatestRoomPackRow(input: {
  requestId: string;
  projectName?: string;
  projectSlug?: string;
  room?: string;
}): Promise<RoomPack | null> {
  const config = getSupabaseConfig();
  if (!config) return null;

  const ids = [input.requestId];
  if (input.projectSlug && input.projectSlug !== input.requestId) {
    ids.push(input.projectSlug);
  }

  for (const requestId of ids) {
    const pack = await queryOne(config, [
      ["request_id", `eq.${requestId}`],
    ]);
    if (pack) return pack;
  }

  if (input.projectName && input.room) {
    const pack = await queryOne(config, [
      ["project_name", `eq.${input.projectName}`],
      ["room", `eq.${input.room}`],
    ]);
    if (pack) return pack;
  }

  if (input.projectName) {
    const pack = await queryOne(config, [
      ["project_name", `eq.${input.projectName}`],
    ]);
    if (pack) return pack;
  }

  return null;
}

async function queryOne(
  config: SupabaseConfig,
  filters: [string, string][],
): Promise<RoomPack | null> {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,project_name,request_id,room,pulled_at,created_at,pack_data",
  );
  for (const [key, value] of filters) params.set(key, value);
  params.set("order", "pulled_at.desc.nullslast,created_at.desc");
  params.set("limit", "1");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${config.url}/rest/v1/room_packs?${params.toString()}`,
      {
        method: "GET",
        headers: restHeaders(config.anonKey),
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.error("[gcfieldlog] supabase room_packs read was not ok", {
        status: response.status,
      });
      return null;
    }
    const json: unknown = await response.json().catch(() => null);
    if (!Array.isArray(json) || !json[0]) return null;
    return roomPackFromRow(json[0] as RoomPackRow);
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
