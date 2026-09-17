import { fetchPackStatus } from "@/lib/fetchPackStatus";
import { getJob } from "@/lib/jobs";
import { getProcoreRoomPackWebhookConfig } from "@/lib/procoreRoomPack";
import { requestBelongsToJob } from "@/lib/packStatus";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

async function handleStatus(input: {
  projectSlug: string | null;
  requestId: string | null;
  statusUrl: string | null;
}) {
  const projectSlug = asNonEmptyString(input.projectSlug);
  const requestId = packId(asNonEmptyString(input.requestId));
  if (!projectSlug || !requestId) {
    return NextResponse.json(
      { ok: false, error: "job and requestId are required" },
      { status: 400 },
    );
  }

  const job = getJob(projectSlug);
  if (!job || !requestBelongsToJob(job, requestId)) {
    return NextResponse.json(
      { ok: false, error: "Unknown job" },
      { status: 404 },
    );
  }

  const live = Boolean(getProcoreRoomPackWebhookConfig());
  const snapshot = await fetchPackStatus({
    job,
    requestId,
    statusUrl: input.statusUrl ?? undefined,
    poll: live,
  });

  return NextResponse.json({
    ok: true,
    ...snapshot,
    pack: snapshot.pack,
  });
}

/**
 * Poll Drive / public JSON for `{project_slug}/{request_id}.json`.
 * Does not wait for the pack on the request POST; this endpoint is the poll.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleStatus({
    projectSlug: searchParams.get("job") ?? searchParams.get("projectSlug"),
    requestId: searchParams.get("requestId"),
    statusUrl: null,
  });
}

export async function POST(request: Request) {
  let json: {
    projectSlug?: unknown;
    job?: unknown;
    requestId?: unknown;
    statusUrl?: unknown;
  };
  try {
    json = (await request.json()) as typeof json;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  return handleStatus({
    projectSlug: asNonEmptyString(json.projectSlug) ?? asNonEmptyString(json.job),
    requestId: asNonEmptyString(json.requestId),
    statusUrl: asNonEmptyString(json.statusUrl),
  });
}
