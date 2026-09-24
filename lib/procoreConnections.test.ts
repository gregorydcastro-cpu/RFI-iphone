import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  diagnoseSupabaseServiceRoleKey,
  isProcoreTokenStorageConfigured,
  isSupabaseServiceRoleKeyValid,
  jwtRoleClaim,
  procoreStorageFailureReason,
} from "./procoreConnections.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const previous = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabase_url: process.env.supabase_url,
  supabase_service_role_key: process.env.supabase_service_role_key,
};

afterEach(() => {
  restore("SUPABASE_URL", previous.SUPABASE_URL);
  restore("SUPABASE_SERVICE_ROLE_KEY", previous.SUPABASE_SERVICE_ROLE_KEY);
  restore("supabase_url", previous.supabase_url);
  restore("supabase_service_role_key", previous.supabase_service_role_key);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function clearServiceEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.supabase_url;
  delete process.env.supabase_service_role_key;
}

function fakeJwt(role: string | undefined, extra?: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload: Record<string, unknown> = {
    iss: "supabase",
    ref: "maplepointfake",
    iat: 1,
    ...extra,
  };
  if (role !== undefined) payload.role = role;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fakesignature`;
}

test("jwtRoleClaim reads anon vs service_role from fake JWTs", () => {
  assert.equal(jwtRoleClaim(fakeJwt("service_role")), "service_role");
  assert.equal(jwtRoleClaim(fakeJwt("anon")), "anon");
  assert.equal(jwtRoleClaim(fakeJwt("authenticated")), "authenticated");
  assert.equal(jwtRoleClaim("not-a-jwt"), null);
  assert.equal(jwtRoleClaim("only.two"), null);
  assert.equal(jwtRoleClaim("hdr.%%%notb64%%%.sig"), null);
  assert.equal(jwtRoleClaim(fakeJwt("service_role").slice(0, 40)), null);
  assert.equal(jwtRoleClaim(fakeJwt(undefined)), null);
  assert.equal(forbidden.test(fakeJwt("anon")), false);
});

test("isSupabaseServiceRoleKeyValid is false for missing, malformed, and anon keys", () => {
  clearServiceEnv();
  assert.equal(isProcoreTokenStorageConfigured(), false);
  assert.equal(isSupabaseServiceRoleKeyValid(), false);
  assert.equal(procoreStorageFailureReason(), "storage_unconfigured");

  process.env.SUPABASE_URL = "https://maplepointfake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt("anon");
  assert.equal(isProcoreTokenStorageConfigured(), true);
  assert.equal(isSupabaseServiceRoleKeyValid(), false);
  assert.equal(procoreStorageFailureReason(), "storage_key_invalid");

  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_publishable_TESTONLY";
  assert.equal(isProcoreTokenStorageConfigured(), true);
  assert.equal(isSupabaseServiceRoleKeyValid(), false);
  assert.equal(jwtRoleClaim("sb_publishable_TESTONLY"), null);

  process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt("service_role").slice(0, 24);
  assert.equal(isSupabaseServiceRoleKeyValid(), false);
});

test("isSupabaseServiceRoleKeyValid is true for service_role JWT and sb_secret_", () => {
  clearServiceEnv();
  process.env.SUPABASE_URL = "https://maplepointfake.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = fakeJwt("service_role");
  assert.equal(isProcoreTokenStorageConfigured(), true);
  assert.equal(isSupabaseServiceRoleKeyValid(), true);
  assert.equal(procoreStorageFailureReason(), "storage_write_failed");

  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_TESTONLY";
  assert.equal(isSupabaseServiceRoleKeyValid(), true);
  assert.equal(diagnoseSupabaseServiceRoleKey().kind, "secret");
});

test("service role helpers never log the key", () => {
  const src = readFileSync(new URL("./procoreConnections.ts", import.meta.url), "utf8");
  assert.match(src, /diagnoseSupabaseServiceRoleKey/);
  assert.match(src, /Never logs the key/);
  assert.doesNotMatch(src, /console\.\w+\([^)]*serviceRoleKey/);
  assert.match(src, /body: await restErrorSnippet\(response\)/);
  assert.equal(forbidden.test(src), false);
});
