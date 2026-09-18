import { PROCORE_BOT_ID, requestProcoreBotRefresh } from "@/lib/procoreBot";
import { MAPLE_POINT_PROJECT_NAME, MAPLE_POINT_REQUEST_ID } from "@/lib/shareCatalog";
import {
  authorizeCronHeaders,
  cronSecretConfigured,
  runWeeklyShareRefresh,
} from "@/lib/shareCron";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Weekly rev-only re-pull for every pinned share sheet.
 *
 * Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`.
 * Manual ops can POST the same path with that header or `x-cron-secret`.
 * Never NEXT_PUBLIC_ the secret. Weekly path stays catalog + bot
 * (no per-user token). Live REST is on connected puller pack routes.
 * Emails each pin owner's notify_email after a persisted bump. Missing
 * notify_email skips (refresh still succeeds).
 */
async function handle(request: Request) {
  if (!cronSecretConfigured()) {
    return json(
      {
        ok: false,
        error:
          "CRON_SECRET is not set. Add a server-only secret on Vercel (never NEXT_PUBLIC_) so weekly refresh cannot run unauthenticated.",
      },
      503,
    );
  }
  if (!authorizeCronHeaders(request.headers)) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  await requestProcoreBotRefresh({
    projectName: MAPLE_POINT_PROJECT_NAME,
    room: "101",
    requestId: MAPLE_POINT_REQUEST_ID,
  });

  const summary = await runWeeklyShareRefresh();
  return json(
    {
      ...summary,
      botId: PROCORE_BOT_ID,
    },
    summary.ok ? 200 : 503,
  );
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
