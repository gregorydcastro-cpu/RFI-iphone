/**
 * Production Auth hosts for GC Field Log.
 *
 * Sign-in starts when publishable Supabase keys are in env. Host is not a
 * substitute for keys, and an unknown Host must not hide keys that exist.
 * This list is the allowlist for magic-link / confirm-email redirect
 * origins (`emailRedirectTo`) so vercel.app aliases and custom domains
 * share Auth. Hostnames only — never secrets.
 */

export const DEFAULT_AUTH_ORIGIN = "https://www.gcfieldlog.com";
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Live custom domains + Vercel production aliases that should run Auth. */
export const PRODUCTION_AUTH_HOSTS = [
  "www.gcfieldlog.com",
  "gcfieldlog.com",
  "gcfieldlog.vercel.app",
  "gc-field-log.vercel.app",
] as const;

export type ProductionAuthHost = (typeof PRODUCTION_AUTH_HOSTS)[number];

function firstForwarded(value: string | null | undefined): string {
  return value?.split(",")[0]?.trim() ?? "";
}

/** Hostname without port, lowercased. `www.gcfieldlog.com:443` → `www.gcfieldlog.com`. */
export function normalizeAuthHostname(host: string | null | undefined): string {
  const raw = firstForwarded(host).toLowerCase().replace(/\.$/, "");
  if (!raw) return "";
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    return end > 0 ? raw.slice(1, end).toLowerCase() : raw;
  }
  return raw.split(":")[0] ?? "";
}

export function isLocalAuthHost(hostname: string): boolean {
  const host = normalizeAuthHostname(hostname);
  return host === "localhost" || host === "127.0.0.1";
}

export function isVercelAuthHost(hostname: string): boolean {
  const host = normalizeAuthHostname(hostname);
  return host === "vercel.app" || host.endsWith(".vercel.app");
}

export function isProductionAuthHost(hostname: string): boolean {
  const host = normalizeAuthHostname(hostname);
  return (PRODUCTION_AUTH_HOSTS as readonly string[]).includes(host);
}

/**
 * Hosts that may be used as the public origin for Auth redirects.
 * Production custom domains, Vercel aliases (including previews), and
 * local dev. Arbitrary Host headers are rejected.
 */
export function isAllowedAuthHost(hostname: string): boolean {
  const host = normalizeAuthHostname(hostname);
  if (!host) return false;
  return isProductionAuthHost(host) || isLocalAuthHost(host) || isVercelAuthHost(host);
}

export function requestAuthHost(request: Request): string {
  const url = new URL(request.url);
  const forwarded = firstForwarded(request.headers.get("x-forwarded-host"));
  return forwarded || url.host;
}

/**
 * Public origin for magic-link / confirm-email `emailRedirectTo`.
 * Allowed production + vercel.app + localhost keep the incoming host so
 * the crew lands back on the same site. Unknown hosts fall back to www.
 */
export function authAppOrigin(request: Request): string {
  try {
    const url = new URL(request.url);
    const host = requestAuthHost(request);
    const hostname = normalizeAuthHostname(host);
    const proto =
      firstForwarded(request.headers.get("x-forwarded-proto")) ||
      url.protocol.replace(/:$/, "") ||
      "https";
    if (!hostname || !isAllowedAuthHost(hostname)) {
      return DEFAULT_AUTH_ORIGIN;
    }
    return `${proto}://${host}`;
  } catch {
    return DEFAULT_AUTH_ORIGIN;
  }
}

export function authCallbackUrl(origin: string, nextPath = "/jobs"): string {
  const base = origin.replace(/\/$/, "") || DEFAULT_AUTH_ORIGIN;
  const next = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/jobs";
  return `${base}${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
}

/** Values Greg must paste into Supabase Auth → URL Configuration → Redirect URLs. */
export function supabaseAuthRedirectUrls(): string[] {
  return [
    "https://www.gcfieldlog.com/auth/callback",
    "https://www.gcfieldlog.com/**",
    "https://gcfieldlog.com/auth/callback",
    "https://gcfieldlog.com/**",
    "https://gcfieldlog.vercel.app/auth/callback",
    "https://gcfieldlog.vercel.app/**",
    "https://gc-field-log.vercel.app/auth/callback",
    "https://gc-field-log.vercel.app/**",
    "http://localhost:3000/auth/callback",
  ];
}
