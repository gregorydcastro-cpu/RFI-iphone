import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  AUTH_CALLBACK_PATH,
  DEFAULT_AUTH_ORIGIN,
  PRODUCTION_AUTH_HOSTS,
  authAppOrigin,
  authCallbackUrl,
  isAllowedAuthHost,
  isProductionAuthHost,
  normalizeAuthHostname,
  supabaseAuthRedirectUrls,
} from "./authHosts.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

function requestAt(
  url: string,
  headers?: Record<string, string>,
): Request {
  return new Request(url, { headers });
}

test("production Auth hosts include custom domains and vercel.app aliases", () => {
  assert.deepEqual(
    [...PRODUCTION_AUTH_HOSTS],
    [
      "www.gcfieldlog.com",
      "gcfieldlog.com",
      "gcfieldlog.vercel.app",
      "gc-field-log.vercel.app",
    ],
  );
  for (const host of PRODUCTION_AUTH_HOSTS) {
    assert.equal(isProductionAuthHost(host), true);
    assert.equal(isAllowedAuthHost(host), true);
    assert.equal(isAllowedAuthHost(`${host}:443`), true);
  }
});

test("normalizeAuthHostname strips port and forwarded lists", () => {
  assert.equal(
    normalizeAuthHostname("gcfieldlog.vercel.app:443"),
    "gcfieldlog.vercel.app",
  );
  assert.equal(
    normalizeAuthHostname("www.gcfieldlog.com, gcfieldlog.com"),
    "www.gcfieldlog.com",
  );
});

test("preview vercel.app hosts are allowed; random hosts are not", () => {
  assert.equal(isAllowedAuthHost("gc-field-log-git-main.vercel.app"), true);
  assert.equal(isAllowedAuthHost("localhost"), true);
  assert.equal(isAllowedAuthHost("127.0.0.1"), true);
  assert.equal(isAllowedAuthHost("evil.example"), false);
  assert.equal(isAllowedAuthHost(""), false);
});

test("authAppOrigin keeps production and vercel.app hosts from Host headers", () => {
  assert.equal(
    authAppOrigin(
      requestAt("https://internal.example/", {
        "x-forwarded-host": "gcfieldlog.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    "https://gcfieldlog.vercel.app",
  );
  assert.equal(
    authAppOrigin(
      requestAt("https://internal.example/", {
        "x-forwarded-host": "gc-field-log.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    "https://gc-field-log.vercel.app",
  );
  assert.equal(
    authAppOrigin(
      requestAt("https://internal.example/", {
        "x-forwarded-host": "www.gcfieldlog.com",
        "x-forwarded-proto": "https",
      }),
    ),
    "https://www.gcfieldlog.com",
  );
  assert.equal(
    authAppOrigin(
      requestAt("https://internal.example/", {
        "x-forwarded-host": "gcfieldlog.com",
        "x-forwarded-proto": "https",
      }),
    ),
    "https://gcfieldlog.com",
  );
  assert.equal(
    authAppOrigin(requestAt("http://localhost:3000/")),
    "http://localhost:3000",
  );
});

test("authAppOrigin ignores unknown Host headers", () => {
  assert.equal(
    authAppOrigin(
      requestAt("https://internal.example/", {
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      }),
    ),
    DEFAULT_AUTH_ORIGIN,
  );
});

test("authCallbackUrl stays on-site", () => {
  assert.equal(
    authCallbackUrl("https://gcfieldlog.vercel.app", "/jobs"),
    "https://gcfieldlog.vercel.app/auth/callback?next=%2Fjobs",
  );
  assert.equal(
    authCallbackUrl("https://www.gcfieldlog.com", "https://evil.example"),
    "https://www.gcfieldlog.com/auth/callback?next=%2Fjobs",
  );
  assert.equal(AUTH_CALLBACK_PATH, "/auth/callback");
});

test("Supabase redirect URL checklist covers production Auth hosts", () => {
  const urls = supabaseAuthRedirectUrls();
  assert.ok(urls.includes("https://gcfieldlog.vercel.app/auth/callback"));
  assert.ok(urls.includes("https://gcfieldlog.vercel.app/**"));
  assert.ok(urls.includes("https://gc-field-log.vercel.app/auth/callback"));
  assert.ok(urls.includes("https://www.gcfieldlog.com/auth/callback"));
  assert.ok(urls.includes("https://gcfieldlog.com/auth/callback"));
  assert.ok(urls.includes("http://localhost:3000/auth/callback"));
  assert.equal(forbidden.test(urls.join("\n")), false);
  assert.equal(/service_role|sk_|whsec_/i.test(urls.join("\n")), false);
});

test("session and callback routes use authAppOrigin, not raw Host reflection", () => {
  const session = readFileSync(new URL("../app/api/session/route.ts", import.meta.url), "utf8");
  const callback = readFileSync(
    new URL("../app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(session, /authCallbackUrl\(authAppOrigin\(request\)\)/);
  assert.match(callback, /authAppOrigin\(request\)/);
  assert.equal(/x-forwarded-host/.test(session), false);
  assert.equal(/url\.origin/.test(callback), false);
});
