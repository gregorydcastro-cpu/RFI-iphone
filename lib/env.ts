/**
 * Read a Vercel env key at runtime. Bracket access so Next.js does not inline
 * at build time. Keys in this app are lowercase only.
 */
export function readLowercaseEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
