/**
 * Diagnose SUPABASE_SERVICE_ROLE_KEY without ever returning or logging the key.
 * Accepts service_role JWTs and sb_secret_…; rejects anon / sb_publishable_… / bad ref.
 * @see https://supabase.com/docs/guides/getting-started/api-keys
 */

export type SupabaseKeyKind =
  | "missing"
  | "secret"
  | "publishable"
  | "service_role_jwt"
  | "anon_jwt"
  | "other_jwt"
  | "malformed"
  | "not_jwt";

export type SupabaseKeyCheckResult = {
  ok: boolean;
  kind: SupabaseKeyKind;
  role: string | null;
  /** null when no JWT ref or no expected ref. */

  projectRefMatches: boolean | null;
  message: string;
};

/** Hostname prefix before `.supabase.co`. */

export function projectRefFromSupabaseUrl(
  url: string | undefined | null,
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Pure check. Never returns the key value — only length/prefix-type hints
 * in the human message when useful.
 */

export function checkSupabaseServiceRoleKey(
  key: string | undefined | null,
  expectedProjectRef?: string | null,
): SupabaseKeyCheckResult {
  const trimmed = typeof key === "string" ? key.trim() : "";
  if (!trimmed) {
    return {
      ok: false,
      kind: "missing",
      role: null,
      projectRefMatches: null,
      message:
        "SUPABASE_SERVICE_ROLE_KEY is missing. Set it to the service_role (or sb_secret_…) key from Supabase → Settings → API Keys.",
    };
  }

  if (trimmed.startsWith("sb_secret_")) {
    return {
      ok: true,
      kind: "secret",
      role: null,
      projectRefMatches: null,
      message:
        "Key looks like a Supabase secret key (sb_secret_…). OK for server-side writes.",
    };
  }

  if (trimmed.startsWith("sb_publishable_")) {
    return {
      ok: false,
      kind: "publishable",
      role: null,
      projectRefMatches: null,
      message:
        "SUPABASE_SERVICE_ROLE_KEY holds a publishable key (sb_publishable_…). That is the wrong key — paste the secret / service_role key instead.",
    };
  }

  const parts = trimmed.split(".");
  if (parts.length !== 3 || !parts[1]) {
    return {
      ok: false,
      kind: "not_jwt",
      role: null,
      projectRefMatches: null,
      message: `SUPABASE_SERVICE_ROLE_KEY is not a JWT and not sb_secret_… (length ${trimmed.length}). Paste the service_role or secret key from Supabase → Settings → API Keys.`,
    };
  }

  const payload = decodeJwtPayload(trimmed);
  if (!payload) {
    return {
      ok: false,
      kind: "malformed",
      role: null,
      projectRefMatches: null,
      message:
        "SUPABASE_SERVICE_ROLE_KEY looks like a JWT but the middle segment could not be decoded. Check for truncation or copy/paste errors.",
    };
  }

  const role = typeof payload.role === "string" ? payload.role : null;
  const keyRef = typeof payload.ref === "string" ? payload.ref : null;
  const expected =
    typeof expectedProjectRef === "string" && expectedProjectRef.trim()
      ? expectedProjectRef.trim()
      : null;
  const projectRefMatches =
    expected && keyRef ? keyRef === expected : expected && !keyRef ? false : null;

  if (role === "service_role") {
    if (expected && keyRef && keyRef !== expected) {
      return {
        ok: false,
        kind: "service_role_jwt",
        role,
        projectRefMatches: false,
        message: `JWT role is service_role, but its project ref does not match SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL (expected ${expected}).`,
      };
    }
    return {
      ok: true,
      kind: "service_role_jwt",
      role,
      projectRefMatches: expected && keyRef ? true : null,
      message: "JWT role is service_role. OK for server-side writes.",
    };
  }

  if (role === "anon") {
    return {
      ok: false,
      kind: "anon_jwt",
      role,
      projectRefMatches,
      message:
        'SUPABASE_SERVICE_ROLE_KEY is the anon key (JWT role "anon"). Paste the service_role secret (or sb_secret_…) instead — anon cannot write Procore tokens.',
    };
  }

  return {
    ok: false,
    kind: "other_jwt",
    role,
    projectRefMatches,
    message: role
      ? `SUPABASE_SERVICE_ROLE_KEY JWT role is "${role}", not "service_role". Paste the service_role or secret key.`
      : "SUPABASE_SERVICE_ROLE_KEY JWT has no role claim. Paste the service_role or secret key from Supabase → Settings → API Keys.",
  };
}

/** Decode compact JWT payload (base64url middle segment). No signature verify. */

export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
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

/** JWT `role` claim only. Never logs the token. */

export function jwtRoleClaim(token: string): string | null {
  const payload = decodeJwtPayload(token);
  return typeof payload?.role === "string" ? payload.role : null;
}

/** Read expected project ref from URL env (prefer NEXT_PUBLIC_SUPABASE_URL). */

export function expectedSupabaseProjectRefFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const url =
    nonempty(env.NEXT_PUBLIC_SUPABASE_URL) ??
    nonempty(env.SUPABASE_URL) ??
    nonempty(env.supabase_url);
  return projectRefFromSupabaseUrl(url);
}

/** Check process.env.SUPABASE_SERVICE_ROLE_KEY (and lowercase alias). */

export function checkSupabaseServiceRoleKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseKeyCheckResult {
  const key =
    nonempty(env.SUPABASE_SERVICE_ROLE_KEY) ??
    nonempty(env.supabase_service_role_key);
  return checkSupabaseServiceRoleKey(key, expectedSupabaseProjectRefFromEnv(env));
}

function nonempty(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
