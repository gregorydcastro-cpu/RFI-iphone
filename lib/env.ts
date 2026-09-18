/**
 * Read a Vercel env key at runtime. Bracket access so Next.js does not inline
 * `SUPABASE_URL` / `SUPABASE_ANON_KEY` at build time.
 */
export function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
