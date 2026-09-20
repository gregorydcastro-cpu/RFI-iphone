/**
 * Server-only Procore OAuth credentials.
 *
 * Vercel: PROCORE_CLIENT_ID / PROCORE_CLIENT_SECRET (never NEXT_PUBLIC_).
 * Ops copy from the shared box files — never commit those values.
 *
 * Portal redirect_uri is fixed (Greg already registered it):
 *   https://www.gcfieldlog.com/api/procore/callback
 * Connect on vercel.app / apex 302s to that www origin first so the
 * httpOnly state cookie is set on www before Procore authorize. www+apex
 * also set Domain=gcfieldlog.com. Never Domain on vercel.app hosts.
 */

import { readFileSync } from "node:fs";
import { readEnvAlias } from "./env.ts";

/** Exact string registered in the Procore Developer Portal. No trailing slash. */
export const DEFAULT_PROCORE_REDIRECT_URI =
  "https://www.gcfieldlog.com/api/procore/callback";

export const PROCORE_CALLBACK_PATH = "/api/procore/callback";
export const PROCORE_CONNECT_PATH = "/api/procore/connect";

export const PROCORE_COOKIE_DOMAIN = "gcfieldlog.com";

/**
 * Live hosts that may start Connect. Other hosts still bounce to www
 * because the portal URI is fixed.
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

/** Optional env pin. Authorize still sends the portal www URI unless env equals it. */
export function readProcoreRedirectUriOverride(): string | undefined {
  return readEnvAlias("PROCORE_REDIRECT_URI", "procore_redirect_uri");
}

/** Always the portal URI (env only if it is that exact string). */
export function readProcoreRedirectUri(): string {
  const override = canonicalizePortalRedirectUri(readProcoreRedirectUriOverride());
  return override ?? DEFAULT_PROCORE_REDIRECT_URI;
}

export function isAllowlistedProcoreRedirectHost(
  host: string | null | undefined,
): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return (PROCORE_REDIRECT_HOST_ALLOWLIST as readonly string[]).includes(
    normalized,
  );
}

/**
 * Origin for comparing Connect host vs redirect_uri host.
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

export function requestHostForProcore(request: Request): string {
  const origin = requestOriginForProcore(request);
  if (!origin) return "";
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

/**
 * Domain attribute for OAuth state cookies.
 * www + apex share Domain=gcfieldlog.com (no leading dot).
 * vercel.app must stay host-only — browsers reject Domain=gcfieldlog.com there.
 */
export function oauthCookieDomainForHost(
  host: string | null | undefined,
): string | undefined {
  const hostname = normalizeHost(host).split(":")[0] ?? "";
  if (hostname === "www.gcfieldlog.com" || hostname === "gcfieldlog.com") {
    return PROCORE_COOKIE_DOMAIN;
  }
  return undefined;
}

export function oauthCookieDomainFromRequest(request: Request): string | undefined {
  return oauthCookieDomainForHost(requestHostForProcore(request));
}

/**
 * Authorize + token exchange always send this exact portal string.
 * Request origin is ignored so vercel.app Connect cannot advertise a
 * callback that Procore has not registered.
 */
export function resolveProcoreRedirectUri(
  requestOrigin?: string | null,
): string {
  void requestOrigin;
  return readProcoreRedirectUri();
}

export function resolveProcoreRedirectUriFromRequest(request: Request): string {
  void request;
  return readProcoreRedirectUri();
}

/**
 * If Connect started on a host other than the portal callback host, 302
 * to www `/api/procore/connect` first so the state cookie is set there.
 * Destination is always the portal origin — never a reflected Host header.
 */
export function procoreConnectBounceUrl(
  request: Request,
  redirectUri: string = readProcoreRedirectUri(),
): string | null {
  const portal = canonicalizePortalRedirectUri(redirectUri) ?? readProcoreRedirectUri();
  let portalHost = "";
  let portalOrigin = "";
  try {
    const url = new URL(portal);
    portalHost = normalizeHost(url.host);
    portalOrigin = url.origin;
  } catch {
    return null;
  }
  const currentHost = normalizeHost(requestHostForProcore(request));
  if (!currentHost || currentHost === portalHost) return null;
  return `${portalOrigin}${PROCORE_CONNECT_PATH}`;
}

export function isTrustedProcoreRedirectUri(uri: string | null | undefined): boolean {
  return canonicalizePortalRedirectUri(uri) === DEFAULT_PROCORE_REDIRECT_URI;
}

/** Prefer the cookie from authorize when it is the portal URI. */
export function redirectUriForTokenExchange(
  storedRedirectUri: string | null | undefined,
  request?: Request,
): string {
  void request;
  if (storedRedirectUri && isTrustedProcoreRedirectUri(storedRedirectUri)) {
    return storedRedirectUri;
  }
  return readProcoreRedirectUri();
}

/** Exact URI Greg registered — do not add hosts. */
export function procoreRedirectUrisToRegister(): string[] {
  return [DEFAULT_PROCORE_REDIRECT_URI];
}

function canonicalizePortalRedirectUri(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:") return null;
    if (url.search || url.hash) return null;
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (path !== PROCORE_CALLBACK_PATH) return null;
    const host = normalizeHost(url.host).split(":")[0] ?? "";
    if (host !== "www.gcfieldlog.com") return null;
    return DEFAULT_PROCORE_REDIRECT_URI;
  } catch {
    return null;
  }
}

function normalizeHost(host: string | null | undefined): string {
  return host?.trim().toLowerCase().replace(/\.$/, "") ?? "";
}

function readSecretFile(path: string): string | undefined {
  try {
    const value = readFileSync(path, "utf8").trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}
