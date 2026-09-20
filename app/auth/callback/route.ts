import { NextResponse } from "next/server";
import { cookieSecureFromRequest } from "@/lib/auth";
import { authAppOrigin } from "@/lib/authHosts";
import { safeNextPath } from "@/lib/authMessages";
import { expireStubSessionCookie } from "@/lib/stubSession";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * PKCE / magic-link / confirm-email callback.
 * Exchanges `code` for a Supabase session cookie. Never a stub cookie.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = authAppOrigin(request);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const dest = new URL(next, origin);
  const response = NextResponse.redirect(dest);
  const secure = cookieSecureFromRequest(request);
  response.cookies.set(expireStubSessionCookie(secure));

  if (!code) {
    dest.searchParams.set("auth", "error");
    dest.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(dest);
  }

  const supabase = createSupabaseRouteClient(request, response);
  if (!supabase) {
    dest.pathname = "/";
    dest.searchParams.set("auth", "error");
    dest.searchParams.set("reason", "auth_unconfigured");
    return NextResponse.redirect(dest);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const login = new URL("/", origin);
    login.searchParams.set("auth", "error");
    login.searchParams.set("reason", "exchange_failed");
    login.searchParams.set("next", next);
    const failed = NextResponse.redirect(login);
    failed.cookies.set(expireStubSessionCookie(secure));
    return failed;
  }

  return response;
}
