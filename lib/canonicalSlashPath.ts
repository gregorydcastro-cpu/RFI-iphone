/**
 * Pathname after a trailing-slash trim, or null when this request
 * should stay on its current path. /_not-found/ stays put so the proxy
 * can answer 404. Every other slashed path keeps the canonical URL.
 */
export function canonicalSlashPath(pathname: string): string | null {
  if (pathname.length <= 1 || !pathname.endsWith("/")) return null;
  const stripped = pathname.replace(/\/+$/, "") || "/";
  if (stripped === "/_not-found") return null;
  return stripped;
}
