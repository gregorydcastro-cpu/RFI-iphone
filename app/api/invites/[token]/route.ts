import { NextResponse } from "next/server";
import { previewInvite } from "@/lib/inviteStore";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

type Props = {
  params: Promise<{ token: string }>;
};

/**
 * Public preview. Does not redeem. Omits created_by.
 * status: valid | expired | used | not_found
 */
export async function GET(_request: Request, { params }: Props) {
  const { token } = await params;
  const trimmed = token?.trim() ?? "";
  if (!trimmed) {
    return json({ ok: false, status: "not_found", error: "token is required" }, 400);
  }

  const preview = await previewInvite(trimmed);
  const status = preview.status === "not_found" ? 404 : 200;
  return json(
    {
      ok: preview.status === "valid",
      status: preview.status,
      role: preview.role,
      invitee_email: preview.inviteeEmail,
      expires_at: preview.expiresAt,
      used_at: preview.usedAt,
      storage: preview.storage,
      single_use: true,
    },
    status,
  );
}
