import { type NextRequest, NextResponse } from "next/server";
import { cookieSecureFromRequest } from "../auth";
import { expireStubSessionCookie } from "../stubSession";
import { createSupabaseProxyClient } from "./server";

/**
 * Refresh the Supabase Auth cookie and drop leftover stub cookies.
 * Always return this response (or a copy that includes its cookies).
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const supabase = createSupabaseProxyClient(request, response);
  if (supabase) {
    await supabase.auth.getClaims();
  }
  response.cookies.set(expireStubSessionCookie(cookieSecureFromRequest(request)));
  return response;
}
