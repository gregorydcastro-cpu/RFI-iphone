import { NextResponse } from "next/server";
import { procoreLinkedCookieOptions } from "@/lib/auth";
import { oauthStateCookieOptions } from "@/lib/procoreOAuth";
import { stubSessionCookieOptions } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL("/", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set(stubSessionCookieOptions(null));
  response.cookies.set(procoreLinkedCookieOptions(false));
  response.cookies.set(oauthStateCookieOptions(null));
  return response;
}

export async function POST(request: Request) {
  return GET(request);
}
