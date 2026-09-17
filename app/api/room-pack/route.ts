import { getJob, makeRequestId } from "@/lib/jobs";
import {
  buildRoomPackWebhookPayload,
  getProcoreRoomPackWebhookConfig,
  postRoomPackWebhook,
} from "@/lib/procoreRoomPack";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RoomPackRequestJson = {
  projectSlug?: unknown;
  room?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Request a room pack from `/jobs/[projectSlug]`.
 *
 * When both lowercase Vercel env keys are set, POSTs to the Procore webhook
 * and returns as soon as the webhook accepts. Otherwise local demo (no POST).
 */
export async function POST(request: Request) {
  let json: RoomPackRequestJson;
  try {
    json = (await request.json()) as RoomPackRequestJson;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const projectSlug = asNonEmptyString(json.projectSlug);
  const room = asNonEmptyString(json.room);
  if (!projectSlug || !room) {
    return NextResponse.json(
      { ok: false, error: "projectSlug and room are required" },
      { status: 400 },
    );
  }

  const job = getJob(projectSlug);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Unknown job" },
      { status: 404 },
    );
  }

  const requestId = makeRequestId(job.slug, room);
  const config = getProcoreRoomPackWebhookConfig();

  if (!config) {
    return NextResponse.json({
      ok: true,
      mode: "demo" as const,
      requestId,
      job: job.slug,
      room,
      accepted: false,
    });
  }

  const payload = buildRoomPackWebhookPayload({
    projectName: job.name,
    room,
    requestId,
  });

  const result = await postRoomPackWebhook(config, payload);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Room pack request was not accepted" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "webhook" as const,
    requestId,
    job: job.slug,
    room,
    accepted: true,
  });
}
