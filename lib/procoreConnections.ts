/**
 * Per-user Procore tokens in `public.procore_connections`.
 *
 * Writes require SUPABASE_SERVICE_ROLE_KEY (service role). The anon key
 * must never read or write this table — never expose tokens in the browser.
 * Status endpoints never select access_token / refresh_token.
 *
 * company_id is last-known from /me only. Live API calls must resolve
 * company id per project (see resolveCompanyIdForProject).
 */

import { readEnvAlias } from "./env.ts";

export const PROCORE_CONNECTIONS_TABLE = "procore_connections";

export type ProcoreConnectionStatus = {
  userId: string;
  email: string | null;
  companyId: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
  connected: true;
};

export type ProcoreConnectionSecrets = {
  userId: string;
  email: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  companyId: string | null;
  procoreUserId: string | null;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

const FETCH_TIMEOUT_MS = 8_000;
const REST_ERROR_BODY_MAX = 240;

export type ProcoreStorageFailureReason =
  | "storage_unconfigured"
  | "storage_key_invalid"
  | "storage_write_failed";

export function getSupabaseServiceConfig(): SupabaseServiceConfig | null {
  const url = readEnvAlias("SUPABASE_URL", "supabase_url");
  const serviceRoleKey = readEnvAlias(
    "SUPABASE_SERVICE_ROLE_KEY",
    "supabase_service_role_key",
  );
  if (!url || !serviceRoleKey) return null;
  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

export function isProcoreTokenStorageConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

/**
 * True when SUPABASE_SERVICE_ROLE_KEY is a compact JWT whose payload
 * `role` is `service_role`. False if missing, malformed, truncated, or
 * any other role (anon / authenticated / publishable). Never logs the key.
 */
export function isSupabaseServiceRoleKeyValid(): boolean {
  const config = getSupabaseServiceConfig();
  if (!config) return false;
  return jwtRoleClaim(config.serviceRoleKey) === "service_role";
}

/** JWT `role` claim from a compact JWT. Never logs the token. */
export function jwtRoleClaim(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return typeof payload?.role === "string" ? payload.role : null;
}

/**
 * Classify a failed token upsert. `storage_unconfigured` only when URL or
 * key is missing; `storage_key_invalid` when a key is present but is not a
 * service_role JWT; otherwise `storage_write_failed`.
 */
export function procoreStorageFailureReason(): ProcoreStorageFailureReason {
  if (!getSupabaseServiceConfig()) return "storage_unconfigured";
  if (!isSupabaseServiceRoleKeyValid()) return "storage_key_invalid";
  return "storage_write_failed";
}

export async function upsertProcoreConnection(input: {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  companyId?: string | null;
  procoreUserId?: string | null;
}): Promise<boolean> {
  const config = getSupabaseServiceConfig();
  if (!config) return false;

  const now = new Date().toISOString();
  const body = {
    user_id: input.userId,
    email: input.email,
    access_token: input.accessToken,
    refresh_token: input.refreshToken ?? null,
    expires_at: input.expiresAt ?? null,
    company_id: input.companyId ?? null,
    procore_user_id: input.procoreUserId ?? null,
    updated_at: now,
  };

  const response = await restFetch(
    config,
    `${PROCORE_CONNECTIONS_TABLE}?on_conflict=user_id`,
    {
      method: "POST",
      headers: {
        Prefer: "return=minimal,resolution=merge-duplicates",
      },
      body: JSON.stringify(body),
    },
  );
  if (!response) return false;
  if (!response.ok) {
    console.error("[gcfieldlog] procore_connections upsert was not ok", {
      status: response.status,
      body: await restErrorSnippet(response),
    });
    return false;
  }
  return true;
}

export async function fetchProcoreConnectionStatus(
  userId: string,
): Promise<ProcoreConnectionStatus | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("user_id", `eq.${userId}`);
  params.set("select", "user_id,email,company_id,expires_at,updated_at");
  params.set("limit", "1");

  const response = await restFetch(
    config,
    `${PROCORE_CONNECTIONS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) {
    if (response && !response.ok) {
      console.error("[gcfieldlog] procore_connections status read was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : null;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record.user_id !== "string") return null;
  return {
    userId: record.user_id,
    email: asStringOrNull(record.email),
    companyId: asStringOrNull(record.company_id),
    expiresAt: asStringOrNull(record.expires_at),
    updatedAt: asStringOrNull(record.updated_at),
    connected: true,
  };
}

export async function fetchProcoreConnectionSecrets(
  userId: string,
): Promise<ProcoreConnectionSecrets | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("user_id", `eq.${userId}`);
  params.set(
    "select",
    "user_id,email,access_token,refresh_token,expires_at,company_id,procore_user_id",
  );
  params.set("limit", "1");

  const response = await restFetch(
    config,
    `${PROCORE_CONNECTIONS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : null;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.user_id !== "string" ||
    typeof record.access_token !== "string"
  ) {
    return null;
  }
  return {
    userId: record.user_id,
    email: asStringOrNull(record.email),
    accessToken: record.access_token,
    refreshToken: asStringOrNull(record.refresh_token),
    expiresAt: asStringOrNull(record.expires_at),
    companyId: asStringOrNull(record.company_id),
    procoreUserId: asStringOrNull(record.procore_user_id),
  };
}

export async function deleteProcoreConnection(userId: string): Promise<boolean> {
  const config = getSupabaseServiceConfig();
  if (!config) return false;

  const params = new URLSearchParams();
  params.set("user_id", `eq.${userId}`);
  const response = await restFetch(
    config,
    `${PROCORE_CONNECTIONS_TABLE}?${params.toString()}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  if (!response) return false;
  if (!response.ok) {
    console.error("[gcfieldlog] procore_connections delete was not ok", {
      status: response.status,
    });
    return false;
  }
  return true;
}

function restHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    Accept: "application/json",
    "Content-Type": "application/json",
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
        ...restHeaders(config.serviceRoleKey),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] procore_connections request failed", {
      aborted,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function restErrorSnippet(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (trimmed.length <= REST_ERROR_BODY_MAX) return trimmed;
  return `${trimmed.slice(0, REST_ERROR_BODY_MAX)}…`;
}
