import { NextResponse } from "next/server";
import { authAppOrigin } from "@/lib/authHosts";
import {
  crewSendBanner,
  crewSendHttpStatus,
  classifyCrewSendDraft,
  shareLinkMail,
  sharePortalUrl,
  type CrewSendCode,
} from "@/lib/crewSendField";
import { sendFieldEmail } from "@/lib/fieldEmail";
import { canMintInvites } from "@/lib/invites";
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
  const banner = crewSendBanner("share", code, detail);
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

type LinkBody = {
  recipient?: unknown;
  role?: unknown;
  job?: unknown;
};

/**
 * Email a share-portal link for a fictional demo job.
 * Success is only a confirmed send. A missing mailer or a non-2xx
 * from the sender is email_failed, not 200.
 */
export async function POST(request: Request) {
  const session = await readAppSession();
  if (!session) return fail("forbidden", 401, "signed_out");
  if (!canMintInvites(session.role)) return fail("forbidden", 403);

  let body: LinkBody;
  try {
    body = (await request.json()) as LinkBody;
  } catch {
    return fail("invalid");
  }

  const draft = classifyCrewSendDraft({
    kind: "share",
    recipient: body.recipient ?? "",
    role: body.role,
    job: body.job ?? "",
  });
  if (!draft.ok) {
    if ("empty" in draft) return fail("invalid");
    return fail(draft.banner.code, undefined, draft.banner.detail);
  }
  if (!draft.recipient || !draft.job) return fail("invalid");

  const url = sharePortalUrl(authAppOrigin(request), draft.job.slug);
  if (!url) {
    console.info("[gcfieldlog] share link did not generate");
    return fail("unavailable");
  }

  const mail = shareLinkMail({
    url,
    role: draft.role,
    jobName: draft.job.name,
  });
  const sent = await sendFieldEmail({
    to: draft.recipient,
    subject: mail.subject,
    text: mail.text,
  });
  if (!sent.ok) {
    console.info("[gcfieldlog] share link email failed", { code: sent.code });
    return fail(sent.code);
  }

  return json({ ok: true, sent: true, url });
}
