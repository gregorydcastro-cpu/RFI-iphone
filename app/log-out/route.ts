import { GET as sessionLogoutGet, POST as sessionLogoutPost } from "../api/session/logout/route";

export const dynamic = "force-dynamic";

/** Same Supabase sign-out as /api/session/logout. Signed-out visitors go home too. */
export function GET(request: Request) {
  return sessionLogoutGet(request);
}

export function POST(request: Request) {
  return sessionLogoutPost(request);
}
