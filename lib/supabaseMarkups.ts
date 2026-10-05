/**
 * Server read/upsert for `public.markup_overlays`.
 *
 * Columns: request_id, sheet_id, vectors jsonb (circle/box/arrow/text),
 * user_id, updated_at. Unique on (request_id, sheet_id, user_id).
 *
 * Writes use SUPABASE_SERVICE_ROLE_KEY (tokens / privileged path).
 * user_id is auth.uid()::text so authenticated RLS matches. Anon has no
 * grants. Same pattern as `procore_connections` / `rfis`. Never call Procore.
 */

import { asOverlayRecord, parseVectors, type MarkupOverlayRecord, type MarkupVectorsJson } from "./markup";
import { MARKUP_OVERLAYS_TABLE } from "./schema";
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

export type MarkupCloudFail = "network" | "server" | "abort";

export type MarkupUpsertResult = {
  row: MarkupOverlayRecord | null;
  fail: MarkupCloudFail | null;
};

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

  const result = await restFetch(
    config,
    `${MARKUP_OVERLAYS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!result.response || !result.response.ok) return null;
  const json: unknown = await result.response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asOverlayRecord(row, input.requestId, input.sheetId);
}

export async function upsertMarkupOverlay(
  input: UpsertMarkupOverlayInput,
): Promise<MarkupUpsertResult> {
  const config = getSupabaseServiceConfig();
  if (!config) return { row: null, fail: null };

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: input.userId,
    request_id: input.requestId,
    sheet_id: input.sheetId,
    vectors: { items: parseVectors(input.vectors).items },
    updated_at: now,
  };
  if (input.id) body.id = input.id;

  const result = await restFetch(
    config,
    `${MARKUP_OVERLAYS_TABLE}?on_conflict=request_id,sheet_id,user_id`,
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    },
  );
  if (!result.response) return { row: null, fail: result.fail };
  if (!result.response.ok) {
    console.error("[gcfieldlog] markup_overlays upsert was not ok", {
      status: result.response.status,
    });
    const fail: MarkupCloudFail =
      result.response.status === 408 || result.response.status === 504
        ? "abort"
        : "server";
    return { row: null, fail };
  }
  const json: unknown = await result.response.json().catch(() => null);
  if (json == null) return { row: null, fail: "abort" };
  const raw = Array.isArray(json) ? json[0] : json;
  const row = asOverlayRecord(raw, input.requestId, input.sheetId);
  if (!row) return { row: null, fail: "server" };
  return { row, fail: null };
}

async function restFetch(
  config: SupabaseServiceConfig,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<
  | { response: Response; fail: null }
  | { response: null; fail: "network" | "abort" }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
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
    return { response, fail: null };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] markup_overlays request failed", { aborted });
    return { response: null, fail: aborted ? "abort" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
