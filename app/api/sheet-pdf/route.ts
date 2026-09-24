import { loadSheetPdf } from "@/lib/sheetPdf";
import { publicSheetPdfError } from "@/lib/sheetPdfErrors";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const PACK_ID = /^[a-zA-Z0-9._-]+$/;
const SHEET_ID = /^[^\\/]{1,120}$/;
const ERROR_CACHE = { "Cache-Control": "no-store" };
const PDF_CACHE = {
  "Cache-Control": "private, max-age=300, stale-while-revalidate=3600",
  "X-Content-Type-Options": "nosniff",
  "Content-Type": "application/pdf",
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function json(data: unknown, status: number) {
  return NextResponse.json(data, { status, headers: ERROR_CACHE });
}

/**
 * Stream a pack sheet PDF through this origin so pdf.js does not fetch
 * Google Drive (auth/CORS). Lookup matches the pack viewer (room_packs).
 * GET /api/sheet-pdf?requestId=&sheetId=
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestId = asNonEmptyString(searchParams.get("requestId"));
  const sheetId = asNonEmptyString(searchParams.get("sheetId"));

  if (!requestId || !PACK_ID.test(requestId)) {
    return json(
      { ok: false, error: "requestId is required", code: "bad_request" },
      400,
    );
  }
  if (!sheetId || !SHEET_ID.test(sheetId)) {
    return json(
      { ok: false, error: "sheetId is required", code: "bad_request" },
      400,
    );
  }

  const result = await loadSheetPdf({ requestId, sheetId });
  if (!result.ok) {
    return json(
      publicSheetPdfError({
        code: result.code,
        configured: result.configured,
      }),
      result.status,
    );
  }

  const body = Buffer.from(result.bytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...PDF_CACHE,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `inline; filename="${result.filename}"`,
    },
  });
}
