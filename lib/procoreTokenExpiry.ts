/** Access tokens last ~1.5h. Refresh this far before expiry. */
export const ACCESS_TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;

export function accessTokenNeedsRefresh(
  expiresAt: string | null | undefined,
  nowMs: number = Date.now(),
  skewMs: number = ACCESS_TOKEN_REFRESH_SKEW_MS,
): boolean {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresMs)) return false;
  return expiresMs - nowMs <= skewMs;
}
