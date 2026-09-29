import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("procoreErrorMessage splits storage failures", () => {
  const statusSrc = readFileSync(new URL("./procoreStatus.ts", import.meta.url), "utf8");
  assert.match(statusSrc, /case "storage_unconfigured":/);
  assert.match(statusSrc, /Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(statusSrc, /case "storage_key_invalid":/);
  assert.match(statusSrc, /not the service_role secret/);
  assert.match(statusSrc, /aejevzkqvlwbmjbqdxuu/);
  assert.match(statusSrc, /gc-field-log/);
  assert.match(statusSrc, /case "storage_write_failed":/);
  assert.match(statusSrc, /token exchange succeeded/);
  assert.match(statusSrc, /https:\/\/aejevzkqvlwbmjbqdxuu\.supabase\.co/);
  assert.doesNotMatch(statusSrc, /eyJ[A-Za-z0-9_-]+\./);
  assert.equal(forbidden.test(statusSrc), false);
});

test("callback maps missing env, bad JWT, and REST failure to distinct reasons", () => {
  const callback = readFileSync(
    new URL("../app/api/procore/callback/route.ts", import.meta.url),
    "utf8",
  );
  const status = readFileSync(
    new URL("../app/api/procore/status/route.ts", import.meta.url),
    "utf8",
  );
  const card = readFileSync(
    new URL("../components/ProcoreConnectCard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(callback, /reason: "storage_unconfigured"/);
  assert.match(callback, /reason: "storage_key_invalid"/);
  assert.match(callback, /reason: "storage_write_failed"/);
  assert.match(callback, /isSupabaseServiceRoleKeyValid\(\)/);
  assert.match(callback, /diagnoseSupabaseServiceRoleKey/);
  assert.doesNotMatch(callback, /console\.\w+\([^)]*service\.serviceRoleKey/);
  assert.match(status, /storageKeyValid: isSupabaseServiceRoleKeyValid\(\)/);
  assert.match(status, /storageKeyProblem/);
  assert.match(card, /storageConfigured && !view\.storageKeyValid/);
  assert.match(card, /procoreErrorMessage\("storage_key_invalid"\)/);
  assert.equal(forbidden.test(`${callback}\n${status}\n${card}`), false);
});
