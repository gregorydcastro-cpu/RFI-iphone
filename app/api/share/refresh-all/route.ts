import { notifyMikeOnBumps } from "@/lib/notifyMike";
import { PROCORE_BOT_ID, requestProcoreBotRefresh } from "@/lib/procoreBot";
import { MAPLE_POINT_PROJECT_NAME, MAPLE_POINT_REQUEST_ID } from "@/lib/shareCatalog";
import { refreshAllPinnedSheets } from "@/lib/shareStore";
import { fieldRoleForRequest } from "@/lib/session.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Puller-only manual "Refresh all" for Mike's pinned sheets.
 *
 * Walks `pinned_sheets` for the signed-in owner, compares each sheet's
 * known pack rev to `sheet_revision_cache`, and updates last_seen_rev when
 * the rev bumped. Does not call Procore REST. Does not download PDFs.
 * Weekly automation is GET/POST `/api/share/weekly-refresh` (CRON_SECRET).
 * Emails this owner's notify_email after a persisted bump. Missing
 * notify_email skips (refresh still succeeds).
 */
export async function POST(request: Request) {
  const { session, role } = await fieldRoleForRequest(request);
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }
  const puller = role.procoreLinked || session.role === "puller";
  if (!puller) {
    return json(
      {
        ok: false,
        error:
          "Puller role required. Sign in as a puller, or Connect Procore (procoreLinked cookie after OAuth, or x-procore-linked header).",
      },
      403,
    );
  }

  const bot = await requestProcoreBotRefresh({
    projectName: MAPLE_POINT_PROJECT_NAME,
    room: "101",
    requestId: MAPLE_POINT_REQUEST_ID,
    reason: "refresh-all",
  });

  const { plan, storage, bumps, errors } = await refreshAllPinnedSheets(session.userId);
  const notify = await notifyMikeOnBumps(bumps, errors);

  return json({
    ok: true,
    accepted: true,
    stub: false,
    implemented: true,
    refresh: plan.scanned === 0 ? "empty" : "complete",
    weeklyCron: false,
    notify,
    storage,
    scanned: plan.scanned,
    bumped: plan.bumped,
    unchanged: plan.unchanged,
    missing: plan.missing,
    bumps,
    items: plan.items,
    botId: PROCORE_BOT_ID,
    bot,
    note:
      "Force refresh compared this owner's pinned sheets to known pack revs and updated sheet_revision_cache. Weekly cron is GET/POST /api/share/weekly-refresh. The folder owner is emailed only when a bump persists and notify_email is set.",
  });
}
