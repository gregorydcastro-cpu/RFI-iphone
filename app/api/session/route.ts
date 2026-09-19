import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { fieldRoleFromInviteRole } from "@/lib/invites";
import { fieldRoleFromRedeemedEmail } from "@/lib/inviteStore";
import { createStubSession, stubSessionCookieOptions } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

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

  const invited = await fieldRoleFromRedeemedEmail(email);
  const session = createStubSession({
    email,
    role: invited
      ? fieldRoleFromInviteRole(invited)
      : typeof json.role === "string"
        ? json.role
        : "viewer",
  });
  const response = NextResponse.json({
    ok: true,
    userId: session.userId,
    email: session.email,
    role: session.role,
  });
  const secure = cookieSecureFromRequest(request);
  const sessionCookie = stubSessionCookieOptions(session, secure);
  response.cookies.set(sessionCookie);
  // Puller is the intent to pull; actual Procore link comes from OAuth.
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  return response;
}
