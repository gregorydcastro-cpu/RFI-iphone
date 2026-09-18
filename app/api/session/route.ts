import { NextResponse } from "next/server";
import {
  appendCookieHeaders,
  cookieDomainFromRequest,
  cookieSecureFromRequest,
  procoreLinkedCookieWrites,
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

/**
 * Stub login. Any email+role becomes a httpOnly session cookie.
 * Password is accepted by the form UI and ignored here.
 */
export async function POST(request: Request) {
  let json: SessionBody;
  try {
    json = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const email = asEmail(json.email);
  if (!email) {
    return NextResponse.json(
      { ok: false, error: "email is required" },
      { status: 400 },
    );
  }

  const session = createStubSession({
    email,
    role: typeof json.role === "string" ? json.role : "viewer",
  });
  const response = NextResponse.json({
    ok: true,
    userId: session.userId,
    email: session.email,
    role: session.role,
  });
  const secure = cookieSecureFromRequest(request);
  const domain = cookieDomainFromRequest(request);
  appendCookieHeaders(
    response.headers,
    stubSessionCookieWrites(session, secure, domain),
  );
  // Puller is the intent to pull; actual Procore link comes from OAuth.
  appendCookieHeaders(
    response.headers,
    procoreLinkedCookieWrites(false, secure, domain),
  );
  return response;
}
