import { authorFromSessionEmail } from "@/lib/crew";
import { canWriteFieldLog } from "@/lib/invites";
import { updateFieldNote } from "@/lib/fieldNotesStore";
import {
  isHazardType,
  isNoteSeverity,
  isNoteStatus,
  type NotePatch,
} from "@/lib/fieldNotes";
import { fieldRoleForRequest } from "@/lib/session.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function asOptionalText(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

/**
 * Status, severity, and the safety downgrade reason.
 * Downgrade from safety is rejected here unless a reason is present.
 * The database trigger rejects it again.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { session, role } = await fieldRoleForRequest(request);
  if (!session) return json({ ok: false, error: "Sign in first." }, 401);
  if (!canWriteFieldLog(role.role)) {
    return json({ ok: false, error: "This login is view-only." }, 403);
  }
  const { id } = await context.params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: "Check that note." }, 400);
  }
  if (!raw || typeof raw !== "object") {
    return json({ ok: false, error: "Check that note." }, 400);
  }
  const body = raw as Record<string, unknown>;
  const patch: NotePatch = {};
  if (body.severity !== undefined) {
    if (!isNoteSeverity(body.severity)) {
      return json({ ok: false, error: "Pick routine, priority, or safety." }, 400);
    }
    patch.severity = body.severity;
  }
  if (body.hazard_type !== undefined) {
    if (body.hazard_type === null || body.hazard_type === "") patch.hazard_type = null;
    else if (!isHazardType(body.hazard_type)) {
      return json({ ok: false, error: "Pick the hazard." }, 400);
    } else patch.hazard_type = body.hazard_type;
  }
  if (body.status !== undefined) {
    if (!isNoteStatus(body.status)) {
      return json({ ok: false, error: "Pick a status." }, 400);
    }
    patch.status = body.status;
  }
  if (body.resolution_note !== undefined) {
    const resolution = asOptionalText(body.resolution_note);
    if (resolution === undefined) {
      return json({ ok: false, error: "Check the resolution note." }, 400);
    }
    patch.resolution_note = resolution;
  }
  if (body.severity_change_reason !== undefined) {
    const reason = asOptionalText(body.severity_change_reason);
    if (reason === undefined) {
      return json({ ok: false, error: "Say why this is no longer a safety note." }, 400);
    }
    patch.severity_change_reason = reason;
  }
  if (body.symptoms_reported !== undefined) {
    if (typeof body.symptoms_reported !== "boolean") {
      return json({ ok: false, error: "Check symptoms." }, 400);
    }
    patch.symptoms_reported = body.symptoms_reported;
  }
  if (body.stop_work !== undefined) {
    if (typeof body.stop_work !== "boolean") {
      return json({ ok: false, error: "Check stop work." }, 400);
    }
    patch.stop_work = body.stop_work;
  }
  if (body.body !== undefined) {
    if (typeof body.body !== "string") {
      return json({ ok: false, error: "Write what happened." }, 400);
    }
    patch.body = body.body;
  }
  if (body.room !== undefined) {
    const room = asOptionalText(body.room);
    if (room === undefined) return json({ ok: false, error: "Check the room." }, 400);
    patch.room = room;
  }
  if (body.location !== undefined) {
    const location = asOptionalText(body.location);
    if (location === undefined) {
      return json({ ok: false, error: "Check the location." }, 400);
    }
    patch.location = location;
  }
  if (body.photos !== undefined) {
    if (!Array.isArray(body.photos) || body.photos.some((item) => typeof item !== "string")) {
      return json({ ok: false, error: "Photo needs a short name or link." }, 400);
    }
    patch.photos = body.photos;
  }

  const author = authorFromSessionEmail(session.email);
  const saved = await updateFieldNote({
    id,
    patch,
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
