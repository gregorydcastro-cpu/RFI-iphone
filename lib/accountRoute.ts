/**
 * Signed-in /account is an internal rewrite to the dashboard so the public
 * /account module never imports Procore, share folders, or billing.
 */

import { isAccountBoardPath, isAccountPath } from "./accountGate.ts";
import { hasSupabaseAuthCookie, isStubUserId } from "./session.ts";
import { createSupabaseProxyClient } from "./supabase/server.ts";
import { type NextRequest, NextResponse } from "next/server";

export { isAccountBoardPath, isAccountPath };

async function hasAccountSession(
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

export function accountBoardRewrite(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/account/board";
  return NextResponse.rewrite(url);
}

/** Signed-out /account/board. Empty of the dashboard; the shell is /account. */
export function sendSignedOutToAccountShell(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/account";
  url.search = "";
  return NextResponse.redirect(url);
}

/** True only when /account has a real Supabase user. A dead cookie stays on the shell. */
export async function shouldServeAccountBoard(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  if (!isAccountPath(request.nextUrl.pathname)) return false;
  return hasAccountSession(request, response);
}

/** True when /account/board has no real session, so the dashboard must not render. */
export async function shouldSendAccountBoardBack(
  request: NextRequest,
  response: NextResponse,
): Promise<boolean> {
  if (!isAccountBoardPath(request.nextUrl.pathname)) return false;
  return !(await hasAccountSession(request, response));
}
