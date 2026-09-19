import { NextResponse } from "next/server";
import { cookieSecureFromRequest, procoreLinkedCookieOptions } from "@/lib/auth";
import { fieldRoleFromInviteRole, normalizeInviteeEmail } from "@/lib/invites";
import { redeemInvite } from "@/lib/inviteStore";
import { createStubSession, stubSessionCookieOptions } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

type Props = {
  params: Promise<{ token: string }>;
};

type RedeemBody = {
  email?: unknown;
};

/**
 * Single-use redeem. Writes the baked invite role onto the stub session
 * (`viewer` | `full` — `full` is not rewritten to puller). Does not mark
 * Procore linked — full crew still Connect Procore with their own login.
 */
export async function POST(request: Request, { params }: Props) {
  const { token } = await params;
  const trimmed = token?.trim() ?? "";
  if (!trimmed) {
    return json({ ok: false, status: "not_found", error: "token is required" }, 400);
  }

  let body: RedeemBody;
  try {
    body = (await request.json()) as RedeemBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const email = normalizeInviteeEmail(body.email);
  if (!email) {
    return json({ ok: false, error: "email is required" }, 400);
  }

  const result = await redeemInvite({ token: trimmed, email });
  if (!result.ok) {
    const status =
      result.status === "not_found"
        ? 404
        : result.status === "email_mismatch"
          ? 403
          : 409;
    const message =
      result.status === "expired"
        ? "This invite has expired."
        : result.status === "used"
          ? "This invite has already been used."
          : result.status === "email_mismatch"
            ? "This invite is for a different email."
            : "Invite not found.";
    return json({ ok: false, status: result.status, error: message }, status);
  }

  const session = createStubSession({
    email,
    role: fieldRoleFromInviteRole(result.row.role),
  });
  const response = NextResponse.json(
    {
      ok: true,
      status: "redeemed",
      userId: session.userId,
      email: session.email,
      role: session.role,
      invite_role: result.row.role,
      expires_at: result.row.expires_at,
      used_at: result.row.used_at,
      storage: result.storage,
      single_use: true,
    },
    { headers: NO_STORE },
  );
  const secure = cookieSecureFromRequest(request);
  response.cookies.set(stubSessionCookieOptions(session, secure));
  response.cookies.set(procoreLinkedCookieOptions(false, secure));
  return response;
}
