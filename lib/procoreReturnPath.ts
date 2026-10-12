/**
 * Same-site return path for Connect Procore.
 * Kept separate from refresh copy so a signed-out header does not ship
 * share-folder or pack-pull strings.
 */

const SAFE_RETURN =
  /^\/(?:account|time|share|jobs(?:\/[A-Za-z0-9_-]+)?|pack\/[A-Za-z0-9._-]+)(?:\?[A-Za-z0-9._~%=&-]*)?$/;

/**
 * Same-site return after Connect Procore. Pack, jobs, share, time, account.
 * Rejects open redirects and path tricks.
 */
export function safeProcoreReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (trimmed.includes("..") || trimmed.includes("//") || trimmed.includes("\\")) {
    return null;
  }
  if (!SAFE_RETURN.test(trimmed)) return null;
  return trimmed;
}

export function procoreReturnFromCookie(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    return safeProcoreReturnPath(decodeURIComponent(value));
  } catch {
    return safeProcoreReturnPath(value);
  }
}

export function procoreReconnectHref(returnPath?: string | null): string {
  const safe = safeProcoreReturnPath(returnPath);
  if (!safe) return "/api/procore/connect";
  return `/api/procore/connect?next=${encodeURIComponent(safe)}`;
}
