import { type NextRequest, NextResponse } from "next/server";
import { missingFieldLink } from "@/lib/fieldLinkLookup";
import { FIELD_LINK_MISS, FIELD_NOT_FOUND_HEADER } from "@/lib/fieldNotFound";
import { updateSession } from "@/lib/supabase/proxy";

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

/**
 * notFound() from a matched page is an empty __next_error__ shell.
 * A missing invite or pack is rewritten to /_not-found so the root
 * layout renders the link card and the status stays 404.
 */
export async function proxy(request: NextRequest) {
  const session = await updateSession(request);
  let miss = false;
  try {
    miss = await missingFieldLink(request.nextUrl.pathname);
  } catch {
    console.error("[gcfieldlog] link check failed");
  }
  const spoofed = request.headers.has(FIELD_NOT_FOUND_HEADER);
  if (!miss && !spoofed) return session;

  const headers = new Headers(request.headers);
  headers.delete(FIELD_NOT_FOUND_HEADER);
  if (miss) headers.set(FIELD_NOT_FOUND_HEADER, FIELD_LINK_MISS);

  if (!miss) {
    const next = NextResponse.next({ request: { headers } });
    copyCookies(session, next);
    return next;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/_not-found";
  url.search = "";
  const rewritten = NextResponse.rewrite(url, { request: { headers } });
  copyCookies(session, rewritten);
  return rewritten;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
