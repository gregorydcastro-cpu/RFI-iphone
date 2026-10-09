/**
 * Signed-in /time is an internal rewrite to the clock page so the public
 * /time module never imports the roster or the punch UI.
 */

import { isTimeBoardPath, isTimeClockPath } from "./timeGate.ts";
import { hasSupabaseAuthCookie, isStubUserId } from "./session.ts";
import { createSupabaseProxyClient } from "./supabase/server.ts";
import { type NextRequest, NextResponse } from "next/server";

export { isTimeBoardPath, isTimeClockPath };

async function hasTimeSession(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  const names = request.cookies.getAll().map((cookie) => cookie.name);
  if (!hasSupabaseAuthCookie(names)) return false;
  const supabase = createSupabaseProxyClient(request, response);
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.id || isStubUserId(user.id)) return false;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  return email.includes("@");
}

export function timeBoardRewrite(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/time/board";
  return NextResponse.rewrite(url);
}

/** Signed-out /time/board. Empty of the clock module; the shell is /time. */
export function sendSignedOutToTimeShell(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/time";
  url.search = "";
  return NextResponse.redirect(url);
}

/** True only when /time has a real Supabase user. A dead cookie stays on the shell. */
export async function shouldServeTimeBoard(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  if (!isTimeClockPath(request.nextUrl.pathname)) return false;
  return hasTimeSession(request, response);
}

/** True when /time/board has no real session, so the clock page must not render. */
export async function shouldSendTimeBoardBack(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  if (!isTimeBoardPath(request.nextUrl.pathname)) return false;
  return !(await hasTimeSession(request, response));
}
