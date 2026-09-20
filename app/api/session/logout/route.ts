import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { procoreOAuthCookies } from "@/lib/procoreOAuth";
import { expireStubSessionCookie } from "@/lib/stubSession";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function clearAuthCookies(request: Request, response: NextResponse) {
  const secure = cookieSecureFromRequest(request);
  response.cookies.set(expireStubSessionCookie(secure));
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  for (const cookie of procoreOAuthCookies(null, secure)) {
    response.cookies.set(cookie);
  }
}

export async function GET(request: Request) {
  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url);
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
