import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getProcoreOAuthConfig, procoreApiBaseForLogin } from "./procoreOAuth.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const ENV_KEYS = [
  "PROCORE_CLIENT_ID",
  "procore_client_id",
  "PROCORE_CLIENT_SECRET",
  "procore_client_secret",
  "PROCORE_OAUTH_BASE",
  "procore_oauth_base",
  "PROCORE_LOGIN_URL",
  "procore_login_url",
  "PROCORE_API_BASE",
  "procore_api_base",
] as const;

const previous = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function clearHostEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

test("API base follows the OAuth host for sandbox and production", () => {
  assert.equal(
    procoreApiBaseForLogin("https://login-sandbox.procore.com"),
    "https://sandbox.procore.com",
  );
  assert.equal(
    procoreApiBaseForLogin("https://login-sandbox.procore.com/"),
    "https://sandbox.procore.com",
  );
  assert.equal(
    procoreApiBaseForLogin("https://login-sandbox-monthly.procore.com"),
    "https://api-monthly.procore.com",
  );
  assert.equal(
    procoreApiBaseForLogin("https://login.procore.com"),
    "https://api.procore.com",
  );
  assert.equal(
    procoreApiBaseForLogin("https://login.procore.com/"),
    "https://api.procore.com",
  );
  assert.equal(forbidden.test("Maple Point Medical Office"), false);
});

test("OAuth config uses the login host when PROCORE_API_BASE is unset", () => {
  clearHostEnv();
  process.env.PROCORE_CLIENT_ID = "test-client";
  process.env.PROCORE_CLIENT_SECRET = "test-secret";
  process.env.PROCORE_OAUTH_BASE = "https://login.procore.com";
  const prod = getProcoreOAuthConfig();
  assert.equal(prod?.loginBase, "https://login.procore.com");
  assert.equal(prod?.apiBase, "https://api.procore.com");

  process.env.PROCORE_OAUTH_BASE = "https://login-sandbox.procore.com/";
  const sandbox = getProcoreOAuthConfig();
  assert.equal(sandbox?.loginBase, "https://login-sandbox.procore.com");
  assert.equal(sandbox?.apiBase, "https://sandbox.procore.com");

  process.env.PROCORE_API_BASE = "https://sandbox.procore.com";
  process.env.PROCORE_OAUTH_BASE = "https://login-sandbox.procore.com";
  const pinned = getProcoreOAuthConfig();
  assert.equal(pinned?.apiBase, "https://sandbox.procore.com");
});
