/**
 * JSON 404 for an API path that does not exist.
 * Specific `app/api/.../route.ts` files win over the catch-all.
 */

export const API_NOT_FOUND_BODY = { ok: false, error: "not_found" } as const;

export function apiNotFoundResponse(): Response {
  return Response.json(API_NOT_FOUND_BODY, {
    status: 404,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}
