/**
 * Server-only Procore OAuth (authorization code).
 *
 * Developer sandbox (default): login-sandbox.procore.com
 * Production / on-demand sandbox: login.procore.com
 *
 * Never log client_secret, authorization codes, or tokens.
 */

import { readEnvAlias } from "./env";
import {
  readProcoreClientId,
  readProcoreClientSecret,
  readProcoreRedirectUri,
} from "./procoreSecrets";

export const PROCORE_OAUTH_STATE_COOKIE = "gcfieldlog_procore_oauth_state";

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

export function getProcoreOAuthConfig(): ProcoreOAuthConfig | null {
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
    redirectUri: readProcoreRedirectUri(),
  };
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

export function oauthStateCookieOptions(
  state: string | null,
  secure: boolean,
): {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    name: PROCORE_OAUTH_STATE_COOKIE,
    value: state ?? "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: state ? 60 * 10 : 0,
    secure,
  };
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
    redirect_uri: config.redirectUri,
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

export async function procoreApiGet(
  config: ProcoreOAuthConfig,
  accessToken: string,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<unknown> {
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
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function readProcoreId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    return readProcoreId((value as { id: unknown }).id);
  }
  return null;
}
