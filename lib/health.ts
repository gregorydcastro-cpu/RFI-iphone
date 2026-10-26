/**
 * Public liveness. No session, database, Stripe, or secrets.
 * The deploy id is the first 7 characters of VERCEL_GIT_COMMIT_SHA when
 * that value is present. It is null when the variable is absent.
 */

export const HEALTH_PATH = "/api/health";
export const HEALTH_CACHE_CONTROL = "no-store";
export const DEPLOY_SHA_ENV = "VERCEL_GIT_COMMIT_SHA";
export const DEPLOY_SHA_LENGTH = 7;

export function isPublicHealthPath(pathname: string): boolean {
  return pathname === HEALTH_PATH;
}

/** Short deploy SHA, or null when the value is missing. */
export function shortDeploySha(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, DEPLOY_SHA_LENGTH);
}

export function healthBody(sha: string | undefined | null): {
  ok: true;
  commit: string | null;
} {
  return { ok: true, commit: shortDeploySha(sha) };
}

export function healthResponse(sha: string | undefined | null): Response {
  return Response.json(healthBody(sha), {
    status: 200,
    headers: {
      "Cache-Control": HEALTH_CACHE_CONTROL,
    },
  });
}
