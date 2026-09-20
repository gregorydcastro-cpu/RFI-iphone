/**
 * Short-lived Procore OAuth cookies (state + the exact redirect_uri).
 *
 * Host-only (no Domain): apex, www, and vercel.app do not share cookies.
 * HTTPS uses SameSite=None; Secure so the cookie is stored on the 302 to
 * Procore and sent back on the top-level callback GET. Local HTTP keeps Lax.
 */

import { cookieSecureFromRequest } from "./auth.ts";
import { requestOriginForProcore } from "./procoreSecrets.ts";

export const PROCORE_OAUTH_STATE_COOKIE = "gcfieldlog_procore_oauth_state";
export const PROCORE_OAUTH_REDIRECT_COOKIE = "gcfieldlog_procore_oauth_redirect";

export const PROCORE_OAUTH_COOKIE_MAX_AGE_SEC = 60 * 10;

export type ProcoreOAuthSameSite = "lax" | "none";

export type ProcoreOAuthCookie = {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  sameSite: ProcoreOAuthSameSite;
  maxAge: number;
  secure: boolean;
};

export type ProcoreOAuthCookieStore = {
  set: (
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      path: string;
      sameSite: ProcoreOAuthSameSite;
      maxAge: number;
      secure: boolean;
    },
  ) => unknown;
};

export function oauthCookieSecureFromRequest(request: Request): boolean {
  if (cookieSecureFromRequest(request)) return true;
  const origin = requestOriginForProcore(request);
  if (!origin) return false;
  try {
    return new URL(origin).protocol === "https:";
  } catch {
    return false;
  }
}

export function oauthCookieSameSite(secure: boolean): ProcoreOAuthSameSite {
  return secure ? "none" : "lax";
}

function cookieOptions(
  name: string,
  value: string | null,
  secure: boolean,
): ProcoreOAuthCookie {
  const present = Boolean(value);
  return {
    name,
    value: value ?? "",
    httpOnly: true,
    path: "/",
    sameSite: oauthCookieSameSite(secure),
    maxAge: present ? PROCORE_OAUTH_COOKIE_MAX_AGE_SEC : 0,
    secure,
  };
}

export function oauthStateCookieOptions(
  state: string | null,
  secure: boolean,
): ProcoreOAuthCookie {
  return cookieOptions(PROCORE_OAUTH_STATE_COOKIE, state, secure);
}

export function oauthRedirectCookieOptions(
  redirectUri: string | null,
  secure: boolean,
): ProcoreOAuthCookie {
  return cookieOptions(PROCORE_OAUTH_REDIRECT_COOKIE, redirectUri, secure);
}

/** State + the exact redirect_uri sent to /oauth/authorize. Clear with null. */
export function procoreOAuthCookies(
  payload: { state: string; redirectUri: string } | null,
  secure: boolean,
): readonly [ProcoreOAuthCookie, ProcoreOAuthCookie] {
  return [
    oauthStateCookieOptions(payload?.state ?? null, secure),
    oauthRedirectCookieOptions(payload?.redirectUri ?? null, secure),
  ];
}

/** Write host-only OAuth cookies (3-arg set so Next.js attaches Set-Cookie). */
export function attachProcoreOAuthCookies(
  store: ProcoreOAuthCookieStore,
  payload: { state: string; redirectUri: string } | null,
  secure: boolean,
): void {
  for (const cookie of procoreOAuthCookies(payload, secure)) {
    store.set(cookie.name, cookie.value, {
      httpOnly: cookie.httpOnly,
      path: cookie.path,
      sameSite: cookie.sameSite,
      maxAge: cookie.maxAge,
      secure: cookie.secure,
    });
  }
}

/** Direct Set-Cookie on a 302 so the browser stores state before following Procore. */
export function appendProcoreOAuthSetCookies(
  headers: Headers,
  payload: { state: string; redirectUri: string } | null,
  secure: boolean,
): void {
  for (const cookie of procoreOAuthCookies(payload, secure)) {
    headers.append("Set-Cookie", formatProcoreOAuthSetCookie(cookie));
  }
}

export function formatProcoreOAuthSetCookie(cookie: ProcoreOAuthCookie): string {
  const parts = [
    `${cookie.name}=${cookie.value}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${cookie.maxAge}`,
    cookie.sameSite === "none" ? "SameSite=None" : "SameSite=Lax",
  ];
  if (cookie.secure) parts.push("Secure");
  return parts.join("; ");
}
