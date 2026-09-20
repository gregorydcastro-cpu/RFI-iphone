import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  DEFAULT_PROCORE_REDIRECT_URI,
  PROCORE_CALLBACK_PATH,
  PROCORE_CONNECT_PATH,
  PROCORE_COOKIE_DOMAIN,
  isTrustedProcoreRedirectUri,
  oauthCookieDomainForHost,
  procoreConnectBounceUrl,
  procoreRedirectUrisToRegister,
  redirectUriForTokenExchange,
  requestOriginForProcore,
  resolveProcoreRedirectUri,
  resolveProcoreRedirectUriFromRequest,
} from "./procoreSecrets.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const PORTAL_URI = "https://www.gcfieldlog.com/api/procore/callback";

const previous = {
  PROCORE_REDIRECT_URI: process.env.PROCORE_REDIRECT_URI,
  procore_redirect_uri: process.env.procore_redirect_uri,
};

afterEach(() => {
  restoreEnv("PROCORE_REDIRECT_URI", previous.PROCORE_REDIRECT_URI);
  restoreEnv("procore_redirect_uri", previous.procore_redirect_uri);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function clearRedirectEnv() {
  delete process.env.PROCORE_REDIRECT_URI;
  delete process.env.procore_redirect_uri;
}

function requestAt(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

test("portal redirect_uri is the exact www callback with no trailing slash", () => {
  clearRedirectEnv();
  assert.equal(DEFAULT_PROCORE_REDIRECT_URI, PORTAL_URI);
  assert.equal(PROCORE_CALLBACK_PATH, "/api/procore/callback");
  assert.equal(PROCORE_CONNECT_PATH, "/api/procore/connect");
  assert.equal(resolveProcoreRedirectUri(), PORTAL_URI);
  assert.equal(resolveProcoreRedirectUri("https://gc-field-log.vercel.app"), PORTAL_URI);
  assert.equal(resolveProcoreRedirectUri("https://gcfieldlog.com"), PORTAL_URI);
  assert.doesNotMatch(DEFAULT_PROCORE_REDIRECT_URI, /\/$/);
});

test("PROCORE_REDIRECT_URI other than the portal string is ignored", () => {
  process.env.PROCORE_REDIRECT_URI =
    "https://gc-field-log.vercel.app/api/procore/callback";
  assert.equal(resolveProcoreRedirectUri("https://gc-field-log.vercel.app"), PORTAL_URI);
  process.env.PROCORE_REDIRECT_URI = "https://www.gcfieldlog.com/api/procore/callback/";
  assert.equal(resolveProcoreRedirectUri(), PORTAL_URI);
});

test("Connect on vercel.app or apex bounces to www before authorize", () => {
  const bounceTo = "https://www.gcfieldlog.com/api/procore/connect";
  assert.equal(
    procoreConnectBounceUrl(
      requestAt("https://internal.example/api/procore/connect", {
        "x-forwarded-host": "gc-field-log.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    bounceTo,
  );
  assert.equal(
    procoreConnectBounceUrl(
      requestAt("https://internal.example/api/procore/connect", {
        "x-forwarded-host": "gcfieldlog.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    bounceTo,
  );
  assert.equal(
    procoreConnectBounceUrl(
      requestAt("https://internal.example/api/procore/connect", {
        "x-forwarded-host": "gcfieldlog.com",
        "x-forwarded-proto": "https",
      }),
    ),
    bounceTo,
  );
  assert.equal(
    procoreConnectBounceUrl(
      requestAt("https://internal.example/api/procore/connect", {
        "x-forwarded-host": "www.gcfieldlog.com",
        "x-forwarded-proto": "https",
      }),
    ),
    null,
  );
});

test("invalid_state host mismatch is the bounce case, not a portal URI change", () => {
  const vercel = requestAt("https://gc-field-log.vercel.app/api/procore/connect");
  assert.equal(resolveProcoreRedirectUriFromRequest(vercel), PORTAL_URI);
  assert.equal(
    procoreConnectBounceUrl(vercel),
    "https://www.gcfieldlog.com/api/procore/connect",
  );
  const connect = readFileSync(
    new URL("../app/api/procore/connect/route.ts", import.meta.url),
    "utf8",
  );
  const bounceAt = connect.indexOf("procoreConnectBounceUrl");
  const cookieAt = connect.indexOf("procoreOAuthCookies");
  assert.ok(bounceAt >= 0 && cookieAt > bounceAt);
  assert.match(connect, /NextResponse\.redirect\(bounce\)/);
});

test("OAuth cookie Domain is gcfieldlog.com on www+apex only", () => {
  assert.equal(PROCORE_COOKIE_DOMAIN, "gcfieldlog.com");
  assert.equal(oauthCookieDomainForHost("www.gcfieldlog.com"), "gcfieldlog.com");
  assert.equal(oauthCookieDomainForHost("gcfieldlog.com"), "gcfieldlog.com");
  assert.equal(oauthCookieDomainForHost("WWW.GCFIELDLOG.COM"), "gcfieldlog.com");
  assert.equal(oauthCookieDomainForHost("gc-field-log.vercel.app"), undefined);
  assert.equal(oauthCookieDomainForHost("gcfieldlog.vercel.app"), undefined);
  assert.equal(oauthCookieDomainForHost("localhost:3000"), undefined);
});

test("request origin prefers x-forwarded-host so bounce sees the browser host", () => {
  const vercel = requestAt("https://internal.example/api/procore/connect", {
    "x-forwarded-host": "gc-field-log.vercel.app",
    "x-forwarded-proto": "https",
  });
  assert.equal(requestOriginForProcore(vercel), "https://gc-field-log.vercel.app");
  assert.equal(resolveProcoreRedirectUriFromRequest(vercel), PORTAL_URI);
});

test("token exchange keeps the portal redirect_uri byte-for-byte", () => {
  clearRedirectEnv();
  const callback = requestAt(
    "https://www.gcfieldlog.com/api/procore/callback?code=demo&state=abc",
  );
  assert.equal(redirectUriForTokenExchange(PORTAL_URI, callback), PORTAL_URI);
  assert.equal(redirectUriForTokenExchange(null, callback), PORTAL_URI);
  assert.equal(
    redirectUriForTokenExchange(
      "https://gc-field-log.vercel.app/api/procore/callback",
      callback,
    ),
    PORTAL_URI,
  );
  assert.equal(isTrustedProcoreRedirectUri(PORTAL_URI), true);
  assert.equal(isTrustedProcoreRedirectUri(`${PORTAL_URI}/`), true);
  assert.equal(
    isTrustedProcoreRedirectUri("https://gc-field-log.vercel.app/api/procore/callback"),
    false,
  );
});

test("portal register list is the single www callback", () => {
  const urls = procoreRedirectUrisToRegister();
  assert.deepEqual(urls, [PORTAL_URI]);
  assert.equal(forbidden.test(urls.join("\n")), false);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.ok(readme.includes(PORTAL_URI));
});

test("connect bounces before cookies; callback exchanges the portal URI", () => {
  const connect = readFileSync(
    new URL("../app/api/procore/connect/route.ts", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../app/api/procore/callback/route.ts", import.meta.url),
    "utf8",
  );
  const oauthSrc = readFileSync(new URL("./procoreOAuth.ts", import.meta.url), "utf8");
  assert.match(connect, /procoreConnectBounceUrl/);
  assert.match(connect, /procoreOAuthCookies\(/);
  assert.match(callback, /redirectUriForTokenExchange/);
  assert.match(oauthSrc, /domain\?: string/);
  assert.match(oauthSrc, /Domain=gcfieldlog\.com only on www\/apex/);
  assert.equal(forbidden.test(`${connect}\n${callback}`), false);
});

test("invalid_state copy matches the live Connect Procore error", () => {
  const statusSrc = readFileSync(new URL("./procoreStatus.ts", import.meta.url), "utf8");
  assert.match(
    statusSrc,
    /OAuth sign-in cannot be verified\. Try Connect Procore again from this same site\./,
  );
  assert.equal(forbidden.test(statusSrc), false);
});
