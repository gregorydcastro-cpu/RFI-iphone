import { SHARE_CATALOG } from "@/lib/shareCatalog";
import {
  createShareFolder,
  listSharePortal,
  removeShareFolder,
} from "@/lib/shareStore";
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
 * List share folders + pinned sheets for the signed-in owner.
 * Service-role writes when configured; otherwise process memory.
 */
export async function GET() {
  const session = await sessionFromRequest();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }

  const snapshot = await listSharePortal(session.userId);
  return json({
    ok: true,
    storage: snapshot.storage,
    folders: snapshot.folders,
    catalog: SHARE_CATALOG,
  });
}

/**
 * Create a named share folder owned by the signed-in user.
 */
export async function POST(request: Request) {
  const session = await sessionFromRequest();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }

  let body: { name?: unknown };
  try {
    body = (await request.json()) as { name?: unknown };
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const result = await createShareFolder({
    ownerUserId: session.userId,
    name: asTrimmed(body.name) ?? "",
  });
  if ("error" in result) {
    return json({ ok: false, error: result.error }, result.status);
  }

  return json({
    ok: true,
    storage: result.storage,
    folder: { ...result.folder, pins: [] },
  });
}

/**
 * Delete a folder (pins cascade). Query: `?id=`
 */
export async function DELETE(request: Request) {
  const session = await sessionFromRequest();
  if (!session) {
    return json({ ok: false, error: "Sign in first." }, 401);
  }

  const id = asTrimmed(new URL(request.url).searchParams.get("id"));
  if (!id) return json({ ok: false, error: "id is required" }, 400);

  const result = await removeShareFolder({
    ownerUserId: session.userId,
    folderId: id,
  });
  if ("error" in result) {
    return json({ ok: false, error: result.error }, result.status);
  }
  return json({ ok: true, storage: result.storage });
}
