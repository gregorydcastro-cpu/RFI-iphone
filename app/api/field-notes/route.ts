import { authorFromSessionEmail } from "@/lib/crew";
import { canWriteFieldLog } from "@/lib/invites";
import { createFieldNote, listFieldNotes } from "@/lib/fieldNotesStore";
import { isFieldNoteJob } from "@/lib/fieldNotes";
import { fieldRoleForRequest } from "@/lib/session.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * One note feed for a fictional demo job.
 * Safety is a severity. Creating severity=safety alerts the foreman.
 * Routine and priority do not alert. No flag-immediately field.
 */
export async function GET(request: Request) {
  const { session } = await fieldRoleForRequest(request);
  if (!session) return json({ ok: false, error: "Sign in first." }, 401);
  const job = new URL(request.url).searchParams.get("job")?.trim() ?? "";
  if (!isFieldNoteJob(job)) {
    return json({ ok: false, error: "Notes are on Maple Point and Cedar Ridge." }, 404);
  }
  const listed = await listFieldNotes(job);
  if (!listed.ok) {
    return json({ ok: false, error: listed.error, code: listed.code }, 503);
  }
  return json({ ok: true, storage: listed.storage, notes: listed.notes });
}

export async function POST(request: Request) {
  const { session, role } = await fieldRoleForRequest(request);
  if (!session) return json({ ok: false, error: "Sign in first." }, 401);
  if (!canWriteFieldLog(role.role)) {
    return json({ ok: false, error: "This login is view-only." }, 403);
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "Write what happened." }, 400);
  }
  const author = authorFromSessionEmail(session.email);
  const saved = await createFieldNote({
    raw,
    actor: { userId: session.userId, name: author.name },
  });
  if (!saved.ok) return json({ ok: false, error: saved.error, code: saved.code }, saved.status);
  return json({
    ok: true,
    storage: saved.storage,
    note: saved.note,
    alerts: saved.report,
  });
}
