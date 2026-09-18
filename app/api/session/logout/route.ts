import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { oauthStateCookieOptions } from "@/lib/procoreOAuth";
import { stubSessionCookieOptions } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secure = cookieSecureFromRequest(request);
  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set(stubSessionCookieOptions(null, secure));
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  response.cookies.set(oauthStateCookieOptions(null, secure));
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
