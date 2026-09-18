/**
 * Read a Vercel env key at runtime. Bracket access so Next.js does not inline
 * at build time. Use the exact stored name (lowercase webhook keys, or
 * `SUPABASE_URL` / `SUPABASE_ANON_KEY` as provided).
 */
export function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readLowercaseEnv(key: string): string | undefined {
  return readEnv(key);
}
