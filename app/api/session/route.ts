import { NextResponse } from "next/server";
import {
  applyHttpCookies,
  cookieDomainFromRequest,
  cookieSecureFromRequest,
  procoreLinkedCookieWrites,
  safeNextPath,
} from "@/lib/auth";
import {
  createStubSession,
  parseStubSessionFromCookieHeader,
  stubSessionCookieWrites,
} from "@/lib/stubSession";

export const dynamic = "force-dynamic";

/** Current stub session for the httpOnly cookie (Share recovery + smoke). */
export async function GET(request: Request) {
  const session = parseStubSessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    return NextResponse.json(
      { ok: false, signedIn: false },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      signedIn: true,
      userId: session.userId,
      email: session.email,
      role: session.role,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

type SessionBody = {
  email?: unknown;
  role?: unknown;
};

function asEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** 200 HTML + Set-Cookie. 303 redirects drop the cookie in Chrome's jar. */
function loginInterstitial(nextPath: string): NextResponse {
  const href = escapeHtmlAttr(nextPath);
  const assign = JSON.stringify(nextPath);
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${href}"><title>GC Field Log</title></head><body><p>Entering dashboard…</p><script>location.replace(${assign})</script></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

/**
 * Stub login. Any email+role becomes a httpOnly session cookie.
 * Password is accepted by the form UI and ignored here.
 *
 * Browser login is a document form POST so Chrome stores Set-Cookie
 * (fetch() often drops the jar). JSON POST remains for API/smoke.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  let email: string | null = null;
  let role = "viewer";
  let nextPath = "/jobs";

  if (isForm) {
    const form = await request.formData();
    email = asEmail(form.get("email"));
    const formRole = form.get("role");
    role = typeof formRole === "string" ? formRole : "viewer";
    nextPath = safeNextPath(form.get("next"));
  } else {
    let json: SessionBody;
    try {
      json = (await request.json()) as SessionBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON" },
        { status: 400 },
      );
    }
    email = asEmail(json.email);
    role = typeof json.role === "string" ? json.role : "viewer";
  }

  if (!email) {
    if (isForm) {
      return loginInterstitial("/?error=session");
    }
    return NextResponse.json(
      { ok: false, error: "email is required" },
      { status: 400 },
    );
  }

  const session = createStubSession({ email, role });
  const secure = cookieSecureFromRequest(request);
  const domain = cookieDomainFromRequest(request);
  const response = isForm
    ? loginInterstitial(nextPath)
    : NextResponse.json({
        ok: true,
        userId: session.userId,
        email: session.email,
        role: session.role,
      });
  applyHttpCookies(
    response,
    stubSessionCookieWrites(session, secure, domain),
  );
  // Puller is the intent to pull; actual Procore link comes from OAuth.
  applyHttpCookies(
    response,
    procoreLinkedCookieWrites(false, secure, domain),
  );
  return response;
}
