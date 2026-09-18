import { SHARE_CATALOG } from "@/lib/shareCatalog";
import {
  createShareFolder,
  listSharePortal,
  removeShareFolder,
} from "@/lib/shareStore";
import { parseStubSessionFromCookieHeader } from "@/lib/stubSession";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function sessionFromRequest(request: Request) {
  return parseStubSessionFromCookieHeader(request.headers.get("cookie"));
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * List share folders + pinned sheets for the stub session owner.
 * Service-role writes when configured; otherwise process memory.
 */
export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) {
    return json({ ok: false, error: "Sign in first (stub session)." }, 401);
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
 * Create a named share folder owned by the stub session user.
 */
export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) {
    return json({ ok: false, error: "Sign in first (stub session)." }, 401);
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
  const session = sessionFromRequest(request);
  if (!session) {
    return json({ ok: false, error: "Sign in first (stub session)." }, 401);
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
