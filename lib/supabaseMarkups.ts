/**
 * Server read/upsert for `public.markup_overlays` (PR #9 column shape).
 *
 * Writes use SUPABASE_SERVICE_ROLE_KEY because stub session ids
 * (`stub:` + sha256 email) are not auth.uid(). Anon has no grants.
 * Never call Procore from here.
 */

import {
  asOverlayRecord,
  MARKUP_OVERLAYS_TABLE,
  parseVectors,
  type MarkupOverlayRecord,
  type MarkupVectorsJson,
} from "./markup";
import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections";

const FETCH_TIMEOUT_MS = 8_000;

export type UpsertMarkupOverlayInput = {
  id?: string;
  userId: string;
  requestId: string;
  sheetId: string;
  vectors: MarkupVectorsJson;
};

export function isMarkupTableWriteConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export async function selectMarkupOverlay(input: {
  userId: string;
  requestId: string;
  sheetId: string;
}): Promise<MarkupOverlayRecord | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("user_id", `eq.${input.userId}`);
  params.set("request_id", `eq.${input.requestId}`);
  params.set("sheet_id", `eq.${input.sheetId}`);
  params.set("select", "id,request_id,sheet_id,vectors,user_id,created_at,updated_at");
  params.set("limit", "1");

  const response = await restFetch(
    config,
    `${MARKUP_OVERLAYS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asOverlayRecord(row, input.requestId, input.sheetId);
}

export async function upsertMarkupOverlay(
  input: UpsertMarkupOverlayInput,
): Promise<MarkupOverlayRecord | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: input.userId,
    request_id: input.requestId,
    sheet_id: input.sheetId,
    vectors: { items: parseVectors(input.vectors).items },
    updated_at: now,
  };
  if (input.id) body.id = input.id;

  const response = await restFetch(
    config,
    `${MARKUP_OVERLAYS_TABLE}?on_conflict=request_id,sheet_id,user_id`,
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    },
  );
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] markup_overlays upsert was not ok", {
      status: response.status,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asOverlayRecord(row, input.requestId, input.sheetId);
}

async function restFetch(
  config: SupabaseServiceConfig,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] markup_overlays request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
