/**
 * Server-only Procore OAuth (authorization code).
 *
 * Developer sandbox (default): login-sandbox.procore.com
 * Production / on-demand sandbox: login.procore.com
 *
 * Never log client_secret, authorization codes, or tokens.
 */

import { readEnvAlias } from "./env";
import { readProcoreId } from "./procoreProjectMatch";
import {
  isTrustedProcoreRedirectUri,
  oauthCookieDomainFromRequest,
  readProcoreClientId,
  readProcoreClientSecret,
  readProcoreRedirectUri,
  resolveProcoreRedirectUriFromRequest,
} from "./procoreSecrets";

export { readProcoreId };
export {
  DEFAULT_PROCORE_REDIRECT_URI,
  PROCORE_CALLBACK_PATH,
  PROCORE_CONNECT_PATH,
  PROCORE_COOKIE_DOMAIN,
  PROCORE_REDIRECT_HOST_ALLOWLIST,
  isAllowlistedProcoreRedirectHost,
  isTrustedProcoreRedirectUri,
  oauthCookieDomainForHost,
  oauthCookieDomainFromRequest,
  procoreConnectBounceUrl,
  procoreRedirectUrisToRegister,
  redirectUriForTokenExchange,
  requestHostForProcore,
  requestOriginForProcore,
  resolveProcoreRedirectUri,
  resolveProcoreRedirectUriFromRequest,
} from "./procoreSecrets";

export const PROCORE_OAUTH_STATE_COOKIE = "gcfieldlog_procore_oauth_state";
export const PROCORE_OAUTH_REDIRECT_COOKIE = "gcfieldlog_procore_oauth_redirect";

export type ProcoreOAuthConfigOptions = {
  request?: Request;
  /** Exact redirect_uri from the authorize step (cookie) when exchanging. */
  redirectUri?: string;
};

export type ProcoreOAuthConfig = {
  clientId: string;
  clientSecret: string;
  loginBase: string;
  apiBase: string;
  redirectUri: string;
};

export type ProcoreTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  created_at?: number;
};

const TOKEN_TIMEOUT_MS = 12_000;

export function getProcoreOAuthConfig(
  options?: ProcoreOAuthConfigOptions,
): ProcoreOAuthConfig | null {
  const clientId = readProcoreClientId();
  const clientSecret = readProcoreClientSecret();
  if (!clientId || !clientSecret) return null;

  const loginBase = stripSlash(
    readEnvAlias(
      "PROCORE_OAUTH_BASE",
      "procore_oauth_base",
      "PROCORE_LOGIN_URL",
      "procore_login_url",
    ) ?? "https://login-sandbox.procore.com",
  );
  const apiBase = stripSlash(
    readEnvAlias("PROCORE_API_BASE", "procore_api_base") ??
      defaultApiBase(loginBase),
  );

  return {
    clientId,
    clientSecret,
    loginBase,
    apiBase,
    redirectUri: resolveOAuthRedirectUri(options),
  };
}

function resolveOAuthRedirectUri(options?: ProcoreOAuthConfigOptions): string {
  if (options?.redirectUri && isTrustedProcoreRedirectUri(options.redirectUri)) {
    return options.redirectUri;
  }
  if (options?.request) {
    return resolveProcoreRedirectUriFromRequest(options.request);
  }
  return readProcoreRedirectUri();
}

export function isProcoreOAuthConfigured(): boolean {
  return Boolean(readProcoreClientId() && readProcoreClientSecret());
}

export function buildAuthorizeUrl(
  config: ProcoreOAuthConfig,
  state: string,
): string {
  const url = new URL(`${config.loginBase}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

type ProcoreOAuthCookie = {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
  domain?: string;
};

/**
 * SameSite=Lax so the top-level GET from Procore includes the cookie.
 * Secure on https. Domain=gcfieldlog.com only on www/apex so apex and www
 * share the cookie. vercel.app stays host-only (bounce to www first).
 */
export function oauthStateCookieOptions(
  state: string | null,
  secure: boolean,
  domain?: string,
): ProcoreOAuthCookie {
  return {
    name: PROCORE_OAUTH_STATE_COOKIE,
    value: state ?? "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: state ? 60 * 10 : 0,
    secure,
    ...(domain ? { domain } : {}),
  };
}

export function oauthRedirectCookieOptions(
  redirectUri: string | null,
  secure: boolean,
  domain?: string,
): ProcoreOAuthCookie {
  return {
    name: PROCORE_OAUTH_REDIRECT_COOKIE,
    value: redirectUri ?? "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: redirectUri ? 60 * 10 : 0,
    secure,
    ...(domain ? { domain } : {}),
  };
}

/** State + the exact redirect_uri sent to /oauth/authorize. Clear with null. */
export function procoreOAuthCookies(
  payload: { state: string; redirectUri: string } | null,
  secure: boolean,
  request?: Request,
): readonly [ProcoreOAuthCookie, ProcoreOAuthCookie] {
  const domain = request ? oauthCookieDomainFromRequest(request) : undefined;
  return [
    oauthStateCookieOptions(payload?.state ?? null, secure, domain),
    oauthRedirectCookieOptions(payload?.redirectUri ?? null, secure, domain),
  ];
}

export async function exchangeAuthorizationCode(
  config: ProcoreOAuthConfig,
  code: string,
): Promise<ProcoreTokenResponse | null> {
  return postToken(config, {
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });
}

export async function refreshAccessToken(
  config: ProcoreOAuthConfig,
  refreshToken: string,
): Promise<ProcoreTokenResponse | null> {
  return postToken(config, {
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}

export async function revokeAccessToken(
  config: ProcoreOAuthConfig,
  token: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    await fetch(`${config.loginBase}/oauth/revoke`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        token,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] procore token revoke failed", { aborted });
  } finally {
    clearTimeout(timer);
  }
}

export function expiresAtFromToken(token: ProcoreTokenResponse): string | null {
  if (typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in)) {
    return null;
  }
  const createdMs =
    typeof token.created_at === "number" && Number.isFinite(token.created_at)
      ? token.created_at * 1000
      : Date.now();
  return new Date(createdMs + token.expires_in * 1000).toISOString();
}

export async function fetchProcoreAccount(
  config: ProcoreOAuthConfig,
  accessToken: string,
): Promise<{ lastCompanyId: string | null; procoreUserId: string | null }> {
  const me = await procoreApiGet(config, accessToken, "/rest/v1.0/me");
  const procoreUserId = readProcoreId(me);
  let lastCompanyId: string | null = null;
  if (me && typeof me === "object") {
    const record = me as Record<string, unknown>;
    lastCompanyId = readProcoreId(record.company) ?? readProcoreId(record.company_id);
  }
  return { lastCompanyId, procoreUserId };
}

function defaultApiBase(loginBase: string): string {
  if (loginBase.includes("login-sandbox-monthly")) {
    return "https://api-monthly.procore.com";
  }
  if (loginBase.includes("login-sandbox")) {
    return "https://sandbox.procore.com";
  }
  return "https://api.procore.com";
}

function stripSlash(value: string): string {
  return value.replace(/\/$/, "");
}

async function postToken(
  config: ProcoreOAuthConfig,
  body: Record<string, string>,
): Promise<ProcoreTokenResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.loginBase}/oauth/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("[gcfieldlog] procore token request was not ok", {
        status: response.status,
      });
      return null;
    }
    const json: unknown = await response.json().catch(() => null);
    if (!json || typeof json !== "object") return null;
    const record = json as Record<string, unknown>;
    if (typeof record.access_token !== "string" || !record.access_token) {
      return null;
    }
    return {
      access_token: record.access_token,
      token_type:
        typeof record.token_type === "string" ? record.token_type : undefined,
      expires_in:
        typeof record.expires_in === "number" ? record.expires_in : undefined,
      refresh_token:
        typeof record.refresh_token === "string"
          ? record.refresh_token
          : undefined,
      created_at:
        typeof record.created_at === "number" ? record.created_at : undefined,
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] procore token request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type ProcoreApiResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

export async function procoreApiRequest(
  config: ProcoreOAuthConfig,
  accessToken: string,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<ProcoreApiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.apiBase}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...extraHeaders,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function procoreApiGet(
  config: ProcoreOAuthConfig,
  accessToken: string,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
  const result = await procoreApiRequest(config, accessToken, path, extraHeaders);
  return result.ok ? result.body : null;
}
