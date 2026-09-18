/**
 * Read a Vercel env key at runtime. Bracket access so Next.js does not inline
 * at build time. Prefer lowercase keys; aliases may include uppercase.
 */
export function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** First non-empty match among aliases (lowercase preferred first). */
export function readEnvAlias(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readEnv(key);
    if (value) return value;
  }
  return undefined;
}

/** Existing lowercase-only lookups (webhook keys). */
export function readLowercaseEnv(key: string): string | undefined {
  return readEnv(key);
}
