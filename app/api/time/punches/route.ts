import { isPunchType } from "@/lib/time";
import { createWorkerPunch, saveForemanPunch } from "@/lib/timeStore";
import { readAppSession } from "@/lib/session.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function sessionFrom() {
  return readAppSession();
}

type PunchBody = {
  workerId?: unknown;
  pin?: unknown;
  punchType?: unknown;
  lat?: unknown;
  lng?: unknown;
  accuracy_m?: unknown;
  foreman?: unknown;
  punchedAt?: unknown;
  pairOutAt?: unknown;
  note?: unknown;
  punchId?: unknown;
};

/**
 * Worker punch-in/out (GPS required for in; geofence enforced server-side)
 * or foreman override (`foreman: true`) to add/correct a missed punch.
 */
export async function POST(request: Request) {
  const session = await sessionFrom();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }

  let body: PunchBody;
  try {
    body = (await request.json()) as PunchBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const workerId = typeof body.workerId === "string" ? body.workerId : "";
  if (!workerId) return json({ ok: false, error: "workerId is required" }, 400);

  if (body.foreman === true) {
    const punchedAt =
      typeof body.punchedAt === "string" ? body.punchedAt : "";
    if (!punchedAt) {
      return json({ ok: false, error: "punchedAt is required" }, 400);
    }
    const result = await saveForemanPunch({
      workerId,
      punchType: isPunchType(body.punchType) ? body.punchType : undefined,
      punchedAt,
      pairOutAt: typeof body.pairOutAt === "string" ? body.pairOutAt : null,
      note: typeof body.note === "string" ? body.note : null,
      punchId: typeof body.punchId === "string" ? body.punchId : null,
      userId: session.userId,
    });
    if (!result.ok) {
      return json(result, result.status);
    }
    return json(result);
  }

  if (!isPunchType(body.punchType)) {
    return json({ ok: false, error: "punchType must be in or out" }, 400);
  }

  const result = await createWorkerPunch({
    workerId,
    pin: typeof body.pin === "string" ? body.pin : undefined,
    punchType: body.punchType,
    lat: body.lat,
    lng: body.lng,
    accuracy_m: body.accuracy_m,
    userId: session.userId,
  });
  if (!result.ok) return json(result, result.status);
  return json(result);
}
