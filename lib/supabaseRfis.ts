/**
 * Server insert for `public.rfis`.
 *
 * Writes use SUPABASE_SERVICE_ROLE_KEY because stub session ids
 * (`stub:` + sha256 email) are not auth.uid(). Anon has no grants.
 * Optional `markup_id` references `public.markup_overlays`.
 * Never call Procore from here.
 */

import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections";
import {
  RFIS_TABLE,
  type RfiDraftRow,
  type RfiDraftStatus,
} from "./rfiSchema";

const FETCH_TIMEOUT_MS = 8_000;

export type InsertRfiDraftInput = {
  id?: string;
  userId: string;
  subject: string;
  description: string;
  location?: string | null;
  sheetId?: string | null;
  markupId?: string | null;
  status?: RfiDraftStatus;
};

export function isRfiTableWriteConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export async function insertRfiDraftRow(
  input: InsertRfiDraftInput,
): Promise<RfiDraftRow | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    user_id: input.userId,
    subject: input.subject,
    description: input.description,
    location: input.location ?? null,
    sheet_id: input.sheetId ?? null,
    markup_id: input.markupId ?? null,
    status: input.status ?? "draft",
    updated_at: now,
  };
  if (input.id) body.id = input.id;

  const response = await restFetch(config, RFIS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] rfis insert was not ok", {
      status: response.status,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asRfiDraftRow(row);
}

function asRfiDraftRow(value: unknown): RfiDraftRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.user_id !== "string") {
    return null;
  }
  if (typeof record.subject !== "string" || typeof record.description !== "string") {
    return null;
  }
  const status = record.status === "ready" ? "ready" : "draft";
  return {
    id: record.id,
    user_id: record.user_id,
    subject: record.subject,
    description: record.description,
    location: typeof record.location === "string" ? record.location : null,
    sheet_id: typeof record.sheet_id === "string" ? record.sheet_id : null,
    markup_id: typeof record.markup_id === "string" ? record.markup_id : null,
    status,
    created_at:
      typeof record.created_at === "string" ? record.created_at : new Date().toISOString(),
    updated_at:
      typeof record.updated_at === "string" ? record.updated_at : new Date().toISOString(),
  };
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
    console.error("[gcfieldlog] rfis request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
