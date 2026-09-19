import { makeRequestId, resolvePullJob } from "@/lib/jobs";
import { refreshLiveRoomPack } from "@/lib/livePack";
import { PROCORE_BOT_ID } from "@/lib/procoreBot";
import { fieldRoleForRequest } from "@/lib/session.server";
import { getSupabaseConfig } from "@/lib/supabaseRoomPack";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type RoomPackRequestJson = {
  projectSlug?: unknown;
  projectName?: unknown;
  room?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Request a room pack from `/jobs/[projectSlug]`.
 *
 * Puller only. Tries Procore REST with stored OAuth tokens, then
 * wakes the Procore bot + reads `public.room_packs` for non-demo jobs.
 * Fictional DEMO_JOBS / Maple Point never wake. Does not call
 * the deleted webhook. Local demo when Supabase env is unset.
 * Job identity: demo slug, exact projectName, or allowlist — not
 * DEMO_JOBS-only.
 */
export async function POST(request: Request) {
  const { session, role } = await fieldRoleForRequest(request);
  if (!role.procoreLinked) {
    return json(
      {
        ok: false,
        error:
          "Puller role required. Connect Procore (procoreLinked cookie after OAuth, or x-procore-linked header).",
      },
      403,
    );
  }

  let body: RoomPackRequestJson;
  try {
    body = (await request.json()) as RoomPackRequestJson;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const projectSlug = asNonEmptyString(body.projectSlug);
  const projectName = asNonEmptyString(body.projectName);
  const room = asNonEmptyString(body.room);
  if ((!projectSlug && !projectName) || !room) {
    return json(
      { ok: false, error: "projectSlug or projectName, and room, are required" },
      400,
    );
  }

  const job = resolvePullJob({ projectSlug, projectName });
  if (!job) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }

  const requestId = makeRequestId(job.slug, room);
  const supabaseConfigured = Boolean(getSupabaseConfig());
  const live = await refreshLiveRoomPack({
    requestId,
    job,
    room,
    userId: session?.userId,
  });

  const pulledLive = live?.source === "procore" || live?.source === "supabase";
  return json({
    ok: true,
    mode: pulledLive || supabaseConfigured ? ("live" as const) : ("demo" as const),
    requestId,
    job: job.slug,
    room,
    refresh: true,
    source: live?.source ?? "none",
    pull: live?.pull ?? "none",
    restReason: live?.restReason,
    pulled_at: live?.pack.pulled_at,
    revision_stamp: live?.pack.revision_stamp,
    botId: PROCORE_BOT_ID,
    bot: live?.bot,
    procoreLinked: true,
  });
}
