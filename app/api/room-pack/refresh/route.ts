import { readFieldRoleFromRequest } from "@/lib/auth";
import { getJob, jobFromRequestId, makeRequestId } from "@/lib/jobs";
import { refreshLiveRoomPack } from "@/lib/livePack";
import { stampRoomPack, type RoomPack } from "@/lib/pack";
import { isRoomPackShape, requestBelongsToJob } from "@/lib/packStatus";
import { PROCORE_BOT_ID } from "@/lib/procoreBot";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const PACK_ID = /^[a-zA-Z0-9._-]+$/;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function packId(value: string | null): string | null {
  if (!value || !PACK_ID.test(value)) return null;
  return value;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Puller-only. Request a Procore bot refresh, optionally persist pack JSON
 * (bot/ops callback), then read the latest `public.room_packs` row.
 */
export async function POST(request: Request) {
  const role = readFieldRoleFromRequest(request);
  if (!role.procoreLinked) {
    return json(
      {
        ok: false,
        error:
          "Puller role required. Link a Procore account (procoreLinked cookie or x-procore-linked header).",
      },
      403,
    );
  }

  let body: {
    projectSlug?: unknown;
    job?: unknown;
    requestId?: unknown;
    room?: unknown;
    pack?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const projectSlug =
    asNonEmptyString(body.projectSlug) ?? asNonEmptyString(body.job);
  const requestId = packId(asNonEmptyString(body.requestId));
  const room = asNonEmptyString(body.room) ?? "room";

  const resolvedRequestId =
    requestId ??
    (projectSlug ? packId(makeRequestId(projectSlug, room)) : null);

  if (!resolvedRequestId) {
    return json(
      { ok: false, error: "job and requestId are required" },
      400,
    );
  }

  const job =
    (projectSlug ? getJob(projectSlug) : undefined) ??
    jobFromRequestId(resolvedRequestId);
  if (!job || !requestBelongsToJob(job, resolvedRequestId)) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }

  let incoming: RoomPack | undefined;
  if (body.pack !== undefined) {
    if (!isRoomPackShape(body.pack)) {
      return json({ ok: false, error: "Invalid pack JSON" }, 400);
    }
    incoming = stampRoomPack(body.pack, { touch: true });
  }

  const live = await refreshLiveRoomPack({
    requestId: resolvedRequestId,
    job,
    room,
    pack: incoming,
  });

  if (!live) {
    return json({ ok: false, error: "Pack not available" }, 404);
  }

  return json({
    ok: true,
    mode: live.supabaseConfigured ? "live" : "demo",
    refresh: true,
    source: live.source,
    demoFallback: live.demoFallback,
    requestId: resolvedRequestId,
    job: job.slug,
    room,
    pulled_at: live.pack.pulled_at,
    revision_stamp: live.pack.revision_stamp,
    botId: PROCORE_BOT_ID,
    pack: live.pack,
  });
}
