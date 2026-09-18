/**
 * Service-role read/write for `procore_connections.notify_email`.
 *
 * Field Log settings save/load should call these helpers. This module
 * PATCHes notify_email only — it never inserts a dummy token row
 * (access_token is NOT NULL). Cron / Refresh all use
 * fetchNotifyEmailsByUserIds after persist.
 */

import {
  NOTIFY_EMAIL_COLUMN,
  normalizeNotifyEmail,
  parseNotifyEmailInput,
} from "./notifyMike";
import {
  getSupabaseServiceConfig,
  PROCORE_CONNECTIONS_TABLE,
} from "./procoreConnections";

const FETCH_TIMEOUT_MS = 8_000;

export type NotifyEmailUpsert =
  | { ok: true; notify_email: string | null }
  | { ok: false; error: string; status: number };

export async function fetchNotifyEmailForUser(
  userId: string,
): Promise<string | null> {
  const map = await fetchNotifyEmailsByUserIds([userId]);
  return map.get(userId) ?? null;
}

export async function fetchNotifyEmailsByUserIds(
  userIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const config = getSupabaseServiceConfig();
  if (!config) return out;

  const params = new URLSearchParams();
  params.set("user_id", `in.(${unique.map(quoteRestValue).join(",")})`);
  params.set("select", `user_id,${NOTIFY_EMAIL_COLUMN}`);
  params.set("limit", String(Math.max(unique.length, 1)));

  const response = await restFetch(
    config.url,
    config.serviceRoleKey,
    `${PROCORE_CONNECTIONS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) {
    if (response && !response.ok) {
      console.error("[gcfieldlog] notify_email lookup was not ok", {
        status: response.status,
      });
    }
    return out;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return out;
  for (const row of json) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.user_id !== "string") continue;
    out.set(record.user_id, normalizeNotifyEmail(asStringOrNull(record.notify_email)));
  }
  return out;
}

/**
 * PATCH notify_email on an existing procore_connections row.
 * Field Log settings save should call this. Does not insert tokens.
 */
export async function upsertNotifyEmail(
  userId: string,
  email: string | null,
): Promise<NotifyEmailUpsert> {
  const parsed = parseNotifyEmailInput(email);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };

  const config = getSupabaseServiceConfig();
  if (!config) {
    return {
      ok: false,
      error: "Supabase service role is required to save notify_email.",
      status: 503,
    };
  }

  const params = new URLSearchParams();
  params.set("user_id", `eq.${userId}`);

  const response = await restFetch(
    config.url,
    config.serviceRoleKey,
    `${PROCORE_CONNECTIONS_TABLE}?${params.toString()}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        notify_email: parsed.notify_email,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!response) {
    return { ok: false, error: "Could not save notify_email.", status: 503 };
  }
  if (!response.ok) {
    console.error("[gcfieldlog] notify_email upsert was not ok", {
      status: response.status,
    });
    return { ok: false, error: "Could not save notify_email.", status: 503 };
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  if (!row || typeof row !== "object") {
    return {
      ok: false,
      error:
        "No procore_connections row for this user. Connect Procore first, then set notify email.",
      status: 404,
    };
  }
  return { ok: true, notify_email: parsed.notify_email };
}

function quoteRestValue(value: string): string {
  return `"${value.replace(/"/g, "")}"`;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function restFetch(
  url: string,
  serviceRoleKey: string,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] notify_email request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
