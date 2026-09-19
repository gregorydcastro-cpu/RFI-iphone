import {
  expandDisciplinePins,
  expandRoomPackPins,
  isPinnedSheetDiscipline,
} from "@/lib/shareCatalog";
import { pinSheetsToFolder, unpinSheet } from "@/lib/shareStore";
import { readAppSession } from "@/lib/session.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

async function sessionFromRequest() {
  return readAppSession();
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Pin a full discipline or a Maple Point room pack onto a share folder.
 *
 * Body: `{ folder_id, kind: "discipline" | "room_pack", discipline?, pack_id? }`
 * Service-role insert into `pinned_sheets` under auth.uid().
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }

  let body: {
    folder_id?: unknown;
    kind?: unknown;
    discipline?: unknown;
    pack_id?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const folderId = asTrimmed(body.folder_id);
  if (!folderId) return json({ ok: false, error: "folder_id is required" }, 400);

  const kind = asTrimmed(body.kind);
  const packId = asTrimmed(body.pack_id);
  const drafts =
    kind === "discipline" && isPinnedSheetDiscipline(body.discipline)
      ? expandDisciplinePins(body.discipline)
      : kind === "room_pack" && packId
        ? expandRoomPackPins(packId)
        : null;

  if (!drafts) {
    return json(
      {
        ok: false,
        error:
          "kind must be discipline (electrical / lighting / architectural) or room_pack with pack_id",
      },
      400,
    );
  }

  const result = await pinSheetsToFolder({
    ownerUserId: session.userId,
    folderId,
    drafts,
  });
  if ("error" in result) {
    return json({ ok: false, error: result.error }, result.status);
  }

  return json({
    ok: true,
    storage: result.storage,
    added: result.added,
    pins: result.pins,
  });
}

/**
 * Unpin a sheet. Query: `?id=`
 */
export async function DELETE(request: Request) {
  const session = await sessionFromRequest();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }
  const id = asTrimmed(new URL(request.url).searchParams.get("id"));
  if (!id) return json({ ok: false, error: "id is required" }, 400);
  const result = await unpinSheet({ ownerUserId: session.userId, pinId: id });
  if ("error" in result) {
    return json({ ok: false, error: result.error }, result.status);
  }
  return json({ ok: true, storage: result.storage });
}
