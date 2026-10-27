import { NextResponse } from "next/server";
import {
  listProcoreProjectsForUser,
  publicProcoreProjects,
} from "@/lib/procoreProjects";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Projects visible to the signed-in user's stored Procore token.
 * Company id is resolved from GET /companies. Never returns tokens.
 */
export async function GET() {
  const session = await readAppSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Sign in required." },
      { status: 401, headers: NO_STORE },
    );
  }

  const list = await listProcoreProjectsForUser(session.userId);
  if (!list.ok) {
    return NextResponse.json(
      { ok: false, reason: list.reason, projects: [] },
      { headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: true, projects: publicProcoreProjects(list.projects) },
    { headers: NO_STORE },
  );
}
