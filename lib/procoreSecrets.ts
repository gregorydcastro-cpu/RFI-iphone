/**
 * Server-only Procore OAuth credentials.
 *
 * Vercel: PROCORE_CLIENT_ID / PROCORE_CLIENT_SECRET (never NEXT_PUBLIC_).
 * Ops copy from the shared box files — never commit those values.
 *
 * Redirect URI is origin-aware so Connect on vercel.app / localhost does
 * not send Procore back to www (state cookie would not follow). This
 * allowlist is Procore-only — do not reuse Stripe or Auth host lists.
 */

import { readFileSync } from "node:fs";
import { readEnvAlias } from "./env.ts";

/** Greg’s Procore developer app allowlist (exact default). */
export const DEFAULT_PROCORE_REDIRECT_URI =
  "https://www.gcfieldlog.com/api/procore/callback";

export const PROCORE_CALLBACK_PATH = "/api/procore/callback";

/**
 * Hosts that may build `${origin}/api/procore/callback` from the request.
 * Exact hosts only — not every `*.vercel.app` preview.
 * `gcfieldlog.vercel.app` is included when that production alias is attached.
 */
export const PROCORE_REDIRECT_HOST_ALLOWLIST = [
  "www.gcfieldlog.com",
  "gcfieldlog.com",
  "gcfieldlog.vercel.app",
  "gc-field-log.vercel.app",
  "localhost:3000",
] as const;

const BOX_CLIENT_ID_PATH = "/home/box/.secrets/procore_client_id";
const BOX_CLIENT_SECRET_PATH = "/home/box/.secrets/procore_client_secret";

function firstForwarded(value: string | null | undefined): string {
  return value?.split(",")[0]?.trim() ?? "";
}

export function readProcoreClientId(): string | undefined {
  return (
    readEnvAlias("PROCORE_CLIENT_ID", "procore_client_id") ??
    readSecretFile(BOX_CLIENT_ID_PATH)
  );
}

export function readProcoreClientSecret(): string | undefined {
  return (
    readEnvAlias("PROCORE_CLIENT_SECRET", "procore_client_secret") ??
    readSecretFile(BOX_CLIENT_SECRET_PATH)
  );
}

/** Explicit env override, or undefined so origin allowlist / default can run. */
export function readProcoreRedirectUriOverride(): string | undefined {
  return readEnvAlias("PROCORE_REDIRECT_URI", "procore_redirect_uri");
}

/** Env override or the www default. Used when no request origin is available. */
export function readProcoreRedirectUri(): string {
  return readProcoreRedirectUriOverride() ?? DEFAULT_PROCORE_REDIRECT_URI;
}

export function isAllowlistedProcoreRedirectHost(
  host: string | null | undefined,
): boolean {
  const normalized = host?.trim().toLowerCase().replace(/\.$/, "") ?? "";
  if (!normalized) return false;
  return (PROCORE_REDIRECT_HOST_ALLOWLIST as readonly string[]).includes(
    normalized,
  );
}

/**
 * Origin for Procore `redirect_uri` (scheme + host[:port]).
 * Uses x-forwarded-* when present so Vercel matches the browser host.
 */
export function requestOriginForProcore(request: Request): string | null {
  try {
    const url = new URL(request.url);
    const host = firstForwarded(request.headers.get("x-forwarded-host")) || url.host;
    const proto =
      firstForwarded(request.headers.get("x-forwarded-proto")) ||
      url.protocol.replace(/:$/, "");
    if (!host || !proto) return url.origin || null;
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

/**
 * Authorize + token exchange must share this URI byte-for-byte.
 *
 * 1. If `PROCORE_REDIRECT_URI` is set and its host matches this request,
 *    send that exact env string (same-host pin / tunnel).
 * 2. Else `${requestOrigin}/api/procore/callback` when the host is allowlisted.
 *    A www-only env value must not override vercel.app / apex — that is the
 *    live Vercel failure (state cookie on one host, Procore returns to another,
 *    then token exchange rejects the mismatched redirect_uri).
 * 3. Else env when there is no request origin, else www default.
 */
export function resolveProcoreRedirectUri(
  requestOrigin?: string | null,
): string {
  const override = readProcoreRedirectUriOverride();
  const requestHost = hostKey(requestOrigin);
  const overrideHost = hostKey(override);

  if (override && requestHost && overrideHost === requestHost) {
    return override;
  }

  if (requestOrigin) {
    try {
      const url = new URL(requestOrigin);
      if (isAllowlistedProcoreRedirectHost(url.host)) {
        return `${url.origin}${PROCORE_CALLBACK_PATH}`;
      }
    } catch {
      /* fall through */
    }
  }

  if (override && !requestHost) return override;
  return DEFAULT_PROCORE_REDIRECT_URI;
}

export function resolveProcoreRedirectUriFromRequest(request: Request): string {
  return resolveProcoreRedirectUri(requestOriginForProcore(request));
}

/** Cookie / stored URI must be the env override, default, or an allowlisted callback. */
export function isTrustedProcoreRedirectUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  const override = readProcoreRedirectUriOverride();
  if (override && uri === override) return true;
  try {
    const url = new URL(uri);
    if (url.pathname !== PROCORE_CALLBACK_PATH) return false;
    if (url.search || url.hash) return false;
    if (`${url.origin}${url.pathname}` === DEFAULT_PROCORE_REDIRECT_URI) {
      return true;
    }
    return isAllowlistedProcoreRedirectHost(url.host);
  } catch {
    return false;
  }
}

/** Prefer the cookie from authorize; otherwise rebuild from this request. */
export function redirectUriForTokenExchange(
  storedRedirectUri: string | null | undefined,
  request: Request,
): string {
  if (storedRedirectUri && isTrustedProcoreRedirectUri(storedRedirectUri)) {
    return storedRedirectUri;
  }
  return resolveProcoreRedirectUriFromRequest(request);
}

/** Exact URIs Greg must register on the Procore developer app. */
export function procoreRedirectUrisToRegister(): string[] {
  return [
    "https://www.gcfieldlog.com/api/procore/callback",
    "https://gcfieldlog.com/api/procore/callback",
    "https://gcfieldlog.vercel.app/api/procore/callback",
    "https://gc-field-log.vercel.app/api/procore/callback",
    "http://localhost:3000/api/procore/callback",
  ];
}

function hostKey(originOrUri: string | null | undefined): string | null {
  if (!originOrUri) return null;
  try {
    return new URL(originOrUri).host.toLowerCase().replace(/\.$/, "") || null;
  } catch {
    return null;
  }
}

function readSecretFile(path: string): string | undefined {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
