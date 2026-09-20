/**
 * Publishable Supabase Auth config (URL + anon / publishable key).
 * Server-only. Never expose SUPABASE_SERVICE_ROLE_KEY here or via NEXT_PUBLIC_.
 *
 * Sign-in is keys-only: Host is not a gate. Production custom domains and
 * vercel.app aliases all start Auth when these publishable values exist.
 */

import { readEnvAlias } from "../env.ts";

export type SupabaseAuthConfig = {
  url: string;
  anonKey: string;
};

function nonempty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getSupabaseAuthConfig(): SupabaseAuthConfig | null {
  // Static process.env.* reads so Next/Vercel keep publishable Auth keys
  // in the server runtime even when bracket alias lookup is empty.
  // Dynamic aliases still win first (runtime Vercel env, no secrets here).
  const url =
    readEnvAlias("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "supabase_url") ??
    nonempty(process.env.SUPABASE_URL) ??
    nonempty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey =
    readEnvAlias(
      "SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "supabase_anon_key",
    ) ??
    nonempty(process.env.SUPABASE_ANON_KEY) ??
    nonempty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    nonempty(process.env.SUPABASE_PUBLISHABLE_KEY);
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ""), anonKey };
}

/**
 * True when publishable Auth env is set. Does not inspect Host — vercel.app
 * and gcfieldlog.com share this check so an unknown hostname cannot block
 * sign-in when keys are present.
 */
export function isSupabaseAuthConfigured(): boolean {
  return getSupabaseAuthConfig() !== null;
}
