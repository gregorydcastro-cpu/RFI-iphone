import { type NextRequest, NextResponse } from "next/server";
import { missingFieldLink } from "@/lib/fieldLinkLookup";
import {
  isLinkMissRender,
  linkMissPassThroughHeaders,
  loadLinkMissDocument,
  stripFieldNotFoundHeader,
} from "@/lib/fieldLinkResponse";
import { FIELD_NOT_FOUND_HEADER } from "@/lib/fieldNotFound";
import { updateSession } from "@/lib/supabase/proxy";

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

/**
 * notFound() from a matched invite or pack page is an empty __next_error__
 * shell. The link card is the root not-found page (/_not-found) inside the
 * root layout.
 *
 * Rewriting the request onto /_not-found keeps HTTP 200 on Vercel. That path is
 * a real page render (x-matched-path: /_not-found, x-vercel-cache: MISS), so
 * the platform does not apply the 404 it uses for an unmatched URL such as
 * /nope. next start still reports 404 when the final pathname is /_not-found.
 * This proxy renders that same document, then returns it as a finished
 * response with status 404. It does not rewrite.
 */
export async function proxy(request: NextRequest) {
  const session = await updateSession(request);

  if (isLinkMissRender(request.nextUrl.pathname, request.headers)) {
    const next = NextResponse.next({
      request: { headers: linkMissPassThroughHeaders(request.headers) },
    });
    copyCookies(session, next);
    return next;
  }

  let miss = false;
  try {
    miss = await missingFieldLink(request.nextUrl.pathname);
  } catch {
    console.error("[gcfieldlog] link check failed");
  }

  const spoofed = request.headers.has(FIELD_NOT_FOUND_HEADER);
  if (!miss && !spoofed) return session;

  if (!miss) {
    const next = NextResponse.next({
      request: { headers: stripFieldNotFoundHeader(request.headers) },
    });
    copyCookies(session, next);
    return next;
  }

  const document = await loadLinkMissDocument({
    requestUrl: request.nextUrl.toString(),
    requestHeaders: request.headers,
    method: request.method,
  });
  const response = new NextResponse(document.body, {
    status: document.status,
    headers: document.headers,
  });
  copyCookies(session, response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
