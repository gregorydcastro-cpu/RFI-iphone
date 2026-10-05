import { NextResponse } from "next/server";
import { authAppOrigin } from "@/lib/authHosts";
import {
  crewSendBanner,
  crewSendHttpStatus,
  classifyCrewSendDraft,
  inviteMail,
  type CrewSendCode,
} from "@/lib/crewSendField";
import { sendFieldEmail } from "@/lib/fieldEmail";
import { canMintInvites, invitePublicUrl } from "@/lib/invites";
import { mintInvite } from "@/lib/inviteStore";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function fail(
  code: CrewSendCode,
  status?: number,
  detail?: "signed_out" | "role" | "job",
) {
  const banner = crewSendBanner("invite", code, detail);
  return json(
    {
      ok: false,
      code,
      error: banner.message,
      ...(detail ? { detail } : {}),
    },
    status ?? crewSendHttpStatus(code),
  );
}

type MintBody = {
  role?: unknown;
  invitee_email?: unknown;
  expires_in_days?: unknown;
  job?: unknown;
};

/**
 * Mint a single-use invite. Puller / GC / foreman session required.
 * When an email is included, the invite is emailed. A mail failure is
 * not a 200. A link with no email is generated only — nothing is sent.
 */
export async function POST(request: Request) {
  const session = await readAppSession();
  if (!session) {
    return fail("forbidden", 401, "signed_out");
  }
  if (!canMintInvites(session.role)) {
    return fail("forbidden", 403);
  }

  let body: MintBody;
  try {
    body = (await request.json()) as MintBody;
  } catch {
    return fail("invalid");
  }

  const draft = classifyCrewSendDraft({
    kind: "invite",
    recipient: body.invitee_email ?? "",
    role: body.role,
    job: body.job ?? "",
    emailOptional: true,
  });
  if (!draft.ok) {
    if ("empty" in draft) return fail("invalid");
    return fail(draft.banner.code, undefined, draft.banner.detail);
  }

  let expiresInMs: number | null = null;
  if (body.expires_in_days !== undefined && body.expires_in_days !== null) {
    const days = Number(body.expires_in_days);
    if (!Number.isFinite(days) || days <= 0) return fail("invalid");
    expiresInMs = days * 24 * 60 * 60 * 1000;
  }

  const minted = await mintInvite({
    role: draft.role,
    createdBy: session.userId,
    inviteeEmail: draft.recipient,
    expiresInMs,
  });
  if (!minted) {
    console.info("[gcfieldlog] invite mint failed");
    return fail("unavailable");
  }

  const origin = authAppOrigin(request);
  const url = invitePublicUrl(origin, minted.row.token);
  const payload = {
    token: minted.row.token,
    role: minted.row.role,
    url,
    invitee_email: minted.row.invitee_email,
    expires_at: minted.row.expires_at,
    used_at: minted.row.used_at,
    created_by: minted.row.created_by,
    storage: minted.storage,
    single_use: true,
  };

  if (!draft.recipient) {
    return json({ ok: true, sent: false, ...payload });
  }

  const mail = inviteMail({
    url,
    role: draft.role,
    jobName: draft.job?.name ?? null,
  });
  const sent = await sendFieldEmail({
    to: draft.recipient,
    subject: mail.subject,
    text: mail.text,
  });
  if (!sent.ok) {
    console.info("[gcfieldlog] invite email failed", { code: sent.code });
    return fail(sent.code);
  }

  return json({ ok: true, sent: true, ...payload });
}
