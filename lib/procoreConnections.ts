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

import { readEnvAlias } from "./env";

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
  accessToken: string;
  refreshToken: string | null;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

const FETCH_TIMEOUT_MS = 8_000;

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
  params.set("select", "user_id,access_token,refresh_token");
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
    accessToken: record.access_token,
    refreshToken: asStringOrNull(record.refresh_token),
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
