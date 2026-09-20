import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  DEFAULT_PROCORE_REDIRECT_URI,
  PROCORE_CALLBACK_PATH,
  PROCORE_REDIRECT_HOST_ALLOWLIST,
  isAllowlistedProcoreRedirectHost,
  isTrustedProcoreRedirectUri,
  procoreRedirectUrisToRegister,
  redirectUriForTokenExchange,
  requestOriginForProcore,
  resolveProcoreRedirectUri,
  resolveProcoreRedirectUriFromRequest,
  normalizeProcoreRedirectHost,
} from "./procoreSecrets.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

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

test("Procore redirect host allowlist is exact production + local hosts", () => {
  assert.deepEqual(
    [...PROCORE_REDIRECT_HOST_ALLOWLIST],
    [
      "www.gcfieldlog.com",
      "gcfieldlog.com",
      "gc-field-log.vercel.app",
      "localhost:3000",
    ],
  );
  assert.equal(PROCORE_CALLBACK_PATH, "/api/procore/callback");
  assert.equal(
    DEFAULT_PROCORE_REDIRECT_URI,
    "https://www.gcfieldlog.com/api/procore/callback",
  );
});

test("allowlisted origins build same-host Procore callback URIs", () => {
  clearRedirectEnv();
  assert.equal(
    resolveProcoreRedirectUri("https://gc-field-log.vercel.app"),
    "https://gc-field-log.vercel.app/api/procore/callback",
  );
  assert.equal(
    resolveProcoreRedirectUri("https://www.gcfieldlog.com"),
    "https://www.gcfieldlog.com/api/procore/callback",
  );
  assert.equal(
    resolveProcoreRedirectUri("https://gcfieldlog.com"),
    "https://gcfieldlog.com/api/procore/callback",
  );
  assert.equal(
    resolveProcoreRedirectUri("http://localhost:3000"),
    "http://localhost:3000/api/procore/callback",
  );
  assert.equal(
    isAllowlistedProcoreRedirectHost("WWW.GCFIELDLOG.COM"),
    true,
  );
  assert.notEqual(
    resolveProcoreRedirectUri("https://gcfieldlog.com"),
    resolveProcoreRedirectUri("https://www.gcfieldlog.com"),
  );
});

test("apex vs www stay different cookie hosts after default-port strip", () => {
  assert.equal(normalizeProcoreRedirectHost("www.gcfieldlog.com:443"), "www.gcfieldlog.com");
  assert.equal(normalizeProcoreRedirectHost("gcfieldlog.com:443"), "gcfieldlog.com");
  assert.equal(normalizeProcoreRedirectHost("localhost:3000"), "localhost:3000");
  assert.equal(isAllowlistedProcoreRedirectHost("www.gcfieldlog.com:443"), true);
  assert.equal(isAllowlistedProcoreRedirectHost("gcfieldlog.com:443"), true);
  assert.notEqual(
    normalizeProcoreRedirectHost("www.gcfieldlog.com"),
    normalizeProcoreRedirectHost("gcfieldlog.com"),
  );
});

test("unknown origins keep the www.gcfieldlog.com default callback", () => {
  clearRedirectEnv();
  assert.equal(
    resolveProcoreRedirectUri("https://gc-field-log-git-main.vercel.app"),
    DEFAULT_PROCORE_REDIRECT_URI,
  );
  assert.equal(
    resolveProcoreRedirectUri("https://gcfieldlog.vercel.app"),
    DEFAULT_PROCORE_REDIRECT_URI,
  );
  assert.equal(
    resolveProcoreRedirectUri("https://evil.example"),
    DEFAULT_PROCORE_REDIRECT_URI,
  );
  assert.equal(resolveProcoreRedirectUri(null), DEFAULT_PROCORE_REDIRECT_URI);
  assert.equal(resolveProcoreRedirectUri(), DEFAULT_PROCORE_REDIRECT_URI);
  assert.equal(isAllowlistedProcoreRedirectHost("localhost"), false);
  assert.equal(isAllowlistedProcoreRedirectHost("evil.example"), false);
});

test("PROCORE_REDIRECT_URI env overrides allowlisted origin", () => {
  process.env.PROCORE_REDIRECT_URI =
    "https://www.gcfieldlog.com/api/procore/callback";
  assert.equal(
    resolveProcoreRedirectUri("https://gc-field-log.vercel.app"),
    "https://www.gcfieldlog.com/api/procore/callback",
  );
  process.env.PROCORE_REDIRECT_URI =
    "https://gc-field-log.vercel.app/api/procore/callback";
  assert.equal(
    resolveProcoreRedirectUri("http://localhost:3000"),
    "https://gc-field-log.vercel.app/api/procore/callback",
  );
});

test("request origin prefers x-forwarded-host so Vercel matches the browser", () => {
  clearRedirectEnv();
  const vercel = requestAt("https://internal.example/api/procore/connect", {
    "x-forwarded-host": "gc-field-log.vercel.app",
    "x-forwarded-proto": "https",
  });
  assert.equal(requestOriginForProcore(vercel), "https://gc-field-log.vercel.app");
  assert.equal(
    resolveProcoreRedirectUriFromRequest(vercel),
    "https://gc-field-log.vercel.app/api/procore/callback",
  );

  const local = requestAt("http://localhost:3000/api/procore/connect");
  assert.equal(
    resolveProcoreRedirectUriFromRequest(local),
    "http://localhost:3000/api/procore/callback",
  );

  const apex = requestAt("https://internal.example/api/procore/connect", {
    "x-forwarded-host": "gcfieldlog.com",
    "x-forwarded-proto": "https",
  });
  const www = requestAt("https://internal.example/api/procore/connect", {
    "x-forwarded-host": "www.gcfieldlog.com",
    "x-forwarded-proto": "https",
  });
  assert.equal(
    resolveProcoreRedirectUriFromRequest(apex),
    "https://gcfieldlog.com/api/procore/callback",
  );
  assert.equal(
    resolveProcoreRedirectUriFromRequest(www),
    "https://www.gcfieldlog.com/api/procore/callback",
  );
});

test("token exchange uses stored authorize redirect_uri when trusted", () => {
  clearRedirectEnv();
  const callback = requestAt(
    "https://gc-field-log.vercel.app/api/procore/callback?code=demo&state=abc",
  );
  assert.equal(
    redirectUriForTokenExchange(
      "https://gc-field-log.vercel.app/api/procore/callback",
      callback,
    ),
    "https://gc-field-log.vercel.app/api/procore/callback",
  );
  assert.equal(
    redirectUriForTokenExchange(null, callback),
    "https://gc-field-log.vercel.app/api/procore/callback",
  );
  assert.equal(
    redirectUriForTokenExchange("https://evil.example/api/procore/callback", callback),
    "https://gc-field-log.vercel.app/api/procore/callback",
  );
});

test("isTrustedProcoreRedirectUri rejects off-allowlist and query strings", () => {
  clearRedirectEnv();
  assert.equal(
    isTrustedProcoreRedirectUri(
      "https://gc-field-log.vercel.app/api/procore/callback",
    ),
    true,
  );
  assert.equal(
    isTrustedProcoreRedirectUri(DEFAULT_PROCORE_REDIRECT_URI),
    true,
  );
  assert.equal(
    isTrustedProcoreRedirectUri("https://evil.example/api/procore/callback"),
    false,
  );
  assert.equal(
    isTrustedProcoreRedirectUri(
      "https://gc-field-log.vercel.app/api/procore/callback?next=https://evil.example",
    ),
    false,
  );
  process.env.PROCORE_REDIRECT_URI = "https://hooks.example.test/procore/callback";
  assert.equal(
    isTrustedProcoreRedirectUri("https://hooks.example.test/procore/callback"),
    true,
  );
});

test("Greg must register every Procore callback host in the developer portal", () => {
  const urls = procoreRedirectUrisToRegister();
  assert.deepEqual(urls, [
    "https://www.gcfieldlog.com/api/procore/callback",
    "https://gcfieldlog.com/api/procore/callback",
    "https://gc-field-log.vercel.app/api/procore/callback",
    "http://localhost:3000/api/procore/callback",
  ]);
  assert.equal(forbidden.test(urls.join("\n")), false);
  assert.equal(/client_secret|sk_|whsec_/i.test(urls.join("\n")), false);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const uri of urls) {
    assert.ok(readme.includes(uri), uri);
  }
});

test("connect and callback routes share origin-aware redirect_uri", () => {
  const connect = readFileSync(
    new URL("../app/api/procore/connect/route.ts", import.meta.url),
    "utf8",
  );
  const callback = readFileSync(
    new URL("../app/api/procore/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(connect, /getProcoreOAuthConfig\(\{ request \}\)/);
  assert.match(connect, /attachProcoreOAuthCookies/);
  assert.match(callback, /redirectUriForTokenExchange/);
  assert.match(callback, /PROCORE_OAUTH_REDIRECT_COOKIE/);
  assert.equal(forbidden.test(`${connect}\n${callback}`), false);
});
