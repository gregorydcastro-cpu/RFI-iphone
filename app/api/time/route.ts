import { readAppSession } from "@/lib/session.server";
import { mondayOfWeek, TIME_JOB_SLUG, todayYmd } from "@/lib/time";
import { getTimeSnapshot } from "@/lib/timeStore";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await readAppSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sign in first." },
      { status: 401, headers: NO_STORE },
    );
  }

  const url = new URL(request.url);
  const week = url.searchParams.get("week");
  const weekStart = mondayOfWeek(week || todayYmd());
  const jobSlug = url.searchParams.get("job") || TIME_JOB_SLUG;
  const snapshot = await getTimeSnapshot(weekStart, jobSlug);
  if (!snapshot) {
    return NextResponse.json(
      { ok: false, error: "Unknown job site" },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true, ...snapshot }, { headers: NO_STORE });
}
