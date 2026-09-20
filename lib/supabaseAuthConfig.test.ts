import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  getSupabaseAuthConfig,
  isSupabaseAuthConfigured,
} from "./supabase/config.ts";

const previous = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabase_url: process.env.supabase_url,
  supabase_anon_key: process.env.supabase_anon_key,
};

afterEach(() => {
  restore("SUPABASE_URL", previous.SUPABASE_URL);
  restore("SUPABASE_ANON_KEY", previous.SUPABASE_ANON_KEY);
  restore("NEXT_PUBLIC_SUPABASE_URL", previous.NEXT_PUBLIC_SUPABASE_URL);
  restore("NEXT_PUBLIC_SUPABASE_ANON_KEY", previous.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  restore("SUPABASE_PUBLISHABLE_KEY", previous.SUPABASE_PUBLISHABLE_KEY);
  restore(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    previous.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  restore("supabase_url", previous.supabase_url);
  restore("supabase_anon_key", previous.supabase_anon_key);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function clearAuthEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.supabase_url;
  delete process.env.supabase_anon_key;
}

test("isSupabaseAuthConfigured is keys-only, not a Host allowlist", () => {
  clearAuthEnv();
  assert.equal(isSupabaseAuthConfigured(), false);

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "publishable-anon";
  assert.equal(isSupabaseAuthConfigured(), true);
  assert.deepEqual(getSupabaseAuthConfig(), {
    url: "https://example.supabase.co",
    anonKey: "publishable-anon",
  });
});

test("NEXT_PUBLIC_ publishable aliases are enough to start Auth", () => {
  clearAuthEnv();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "publishable-anon";
  assert.equal(isSupabaseAuthConfigured(), true);
  assert.equal(getSupabaseAuthConfig()?.url, "https://example.supabase.co");
});
