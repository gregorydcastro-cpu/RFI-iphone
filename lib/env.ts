/**
 * Read a Vercel env key at runtime. Bracket access so Next.js does not inline
 * at build time. OAuth uses PROCORE_CLIENT_ID / PROCORE_CLIENT_SECRET first.
 * Live packs use SUPABASE_URL / SUPABASE_ANON_KEY. Service-role token writes
 * use SUPABASE_SERVICE_ROLE_KEY. Never NEXT_PUBLIC_ for any of these.
 */
export function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** First non-empty match among aliases (pass preferred key first). */
export function readEnvAlias(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

/** @deprecated Use readEnv with the exact key. Kept for existing lowercase lookups. */
export function readLowercaseEnv(key: string): string | undefined {
  return readEnv(key);
}
