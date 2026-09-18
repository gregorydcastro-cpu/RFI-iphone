import { loadLiveRoomPack } from "@/lib/livePack";
import { getJob } from "@/lib/jobs";
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
 * Alias of `/api/room-pack/live` — latest `public.room_packs` row, no-store.
 * Viewers may read. Does not trigger a pull. Does not call the deleted webhook.
 */
async function handleStatus(input: {
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
    state: live.pack.status === "ready" ? "ready" : live.pack.status,
    source: live.source,
    pull: live.pull,
    demoFallback: live.demoFallback,
    poll: false,
    unconfigured: !live.supabaseConfigured,
    pulled_at: live.pack.pulled_at,
    revision_stamp: live.pack.revision_stamp,
    pack: live.pack,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleStatus({
    projectSlug: searchParams.get("job") ?? searchParams.get("projectSlug"),
    requestId: searchParams.get("requestId"),
    room: searchParams.get("room"),
  });
}

export async function POST(request: Request) {
  let jsonBody: {
    projectSlug?: unknown;
    job?: unknown;
    requestId?: unknown;
    room?: unknown;
  };
  try {
    jsonBody = (await request.json()) as typeof jsonBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  return handleStatus({
    projectSlug:
      asNonEmptyString(jsonBody.projectSlug) ?? asNonEmptyString(jsonBody.job),
    requestId: asNonEmptyString(jsonBody.requestId),
    room: asNonEmptyString(jsonBody.room),
  });
}
