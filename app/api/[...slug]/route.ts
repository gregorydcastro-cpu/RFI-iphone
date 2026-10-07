import { apiNotFoundResponse } from "@/lib/apiNotFound";

export const dynamic = "force-dynamic";

/**
 * Unknown `/api/*` paths. A more specific route file (including
 * `/api/procore/status` and `/api/invites/[token]`) is matched first.
 */
function unknownApi(): Response {
  return apiNotFoundResponse();
}

export const GET = unknownApi;
export const POST = unknownApi;
export const PUT = unknownApi;
export const PATCH = unknownApi;
export const DELETE = unknownApi;
export const HEAD = unknownApi;
export const OPTIONS = unknownApi;
