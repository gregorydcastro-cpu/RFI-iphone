import { NextResponse } from "next/server";
import {
  appendCookieHeaders,
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
  appendCookieHeaders(
    response.headers,
    stubSessionCookieWrites(null, secure, domain),
  );
  appendCookieHeaders(
    response.headers,
    procoreLinkedCookieWrites(false, secure, domain),
  );
  appendCookieHeaders(response.headers, [
    oauthStateCookieOptions(null, secure),
  ]);
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
