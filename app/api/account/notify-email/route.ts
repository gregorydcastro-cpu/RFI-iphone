import { NextResponse } from "next/server";
import {
  loadAccountNotifyEmail,
  saveAccountNotifyEmail,
} from "@/lib/accountNotifyEmail";
import { canManageNotifyEmail } from "@/lib/accountRole";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

type NotifyEmailBody = {
  notify_email?: unknown;
};

/**
 * Per-user revision bump destination for the signed-in puller / GC / foreman.
 * GET/PATCH `procore_connections.notify_email` via `upsertNotifyEmail`.
 * Never returns tokens. Never NEXT_PUBLIC_ a notify address.
 */
export async function GET() {
  const session = await readAppSession();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }
  if (!canManageNotifyEmail(session.role)) {
    return json(
      {
        ok: false,
        error:
          "Puller / foreman session required. Sign in as Puller to set a revision bump email.",
      },
      403,
    );
  }

  const record = await loadAccountNotifyEmail(session.userId);
  return json({
    ok: true,
    notify_email: record.notify_email,
    storage: record.storage,
    userId: session.userId,
  });
}

export async function PATCH(request: Request) {
  const session = await readAppSession();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }
  if (!canManageNotifyEmail(session.role)) {
    return json(
      {
        ok: false,
        error:
          "Puller / foreman session required. Sign in as Puller to set a revision bump email.",
      },
      403,
    );
  }

  let body: NotifyEmailBody;
  try {
    body = (await request.json()) as NotifyEmailBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const saved = await saveAccountNotifyEmail(session.userId, body.notify_email);
  if (!saved.ok) {
    return json({ ok: false, error: saved.error }, saved.status);
  }

  return json({
    ok: true,
    notify_email: saved.notify_email,
    storage: saved.storage,
    userId: session.userId,
  });
}
