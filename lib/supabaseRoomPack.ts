/**
 * Read `public.room_packs` using the locked contract:
 *   id, project_name, pack_data, created_at
 *
 * request_id / room / pulled_at / company_id live inside pack_data
 * (gcpullog.room_pack.v1). Query JSONB — never extra columns.
 *
 * Env: SUPABASE_URL + SUPABASE_ANON_KEY (project aejevzkqvlwbmjbqdxuu).
 */

import { readEnv } from "./env";
import { normalizeRoomPack, type RoomPack } from "./pack";

export const SUPABASE_URL_KEY = "SUPABASE_URL" as const;
export const SUPABASE_ANON_KEY_KEY = "SUPABASE_ANON_KEY" as const;

const FETCH_TIMEOUT_MS = 8_000;

type SupabaseConfig = { url: string; anonKey: string };

type RoomPackRow = {
  id?: string;
  project_name?: string | null;
  pack_data?: unknown;
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
  return normalizeRoomPack(row.pack_data);
}

/**
 * Latest row for this request/room/project. Ordered by created_at desc.
 */
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
      ["pack_data->>request_id", eq(requestId)],
    ]);
    if (pack) return pack;
  }

  if (input.projectName && input.room) {
    const byNumber = await queryOne(config, [
      ["project_name", eq(input.projectName)],
      ["pack_data->room->>number", eq(input.room)],
    ]);
    if (byNumber) return byNumber;

    const byName = await queryOne(config, [
      ["project_name", eq(input.projectName)],
      ["pack_data->room->>name", eq(input.room)],
    ]);
    if (byName) return byName;

    const byRoomString = await queryOne(config, [
      ["project_name", eq(input.projectName)],
      ["pack_data->>room", eq(input.room)],
    ]);
    if (byRoomString) return byRoomString;
  }

  if (input.projectName) {
    const byProjectName = await queryOne(config, [
      ["project_name", eq(input.projectName)],
    ]);
    if (byProjectName) return byProjectName;

    const byPackProject = await queryOne(config, [
      ["pack_data->>project", eq(input.projectName)],
    ]);
    if (byPackProject) return byPackProject;

    const byPackProjectName = await queryOne(config, [
      ["pack_data->project->>name", eq(input.projectName)],
    ]);
    if (byPackProjectName) return byPackProjectName;
  }

  return null;
}

function eq(value: string): string {
  return `eq."${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

async function queryOne(
  config: SupabaseConfig,
  filters: [string, string][],
): Promise<RoomPack | null> {
  const params = new URLSearchParams();
  params.set("select", "id,project_name,created_at,pack_data");
  for (const [key, value] of filters) params.set(key, value);
  params.set("order", "created_at.desc");
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
