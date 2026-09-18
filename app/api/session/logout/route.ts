import { NextResponse } from "next/server";
import {
  applyHttpCookies,
  cookieDomainFromRequest,
  cookieSecureFromRequest,
  procoreLinkedCookieWrites,
} from "@/lib/auth";
import { oauthStateCookieOptions } from "@/lib/procoreOAuth";
import { stubSessionCookieWrites } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secure = cookieSecureFromRequest(request);
  const domain = cookieDomainFromRequest(request);
  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url);
  applyHttpCookies(response, stubSessionCookieWrites(null, secure, domain));
  applyHttpCookies(response, procoreLinkedCookieWrites(false, secure, domain));
  applyHttpCookies(response, [oauthStateCookieOptions(null, secure)]);
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
