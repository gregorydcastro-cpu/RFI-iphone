import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Share + stub session must never be served from a shared cache.
 * The httpOnly cookie is Path=/ (and Domain=gcfieldlog.com in production).
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Vary", "Cookie");
  if (request.nextUrl.pathname.startsWith("/share")) {
    response.headers.set("x-gcfieldlog-session-route", "share");
  }
  return response;
}

export const config = {
  matcher: [
    "/share",
    "/share/:path*",
    "/api/share/:path*",
    "/api/session/:path*",
  ],
};
