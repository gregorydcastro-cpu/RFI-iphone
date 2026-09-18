import { readFieldRoleFromRequest } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

/**
 * Puller-only stub for Mike's manual "refresh all pinned sheets".
 *
 * Does not walk `pinned_sheets`, does not read `sheet_revision_cache`,
 * and does not pull Procore. Weekly rev-only re-pull is a later job.
 *
 * Does not touch pack viewer UI.
 */
export async function POST(request: Request) {
  const role = readFieldRoleFromRequest(request);
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

  return json({
    ok: true,
    accepted: true,
    stub: true,
    refresh: "queued",
    implemented: false,
    note: "Force refresh accepted. Weekly rev-only re-pull will read sheet_revision_cache; not implemented in this PR.",
  });
}
