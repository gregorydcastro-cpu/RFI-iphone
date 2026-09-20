import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PROCORE_OAUTH_REDIRECT_COOKIE,
  PROCORE_OAUTH_STATE_COOKIE,
  attachProcoreOAuthCookies,
  appendProcoreOAuthSetCookies,
  formatProcoreOAuthSetCookie,
  oauthCookieSameSite,
  oauthCookieSecureFromRequest,
  oauthRedirectCookieOptions,
  oauthStateCookieOptions,
  procoreOAuthCookies,
} from "./procoreOAuthCookies.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

function requestAt(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

test("HTTPS Procore OAuth cookies are host-only SameSite=None; Secure", () => {
  const state = oauthStateCookieOptions("state-demo", true);
  const redirect = oauthRedirectCookieOptions(
    "https://www.gcfieldlog.com/api/procore/callback",
    true,
  );
  assert.equal(state.httpOnly, true);
  assert.equal(state.path, "/");
  assert.equal(state.sameSite, "none");
  assert.equal(state.secure, true);
  assert.equal(state.maxAge, 600);
  assert.equal("domain" in state, false);
  assert.equal(redirect.name, PROCORE_OAUTH_REDIRECT_COOKIE);
  assert.equal(oauthCookieSameSite(true), "none");

  const header = formatProcoreOAuthSetCookie(state);
  assert.match(header, /gcfieldlog_procore_oauth_state=state-demo/);
  assert.match(header, /HttpOnly/);
  assert.match(header, /Path=\//);
  assert.match(header, /SameSite=None/);
  assert.match(header, /Secure/);
  assert.doesNotMatch(header, /Domain=/i);
});

test("localhost HTTP Procore OAuth cookies stay SameSite=Lax without Secure", () => {
  const local = requestAt("http://localhost:3000/api/procore/connect");
  assert.equal(oauthCookieSecureFromRequest(local), false);
  const state = oauthStateCookieOptions("local-state", false);
  assert.equal(state.sameSite, "lax");
  assert.equal(state.secure, false);
  const header = formatProcoreOAuthSetCookie(state);
  assert.match(header, /SameSite=Lax/);
  assert.doesNotMatch(header, /Secure/);
});

test("oauthCookieSecureFromRequest follows https on www, apex, and vercel.app", () => {
  assert.equal(
    oauthCookieSecureFromRequest(
      requestAt("https://www.gcfieldlog.com/api/procore/connect"),
    ),
    true,
  );
  assert.equal(
    oauthCookieSecureFromRequest(
      requestAt("https://gcfieldlog.com/api/procore/connect"),
    ),
    true,
  );
  assert.equal(
    oauthCookieSecureFromRequest(
      requestAt("https://internal.example/api/procore/connect", {
        "x-forwarded-host": "gc-field-log.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    true,
  );
});

test("attachProcoreOAuthCookies writes state + redirect_uri with no Domain", () => {
  const calls: Array<{ name: string; value: string; options: object }> = [];
  attachProcoreOAuthCookies(
    {
      set(name, value, options) {
        calls.push({ name, value, options });
      },
    },
    {
      state: "abc123",
      redirectUri: "https://gcfieldlog.com/api/procore/callback",
    },
    true,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.name, PROCORE_OAUTH_STATE_COOKIE);
  assert.equal(calls[0]?.value, "abc123");
  assert.deepEqual(calls[0]?.options, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    maxAge: 600,
    secure: true,
  });
  assert.equal(calls[1]?.name, PROCORE_OAUTH_REDIRECT_COOKIE);
  assert.equal(
    calls[1]?.value,
    "https://gcfieldlog.com/api/procore/callback",
  );
  assert.equal("domain" in (calls[0]?.options ?? {}), false);
});

test("connect redirect headers can carry host-only OAuth Set-Cookie rows", () => {
  const headers = new Headers({
    Location: "https://login-sandbox.procore.com/oauth/authorize",
  });
  appendProcoreOAuthSetCookies(
    headers,
    {
      state: "connect-state",
      redirectUri: "https://www.gcfieldlog.com/api/procore/callback",
    },
    true,
  );
  const setCookie = headers.getSetCookie();
  assert.ok(
    setCookie.some((row) =>
      row.includes(`${PROCORE_OAUTH_STATE_COOKIE}=connect-state`),
    ),
    setCookie.join(" | "),
  );
  assert.ok(
    setCookie.some((row) =>
      row.includes(
        `${PROCORE_OAUTH_REDIRECT_COOKIE}=https://www.gcfieldlog.com/api/procore/callback`,
      ),
    ),
    setCookie.join(" | "),
  );
  assert.ok(setCookie.some((row) => /SameSite=None/i.test(row)));
  assert.ok(setCookie.some((row) => /Secure/i.test(row)));
  assert.ok(setCookie.every((row) => !/Domain=/i.test(row)));
});

test("OAuth cookie helpers stay Maple Point / fictional only", () => {
  const blob = JSON.stringify(procoreOAuthCookies(null, true));
  assert.equal(forbidden.test(blob), false);
});

test("connect route sets OAuth cookies on the Procore redirect response", () => {
  const connect = readFileSync(
    new URL("../app/api/procore/connect/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(connect, /NextResponse\.redirect\(buildAuthorizeUrl/);
  assert.match(connect, /attachProcoreOAuthCookies\(response\.cookies/);
  assert.match(connect, /appendProcoreOAuthSetCookies\(response\.headers/);
  assert.match(connect, /attachProcoreOAuthCookies\(jar/);
  assert.match(connect, /oauthCookieSecureFromRequest/);
});
