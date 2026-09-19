/**
 * Field roles live in public.profiles and auth.users raw_app_meta_data.
 * Never authorize from user_metadata (it is user-editable).
 */

import { parseFieldRoleName, type FieldRoleName } from "./auth";
import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections";
import { mergeAppMetadataRole } from "./session";

export const PROFILES_TABLE = "profiles";

export type ProfileRow = {
  id: string;
  email: string | null;
  role: FieldRoleName;
  created_at: string;
  updated_at: string;
};

export type ProfileStoreDeps = {
  fetch?: typeof fetch;
  supabase?: SupabaseServiceConfig | null;
  memory?: Map<string, ProfileRow>;
};

const FETCH_TIMEOUT_MS = 8_000;

const g = globalThis as typeof globalThis & {
  __gcFieldLogProfiles?: Map<string, ProfileRow>;
};

export function profileMemory(): Map<string, ProfileRow> {
  if (!g.__gcFieldLogProfiles) {
    g.__gcFieldLogProfiles = new Map();
  }
  return g.__gcFieldLogProfiles;
}

export function resetProfileMemoryForTests(): void {
  g.__gcFieldLogProfiles = new Map();
}

export function asProfileRow(value: unknown): ProfileRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id) return null;
  const email =
    typeof record.email === "string" ? record.email.trim().toLowerCase() : null;
  return {
    id: record.id,
    email: email && email.includes("@") ? email : null,
    role: parseFieldRoleName(record.role),
    created_at:
      typeof record.created_at === "string"
        ? record.created_at
        : new Date().toISOString(),
    updated_at:
      typeof record.updated_at === "string"
        ? record.updated_at
        : new Date().toISOString(),
  };
}

export async function fetchProfileRole(
  userId: string,
  deps: ProfileStoreDeps = {},
): Promise<FieldRoleName | null> {
  const row = await fetchProfile(userId, deps);
  return row?.role ?? null;
}

export async function fetchProfile(
  userId: string,
  deps: ProfileStoreDeps = {},
): Promise<ProfileRow | null> {
  if (!userId) return null;
  const config =
    deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) {
    return (deps.memory ?? profileMemory()).get(userId) ?? null;
  }
  const params = new URLSearchParams();
  params.set("id", `eq.${userId}`);
  params.set("select", "id,email,role,created_at,updated_at");
  params.set("limit", "1");
  const response = await restFetch(
    config,
    `${PROFILES_TABLE}?${params.toString()}`,
    { method: "GET" },
    deps.fetch,
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asProfileRow(row);
}

export async function upsertProfile(
  input: { id: string; email: string; role: FieldRoleName },
  deps: ProfileStoreDeps = {},
): Promise<ProfileRow | null> {
  const now = new Date().toISOString();
  const row: ProfileRow = {
    id: input.id,
    email: input.email.trim().toLowerCase(),
    role: parseFieldRoleName(input.role),
    created_at: now,
    updated_at: now,
  };
  const config =
    deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) {
    const memory = deps.memory ?? profileMemory();
    const existing = memory.get(input.id);
    const next = existing
      ? { ...existing, email: row.email, role: row.role, updated_at: now }
      : row;
    memory.set(input.id, next);
    return next;
  }

  const response = await restFetch(
    config,
    PROFILES_TABLE,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: row.id,
        email: row.email,
        role: row.role,
        updated_at: now,
      }),
    },
    deps.fetch,
  );
  if (!response || !response.ok) {
    if (response && !response.ok) {
      console.error("[gcfieldlog] profiles upsert was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const parsed = asProfileRow(Array.isArray(json) ? json[0] : json);
  return parsed ?? row;
}

export async function applyProfileRole(
  input: { userId: string; email: string; role: FieldRoleName },
  deps: ProfileStoreDeps = {},
): Promise<ProfileRow | null> {
  const profile = await upsertProfile(
    { id: input.userId, email: input.email, role: input.role },
    deps,
  );
  await updateAuthAppMetadataRole(input.userId, input.role, deps);
  return profile;
}

async function updateAuthAppMetadataRole(
  userId: string,
  role: FieldRoleName,
  deps: ProfileStoreDeps,
): Promise<void> {
  const config =
    deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) return;
  const current = await authAdminFetch(
    config,
    `admin/users/${encodeURIComponent(userId)}`,
    { method: "GET" },
    deps.fetch,
  );
  let existing: Record<string, unknown> | null = null;
  if (current?.ok) {
    const json: unknown = await current.json().catch(() => null);
    if (json && typeof json === "object") {
      const meta = (json as { app_metadata?: unknown }).app_metadata;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        existing = meta as Record<string, unknown>;
      }
    }
  }
  const response = await authAdminFetch(
    config,
    `admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ app_metadata: mergeAppMetadataRole(existing, role) }),
    },
    deps.fetch,
  );
  if (response && !response.ok) {
    console.error("[gcfieldlog] auth app_metadata role update was not ok", {
      status: response.status,
    });
  }
}

async function restFetch(
  config: SupabaseServiceConfig,
  pathAndQuery: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(`${config.url}/rest/v1/${pathAndQuery}`, {
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
    console.error("[gcfieldlog] profiles request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function authAdminFetch(
  config: SupabaseServiceConfig,
  path: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(`${config.url}/auth/v1/${path}`, {
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
    console.error("[gcfieldlog] auth admin request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
