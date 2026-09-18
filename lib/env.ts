/**
 * Read a Vercel env key at runtime. Bracket access so Next.js does not inline
 * at build time. Use the exact key name Field Log stores (lowercase Procore
 * keys, or `SUPABASE_URL` / `SUPABASE_ANON_KEY` as provided).
 */
export function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** @deprecated Use readEnv with the exact key. Kept for existing lowercase lookups. */
export function readLowercaseEnv(key: string): string | undefined {
  return readEnv(key);
}
