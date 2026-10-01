import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { authAppOrigin } from "@/lib/authHosts";
import { sessionExitLocation } from "@/lib/authMessages";
import { procoreOAuthCookies } from "@/lib/procoreOAuth";
import { expireSupabaseAuthCookies } from "@/lib/session";
import { expireStubSessionCookie } from "@/lib/stubSession";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function clearAuthCookies(request: Request, response: NextResponse) {
  const secure = cookieSecureFromRequest(request);
  response.cookies.set(expireStubSessionCookie(secure));
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  for (const cookie of procoreOAuthCookies(null, secure, request)) {
    response.cookies.set(cookie);
  }
  for (const cookie of expireSupabaseAuthCookies(request.headers.get("cookie"), secure)) {
    response.cookies.set(cookie);
  }
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const response = NextResponse.redirect(
    sessionExitLocation({
      origin: authAppOrigin(request),
      next: incoming.searchParams.get("next"),
      reason: incoming.searchParams.get("reason"),
      auth: incoming.searchParams.get("auth"),
    }),
  );
  const supabase = createSupabaseRouteClient(request, response);
  if (supabase) {
    await supabase.auth.signOut();
  }
  clearAuthCookies(request, response);
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
