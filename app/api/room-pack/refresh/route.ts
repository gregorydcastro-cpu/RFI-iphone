import { makeRequestId, resolvePullJob } from "@/lib/jobs";
import { loadLiveRoomPack, refreshLiveRoomPack } from "@/lib/livePack";
import { stampRoomPack, type RoomPack } from "@/lib/pack";
import { isRoomPackShape, requestBelongsToJob } from "@/lib/packStatus";
import { PROCORE_BOT_ID } from "@/lib/procoreBot";
import { fieldRoleForRequest } from "@/lib/session.server";
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
 * Puller-only. Try Procore REST with stored tokens, optionally persist
 * pack JSON (bot/ops callback), then read the latest `public.room_packs`
 * row. Bot/catalog is the fallback when tokens or the demo project are
 * missing. Fictional DEMO_JOBS / Maple Point never enqueue a bot wake.
 * Live requestIds resolve from cached room_packs / projectName
 * — DEMO_JOBS is not required.
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

  let body: {
    projectSlug?: unknown;
    job?: unknown;
    projectName?: unknown;
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
  const projectName = asNonEmptyString(body.projectName);
  const requestId = packId(asNonEmptyString(body.requestId));
  const room = asNonEmptyString(body.room) ?? "room";

  let incoming: RoomPack | undefined;
  if (body.pack !== undefined) {
    if (!isRoomPackShape(body.pack)) {
      return json({ ok: false, error: "Invalid pack JSON" }, 400);
    }
    incoming = stampRoomPack(body.pack, { touch: true });
  }

  const named = resolvePullJob({ projectSlug, projectName });
  const resolvedRequestId =
    requestId ??
    (named ? packId(makeRequestId(named.slug, room)) : null) ??
    (projectSlug ? packId(makeRequestId(projectSlug, room)) : null);

  if (!resolvedRequestId) {
    return json(
      { ok: false, error: "job and requestId are required" },
      400,
    );
  }

  if (named && !requestBelongsToJob(named, resolvedRequestId)) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }

  const cached = await loadLiveRoomPack({
    requestId: resolvedRequestId,
    job: named,
    room,
  });
  const job = resolvePullJob({
    projectSlug,
    projectName,
    requestId: resolvedRequestId,
    pack: incoming ?? cached?.pack ?? null,
  });
  if (!job) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }
  const packRequestId = incoming?.request_id ?? cached?.pack.request_id;
  if (
    !requestBelongsToJob(job, resolvedRequestId) &&
    packRequestId !== resolvedRequestId
  ) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }

  const live = await refreshLiveRoomPack({
    requestId: resolvedRequestId,
    job,
    room,
    pack: incoming,
    userId: session?.userId,
  });

  if (!live) {
    return json({ ok: false, error: "Pack not available" }, 404);
  }

  return json({
    ok: true,
    mode: live.source === "procore" || live.supabaseConfigured ? "live" : "demo",
    refresh: true,
    source: live.source,
    pull: live.pull,
    restReason: live.restReason,
    demoFallback: live.demoFallback,
    requestId: resolvedRequestId,
    job: job.slug,
    room,
    pulled_at: live.pack.pulled_at,
    revision_stamp: live.pack.revision_stamp,
    botId: PROCORE_BOT_ID,
    bot: live.bot,
    pack: live.pack,
  });
}
