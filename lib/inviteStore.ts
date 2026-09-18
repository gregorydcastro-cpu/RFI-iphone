/**
 * Service-role CRUD for public.invite_tokens.
 *
 * Stub session ids (`stub:` + sha256 email) are not auth.uid(), so mint
 * and redeem use SUPABASE_SERVICE_ROLE_KEY. Anon has no grants.
 * Local / unset service role: process-memory fallback (same pattern as
 * share folders / Time). Never NEXT_PUBLIC_ the service role key.
 */

import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections";
import { INVITE_TOKENS_TABLE, type InviteTokenRow } from "./schema";
import {
  asInviteTokenRow,
  inviteStatus,
  latestRedeemedInviteRole,
  mintInviteRecord,
  normalizeInviteeEmail,
  redeemInviteRecord,
  type InviteRole,
  type InviteStatus,
} from "./invites";

const FETCH_TIMEOUT_MS = 8_000;

export type InviteStorage = "supabase" | "memory";

export type InvitePreview = {
  status: InviteStatus;
  role: InviteRole | null;
  inviteeEmail: string | null;
  expiresAt: string | null;
  usedAt: string | null;
  storage: InviteStorage;
};

export type InviteStoreDeps = {
  fetch?: typeof fetch;
  now?: () => Date;
  memory?: InviteTokenRow[];
  supabase?: SupabaseServiceConfig | null;
  randomToken?: () => string;
};

const g = globalThis as typeof globalThis & {
  __gcFieldLogInvites?: InviteTokenRow[];
};

export function inviteMemory(): InviteTokenRow[] {
  if (!g.__gcFieldLogInvites) {
    g.__gcFieldLogInvites = [];
  }
  return g.__gcFieldLogInvites;
}

export function resetInviteMemoryForTests(): void {
  g.__gcFieldLogInvites = [];
}

export function isInviteTableWriteConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export async function mintInvite(
  input: {
    role: InviteRole;
    createdBy: string;
    inviteeEmail?: string | null;
    expiresAt?: string | null;
    expiresInMs?: number | null;
  },
  deps: InviteStoreDeps = {},
): Promise<{ row: InviteTokenRow; storage: InviteStorage } | null> {
  const now = deps.now?.() ?? new Date();
  const row = mintInviteRecord({
    role: input.role,
    createdBy: input.createdBy,
    inviteeEmail: input.inviteeEmail,
    expiresAt: input.expiresAt,
    expiresInMs: input.expiresInMs,
    token: deps.randomToken?.(),
    now,
  });

  const config = deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) {
    const memory = deps.memory ?? inviteMemory();
    memory.push(row);
    return { row, storage: "memory" };
  }

  const persisted = await insertInviteRow(config, row, deps.fetch);
  if (!persisted) return null;
  return { row: persisted, storage: "supabase" };
}

export async function previewInvite(
  token: string,
  deps: InviteStoreDeps = {},
): Promise<InvitePreview> {
  const now = deps.now?.() ?? new Date();
  const found = await findInviteByToken(token, deps);
  const storage: InviteStorage = found.storage;
  const status = inviteStatus(found.row, now);
  return {
    status,
    role: found.row?.role ?? null,
    inviteeEmail: found.row?.invitee_email ?? null,
    expiresAt: found.row?.expires_at ?? null,
    usedAt: found.row?.used_at ?? null,
    storage,
  };
}

export async function redeemInvite(
  input: { token: string; email: string },
  deps: InviteStoreDeps = {},
): Promise<
  | { ok: true; row: InviteTokenRow; storage: InviteStorage }
  | { ok: false; status: InviteStatus | "email_mismatch"; storage: InviteStorage }
> {
  const now = deps.now?.() ?? new Date();
  const found = await findInviteByToken(input.token, deps);
  const redeemed = redeemInviteRecord({
    row: found.row,
    email: input.email,
    now,
  });
  if (!redeemed.ok) {
    return { ok: false, status: redeemed.status, storage: found.storage };
  }
  const next = redeemed.row;

  const config = deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) {
    const memory = deps.memory ?? inviteMemory();
    const index = memory.findIndex((row) => row.token === input.token && !row.used_at);
    if (index < 0) {
      return { ok: false, status: "used", storage: "memory" };
    }
    memory[index] = next;
    return { ok: true, row: next, storage: "memory" };
  }

  const persisted = await markInviteUsed(config, input.token, next, deps.fetch);
  if (!persisted) {
    return { ok: false, status: "used", storage: "supabase" };
  }
  return { ok: true, row: persisted, storage: "supabase" };
}

export async function fieldRoleFromRedeemedEmail(
  email: string,
  deps: InviteStoreDeps = {},
): Promise<InviteRole | null> {
  const rows = await listUsedInvitesByEmail(email, deps);
  return latestRedeemedInviteRole(rows, email);
}

async function findInviteByToken(
  token: string,
  deps: InviteStoreDeps,
): Promise<{ row: InviteTokenRow | null; storage: InviteStorage }> {
  const config = deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) {
    const memory = deps.memory ?? inviteMemory();
    return {
      row: memory.find((row) => row.token === token) ?? null,
      storage: "memory",
    };
  }
  const row = await selectInviteByToken(config, token, deps.fetch);
  return { row, storage: "supabase" };
}

async function listUsedInvitesByEmail(
  email: string,
  deps: InviteStoreDeps,
): Promise<InviteTokenRow[]> {
  const normalized = normalizeInviteeEmail(email);
  if (!normalized) return [];
  const config = deps.supabase === undefined ? getSupabaseServiceConfig() : deps.supabase;
  if (!config) {
    const memory = deps.memory ?? inviteMemory();
    return memory.filter((row) => row.invitee_email === normalized && row.used_at);
  }
  return selectUsedInvitesByEmail(config, normalized, deps.fetch);
}

async function insertInviteRow(
  config: SupabaseServiceConfig,
  row: InviteTokenRow,
  fetchImpl?: typeof fetch,
): Promise<InviteTokenRow | null> {
  const response = await restFetch(
    config,
    INVITE_TOKENS_TABLE,
    {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    },
    fetchImpl,
  );
  if (!response || !response.ok) {
    if (response && !response.ok) {
      console.error("[gcfieldlog] invite_tokens insert was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const parsed = asInviteTokenRow(Array.isArray(json) ? json[0] : json);
  return parsed ?? row;
}

async function selectInviteByToken(
  config: SupabaseServiceConfig,
  token: string,
  fetchImpl?: typeof fetch,
): Promise<InviteTokenRow | null> {
  const params = new URLSearchParams();
  params.set("token", `eq.${token}`);
  params.set(
    "select",
    "id,token,role,created_by,invitee_email,expires_at,used_at,created_at",
  );
  params.set("limit", "1");
  const response = await restFetch(
    config,
    `${INVITE_TOKENS_TABLE}?${params.toString()}`,
    { method: "GET" },
    fetchImpl,
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asInviteTokenRow(row);
}

async function selectUsedInvitesByEmail(
  config: SupabaseServiceConfig,
  email: string,
  fetchImpl?: typeof fetch,
): Promise<InviteTokenRow[]> {
  const params = new URLSearchParams();
  params.set("invitee_email", `eq.${email}`);
  params.set("used_at", "not.is.null");
  params.set(
    "select",
    "id,token,role,created_by,invitee_email,expires_at,used_at,created_at",
  );
  params.set("order", "used_at.desc");
  const response = await restFetch(
    config,
    `${INVITE_TOKENS_TABLE}?${params.toString()}`,
    { method: "GET" },
    fetchImpl,
  );
  if (!response || !response.ok) return [];
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return [];
  return json.flatMap((row) => {
    const parsed = asInviteTokenRow(row);
    return parsed ? [parsed] : [];
  });
}

async function markInviteUsed(
  config: SupabaseServiceConfig,
  token: string,
  next: InviteTokenRow,
  fetchImpl?: typeof fetch,
): Promise<InviteTokenRow | null> {
  const params = new URLSearchParams();
  params.set("token", `eq.${token}`);
  params.set("used_at", "is.null");
  const response = await restFetch(
    config,
    `${INVITE_TOKENS_TABLE}?${params.toString()}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        used_at: next.used_at,
        invitee_email: next.invitee_email,
      }),
    },
    fetchImpl,
  );
  if (!response || !response.ok) {
    if (response && !response.ok) {
      console.error("[gcfieldlog] invite_tokens redeem was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  if (!row) return null;
  return asInviteTokenRow(row) ?? next;
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
    console.error("[gcfieldlog] invite_tokens request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
