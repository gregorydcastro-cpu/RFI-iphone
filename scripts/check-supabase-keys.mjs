#!/usr/bin/env node
/**
 * Smoke-check SUPABASE_SERVICE_ROLE_KEY from the environment.
 * Exits 0 when the value is a service_role JWT (matching project URL when set)
 * or an sb_secret_… key. Exits 1 with a clear message otherwise.
 * Never prints the key value.
 *
 * Usage: npm run check:supabase-keys
 * Override for local smoke: SUPABASE_SERVICE_ROLE_KEY=<fabricated> npm run check:supabase-keys
 */
import { checkSupabaseServiceRoleKeyFromEnv } from "../lib/supabaseKeyCheck.ts";

const result = checkSupabaseServiceRoleKeyFromEnv(process.env);
if (result.ok) {
  console.log(`OK: ${result.message}`);
  console.log(
    `kind=${result.kind} role=${result.role ?? "n/a"} projectRefMatches=${result.projectRefMatches ?? "n/a"}`,
  );
  process.exit(0);
}

console.error(`FAIL: ${result.message}`);
console.error(
  `kind=${result.kind} role=${result.role ?? "n/a"} projectRefMatches=${result.projectRefMatches ?? "n/a"}`,
);
process.exit(1);
