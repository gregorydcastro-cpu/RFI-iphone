import { readCookieValue } from "@/lib/auth";
import { isMarkupUuid, parseVectors } from "@/lib/markup";
import { parseStubSession, STUB_SESSION_COOKIE, stubUserIdFromEmail } from "@/lib/stubSession";
import {
  isMarkupTableWriteConfigured,
  selectMarkupOverlay,
  upsertMarkupOverlay,
} from "@/lib/supabaseMarkups";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

type MarkupBody = {
  request_id?: unknown;
  sheet_id?: unknown;
  id?: unknown;
  vectors?: unknown;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

function asTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sessionUserId(request: Request): string {
  const session = parseStubSession(
    readCookieValue(request.headers.get("cookie"), STUB_SESSION_COOKIE),
  );
  return session?.userId ?? stubUserIdFromEmail("alex.rivera@crew.example");
}

/**
 * Load a vector overlay for a pack sheet. Never a raster bake.
 * Service-role persist when configured; otherwise the client keeps localStorage.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = asTrimmed(url.searchParams.get("request_id"));
  const sheetId = asTrimmed(url.searchParams.get("sheet_id"));
  if (!requestId || !sheetId) {
    return json({ ok: false, error: "request_id and sheet_id are required" }, 400);
  }

  const userId = sessionUserId(request);
  const configured = isMarkupTableWriteConfigured();
  const row = configured
    ? await selectMarkupOverlay({ userId, requestId, sheetId })
    : null;

  return json({
    ok: true,
    persisted: Boolean(row),
    storage: row ? "supabase" : configured ? "unavailable" : "unconfigured",
    row,
  });
}

/**
 * Upsert vector overlay JSON for a pack sheet. Not a flattened image.
 */
export async function PUT(request: Request) {
  let body: MarkupBody;
  try {
    body = (await request.json()) as MarkupBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const requestId = asTrimmed(body.request_id);
  const sheetId = asTrimmed(body.sheet_id);
  if (!requestId || !sheetId) {
    return json({ ok: false, error: "request_id and sheet_id are required" }, 400);
  }

  const overlayId = asTrimmed(body.id);
  const userId = sessionUserId(request);
  const vectors = parseVectors(body.vectors);
  const configured = isMarkupTableWriteConfigured();
  const row = configured
    ? await upsertMarkupOverlay({
        id: overlayId && isMarkupUuid(overlayId) ? overlayId : undefined,
        userId,
        requestId,
        sheetId,
        vectors,
      })
    : null;

  const now = new Date().toISOString();
  const packet = row ?? {
    id: overlayId && isMarkupUuid(overlayId) ? overlayId : crypto.randomUUID(),
    request_id: requestId,
    sheet_id: sheetId,
    vectors,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };

  return json({
    ok: true,
    persisted: Boolean(row),
    storage: row ? "supabase" : configured ? "unavailable" : "unconfigured",
    row: packet,
  });
}
