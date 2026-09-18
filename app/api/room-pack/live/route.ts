import { getJob } from "@/lib/jobs";
import { loadLiveRoomPack } from "@/lib/livePack";
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

async function handleLive(input: {
  projectSlug: string | null;
  requestId: string | null;
  room: string | null;
}) {
  const requestId = packId(asNonEmptyString(input.requestId));
  if (!requestId) {
    return json({ ok: false, error: "requestId is required" }, 400);
  }

  const projectSlug = asNonEmptyString(input.projectSlug);
  const job = projectSlug ? getJob(projectSlug) : undefined;
  if (job && !requestBelongsToJob(job, requestId)) {
    return json({ ok: false, error: "Unknown job" }, 404);
  }

  const live = await loadLiveRoomPack({
    requestId,
    job,
    room: input.room ?? undefined,
  });

  if (!live) {
    return json({ ok: false, error: "Pack not available" }, 404);
  }

  return json({
    ok: true,
    mode: live.supabaseConfigured ? "live" : "demo",
    source: live.source,
    demoFallback: live.demoFallback,
    requestId,
    job: job?.slug,
    room: input.room,
    pulled_at: live.pack.pulled_at,
    revision_stamp: live.pack.revision_stamp,
    pack: live.pack,
  });
}

/**
 * Read-only live pack. Viewers allowed. Always no-store.
 * Does not trigger a Procore bot pull.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleLive({
    projectSlug: searchParams.get("job") ?? searchParams.get("projectSlug"),
    requestId: searchParams.get("requestId"),
    room: searchParams.get("room"),
  });
}

export async function POST(request: Request) {
  let body: {
    projectSlug?: unknown;
    job?: unknown;
    requestId?: unknown;
    room?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  return handleLive({
    projectSlug: asNonEmptyString(body.projectSlug) ?? asNonEmptyString(body.job),
    requestId: asNonEmptyString(body.requestId),
    room: asNonEmptyString(body.room),
  });
}
