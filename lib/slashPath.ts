import { type NextRequest, NextResponse } from "next/server";
import { canonicalSlashPath } from "./canonicalSlashPath.ts";

/**
 * Next trims a trailing slash with a 308 before the proxy runs, unless
 * skipTrailingSlashRedirect is set. The not-found document has to reach
 * the proxy. This sends every other slashed path to the canonical URL.
 */
export function slashToCanonical(request: NextRequest): NextResponse | null {
  const nextPath = canonicalSlashPath(request.nextUrl.pathname);
  if (!nextPath) return null;
  // A NextURL keeps the request's trailing slash when stringified.
  // A plain URL does not, so /pricing/ lands on /pricing.
  const url = new URL(request.url);
  url.pathname = nextPath;
  url.hash = "";
  return NextResponse.redirect(url, 308);
}
