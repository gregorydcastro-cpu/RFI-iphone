import { getJob, jobFromRequestId, makeRequestId } from "@/lib/jobs";
import { refreshLiveRoomPack } from "@/lib/livePack";
import { requestBelongsToJob } from "@/lib/packStatus";
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
 * Fresh Procore webhook pull for a website pack view, then read the latest
 * pack (Supabase room_packs if configured, else status JSON). No roles.
 */
export async function POST(request: Request) {
  let body: {
    projectSlug?: unknown;
    job?: unknown;
    requestId?: unknown;
    room?: unknown;
    statusUrl?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const projectSlug =
    asNonEmptyString(body.projectSlug) ?? asNonEmptyString(body.job);
  const room = asNonEmptyString(body.room) ?? "room";
  const requestId = packId(
    asNonEmptyString(body.requestId) ??
      (projectSlug ? makeRequestId(projectSlug, room) : null),
  );

  if (!requestId) {
    return json({ ok: false, error: "requestId is required" }, 400);
  }

  const job =
    (projectSlug ? getJob(projectSlug) : undefined) ??
    jobFromRequestId(requestId);
  if (!job || !requestBelongsToJob(job, requestId)) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }

  const live = await refreshLiveRoomPack({
    requestId,
    job,
    room,
    statusUrl: asNonEmptyString(body.statusUrl) ?? undefined,
  });

  if (!live) {
    return json({ ok: false, error: "Pack not available" }, 404);
  }

  return json({
    ok: true,
    refresh: true,
    mode: live.liveConfigured ? "webhook" : "demo",
    source: live.source,
    demoFallback: live.demoFallback,
    requestId,
    job: job.slug,
    room,
    companyId: job.companyId,
    pulled_at: live.pack.pulled_at,
    revision_stamp: live.pack.revision_stamp,
    pack: live.pack,
  });
}
