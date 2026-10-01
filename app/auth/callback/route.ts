import { NextResponse } from "next/server";
import { cookieSecureFromRequest } from "@/lib/auth";
import { authAppOrigin } from "@/lib/authHosts";
import { authCallbackLocation } from "@/lib/authMessages";
import { expireSupabaseAuthCookies } from "@/lib/session";
import { expireStubSessionCookie } from "@/lib/stubSession";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * PKCE / magic-link / confirm-email callback.
 * Exchanges `code` for a Supabase session cookie. Never a stub cookie.
 * Failures return to login with a safe `next`, and drop leftover auth cookies.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = authAppOrigin(request);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const secure = cookieSecureFromRequest(request);

  if (!code) {
    return authFailure(request, origin, next, "missing_code", secure);
  }

  const response = NextResponse.redirect(authCallbackLocation(origin, next, "session"));
  response.cookies.set(expireStubSessionCookie(secure));

  const supabase = createSupabaseRouteClient(request, response);
  if (!supabase) {
    return authFailure(request, origin, next, "auth_unconfigured", secure);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return authFailure(request, origin, next, "exchange_failed", secure);
  }

  return response;
}

function authFailure(
  request: Request,
  origin: string,
  next: string | null,
  outcome: "missing_code" | "exchange_failed" | "auth_unconfigured",
  secure: boolean,
) {
  const failed = NextResponse.redirect(authCallbackLocation(origin, next, outcome));
  failed.cookies.set(expireStubSessionCookie(secure));
  for (const cookie of expireSupabaseAuthCookies(request.headers.get("cookie"), secure)) {
    failed.cookies.set(cookie);
  }
  return failed;
}
