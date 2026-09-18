import { getTimeSnapshot } from "@/lib/timeStore";
import { mondayOfWeek, todayYmd } from "@/lib/time";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const week = url.searchParams.get("week");
  const weekStart = mondayOfWeek(week || todayYmd());
  const snapshot = await getTimeSnapshot(weekStart);
  return NextResponse.json({ ok: true, ...snapshot }, { headers: NO_STORE });
}
