import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  checkSupabaseServiceRoleKey,
  decodeJwtPayload,
  jwtRoleClaim,
  projectRefFromSupabaseUrl,
} from "./supabaseKeyCheck.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

function fakeJwt(
  role: string | undefined,
  extra?: Record<string, unknown>,
): string {
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

test("projectRefFromSupabaseUrl reads hostname prefix", () => {
  assert.equal(
    projectRefFromSupabaseUrl("https://maplepointfake.supabase.co"),
    "maplepointfake",
  );
  assert.equal(
    projectRefFromSupabaseUrl("https://maplepointfake.supabase.co/"),
    "maplepointfake",
  );
  assert.equal(projectRefFromSupabaseUrl("not-a-url"), null);
  assert.equal(projectRefFromSupabaseUrl(""), null);
});

test("checkSupabaseServiceRoleKey accepts service_role JWT and sb_secret_", () => {
  const jwt = checkSupabaseServiceRoleKey(
    fakeJwt("service_role"),
    "maplepointfake",
  );
  assert.equal(jwt.ok, true);
  assert.equal(jwt.kind, "service_role_jwt");
  assert.equal(jwt.role, "service_role");
  assert.equal(jwt.projectRefMatches, true);
  assert.match(jwt.message, /service_role/i);
  assert.doesNotMatch(jwt.message, /eyJ/);

  const secret = checkSupabaseServiceRoleKey(
    "sb_secret_TESTONLY",
  );
  assert.equal(secret.ok, true);
  assert.equal(secret.kind, "secret");
  assert.equal(secret.role, null);
  assert.equal(secret.projectRefMatches, null);
});

test("checkSupabaseServiceRoleKey fails loudly for anon, publishable, missing, wrong ref", () => {
  const missing = checkSupabaseServiceRoleKey(undefined);
  assert.equal(missing.ok, false);
  assert.equal(missing.kind, "missing");
  assert.match(missing.message, /missing/i);

  const anon = checkSupabaseServiceRoleKey(fakeJwt("anon"), "maplepointfake");
  assert.equal(anon.ok, false);
  assert.equal(anon.kind, "anon_jwt");
  assert.equal(anon.role, "anon");
  assert.match(anon.message, /anon/i);

  const publishable = checkSupabaseServiceRoleKey(
    "sb_publishable_TESTONLY",
  );
  assert.equal(publishable.ok, false);
  assert.equal(publishable.kind, "publishable");
  assert.match(publishable.message, /publishable/i);

  const wrongRef = checkSupabaseServiceRoleKey(
    fakeJwt("service_role", { ref: "otherprojectref" }),
    "maplepointfake",
  );
  assert.equal(wrongRef.ok, false);
  assert.equal(wrongRef.kind, "service_role_jwt");
  assert.equal(wrongRef.projectRefMatches, false);
  assert.match(wrongRef.message, /does not match/i);
  assert.match(wrongRef.message, /maplepointfake/);

  const notJwt = checkSupabaseServiceRoleKey("totally-not-a-key");
  assert.equal(notJwt.ok, false);
  assert.equal(notJwt.kind, "not_jwt");
  assert.match(notJwt.message, /length/);

  const malformed = checkSupabaseServiceRoleKey("hdr.%%%notb64%%%.sig");
  assert.equal(malformed.ok, false);
  assert.equal(malformed.kind, "malformed");

  // Never echo the key value
  for (const result of [anon, publishable, wrongRef, notJwt]) {
    assert.doesNotMatch(result.message, /eyJ[A-Za-z0-9_-]+\./);
    assert.doesNotMatch(result.message, /sb_secret_TESTONLY/);
  }
});

test("jwtRoleClaim and decodeJwtPayload stay key-safe", () => {
  assert.equal(jwtRoleClaim(fakeJwt("service_role")), "service_role");
  assert.equal(jwtRoleClaim(fakeJwt("anon")), "anon");
  assert.equal(jwtRoleClaim("not-a-jwt"), null);
  const payload = decodeJwtPayload(fakeJwt("service_role"));
  assert.equal(payload?.role, "service_role");
  assert.equal(payload?.ref, "maplepointfake");
  assert.equal(forbidden.test(fakeJwt("anon")), false);
});

test("supabaseKeyCheck source never logs the key", () => {
  const src = readFileSync(new URL("./supabaseKeyCheck.ts", import.meta.url), "utf8");
  assert.match(src, /Never returns the key value/);
  assert.doesNotMatch(src, /console\.\w+\([^)]*key/);
  assert.equal(forbidden.test(src), false);
});
