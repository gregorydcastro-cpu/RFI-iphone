import { runEscalationPass } from "@/lib/fieldNoteAlerts";
import { listNotesForEscalation, saveEscalationStamps } from "@/lib/fieldNotesStore";
import { authorizeCronHeaders, cronSecretConfigured } from "@/lib/shareCronAuth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Safety-note timers. Vercel Cron sends GET with Authorization: Bearer
 * $CRON_SECRET (same secret as weekly share refresh). No new env vars.
 *
 * 15 minutes still open: re-alert foreman and superintendent, escalate to GC.
 * 24 hours mitigated and not closed: reminder.
 * Stamps are idempotent. Routine and priority notes are not loaded.
 * Push is not wired on the current notify path.
 */
async function handle(request: Request) {
  if (!cronSecretConfigured()) {
    return json(
      {
        ok: false,
        error:
          "CRON_SECRET is not set. Add the existing server-only secret on Vercel (never NEXT_PUBLIC_) so safety escalation cannot run unauthenticated.",
      },
      503,
    );
  }
  if (!authorizeCronHeaders(request.headers)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  const listed = await listNotesForEscalation();
  if (!listed.ok) {
    return json({ ok: false, error: listed.error }, 503);
  }
  const nowMs = Date.now();
  const pass = await runEscalationPass({ notes: listed.notes, nowMs });
  const stamped = await saveEscalationStamps(pass.updated);
  return json({
    ok: true,
    checked: listed.notes.length,
    updated: pass.updated.length,
    stamped,
    sent: pass.sent,
    skipped: pass.skipped,
    failed: pass.failed,
    push: "not_wired",
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
