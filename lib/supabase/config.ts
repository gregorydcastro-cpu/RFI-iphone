/**
 * Publishable Supabase Auth config (URL + anon / publishable key).
 * Server-only. Never expose SUPABASE_SERVICE_ROLE_KEY here or via NEXT_PUBLIC_.
 */

import { readEnvAlias } from "../env";

export type SupabaseAuthConfig = {
  url: string;
  anonKey: string;
};

export function getSupabaseAuthConfig(): SupabaseAuthConfig | null {
  const url = readEnvAlias(
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "supabase_url",
  );
  const anonKey = readEnvAlias(
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "supabase_anon_key",
  );
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

export function isSupabaseAuthConfigured(): boolean {
  return getSupabaseAuthConfig() !== null;
}
