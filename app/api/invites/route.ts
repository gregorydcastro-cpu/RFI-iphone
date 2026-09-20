import { NextResponse } from "next/server";
import { authAppOrigin } from "@/lib/authHosts";
import {
  canMintInvites,
  invitePublicUrl,
  normalizeInviteeEmail,
  parseInviteRole,
} from "@/lib/invites";
import { mintInvite } from "@/lib/inviteStore";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

type MintBody = {
  role?: unknown;
  invitee_email?: unknown;
  expires_in_days?: unknown;
};

/**
 * Mint a single-use invite. Puller / GC / foreman session required.
 * Role is baked into the token (`viewer` | `full`). Field Log owns the
 * polished picker; this is the complete mint API.
 */
export async function POST(request: Request) {
  const session = await readAppSession();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }
  if (!canMintInvites(session.role)) {
    return json(
      {
        ok: false,
        error: "Puller session required to create invite links.",
      },
      403,
    );
  }

  let body: MintBody;
  try {
    body = (await request.json()) as MintBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const role = parseInviteRole(body.role);
  if (!role) {
    return json({ ok: false, error: "role must be viewer or full." }, 400);
  }

  let expiresInMs: number | null = null;
  if (body.expires_in_days !== undefined && body.expires_in_days !== null) {
    const days = Number(body.expires_in_days);
    if (!Number.isFinite(days) || days <= 0) {
      return json({ ok: false, error: "expires_in_days must be a positive number." }, 400);
    }
    expiresInMs = days * 24 * 60 * 60 * 1000;
  }

  let inviteeEmail: string | null = null;
  if (typeof body.invitee_email === "string" && body.invitee_email.trim()) {
    inviteeEmail = normalizeInviteeEmail(body.invitee_email);
    if (!inviteeEmail) {
      return json({ ok: false, error: "invitee_email must be a valid email." }, 400);
    }
  }

  const minted = await mintInvite({
    role,
    createdBy: session.userId,
    inviteeEmail,
    expiresInMs,
  });
  if (!minted) {
    return json(
      {
        ok: false,
        error:
          "Could not store the invite. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or retry.",
      },
      503,
    );
  }

  const origin = authAppOrigin(request);
  return json({
    ok: true,
    token: minted.row.token,
    role: minted.row.role,
    url: invitePublicUrl(origin, minted.row.token),
    invitee_email: minted.row.invitee_email,
    expires_at: minted.row.expires_at,
    used_at: minted.row.used_at,
    created_by: minted.row.created_by,
    storage: minted.storage,
    single_use: true,
  });
}
