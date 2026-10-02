/**
 * Server-only live sheet PDF loader. Looks up the pack the same way the
 * viewer does, then fetches Drive (service account / API key) or a public
 * https URL. Never returns credentials to the client.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { DRIVE_AUTH_MISSING_MESSAGE } from "./driveAuth.ts";
import { loadLiveRoomPack } from "./livePack.ts";
import { driveFileId, resolveSheetPdf } from "./packNormalize.ts";
import { MAX_PDF_BYTES } from "./sheetPdfFetch.ts";
import {
  fail,
  fetchDrivePdf,
  fetchPublicHttpsPdf,
  type SheetPdfResult,
} from "./sheetPdfDownload.ts";
import {
  isBlockedFetchHost,
  isBrowserDirectPdfUrl,
  isGoogleDrivePdfUrl,
  isPdfMagic,
  isProcorePdfUrl,
} from "./sheetPdfUrl.ts";

export { DRIVE_AUTH_MISSING_MESSAGE, MAX_PDF_BYTES, isPdfMagic, isBlockedFetchHost };

function localPackPdfPath(pdfUrl: string): string | null {
  if (!isBrowserDirectPdfUrl(pdfUrl)) return null;
  const pathname = pdfUrl.split("?")[0] ?? pdfUrl;
  if (!pathname.startsWith("/packs/")) return null;
  const name = path.basename(pathname);
  if (!/^[a-zA-Z0-9._-]+\.pdf$/i.test(name)) return null;
  return path.join(process.cwd(), "public", "packs", name);
}

async function readLocalPackPdf(pdfUrl: string): Promise<Uint8Array | null> {
  const file = localPackPdfPath(pdfUrl);
  if (!file) return null;
  try {
    const buf = await readFile(file);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function filenameForSheet(sheetId: string): string {
  const safe = sheetId.replace(/[^a-zA-Z0-9._-]+/g, "-") || "sheet";
  return `${safe}.pdf`;
}


export async function loadSheetPdf(input: {
  requestId: string;
  sheetId: string;
}): Promise<SheetPdfResult> {
  const live = await loadLiveRoomPack({ requestId: input.requestId });
  if (!live) {
    return fail(404, "pack_not_found");
  }

  const sheet = live.pack.sheets.find((item) => item.id === input.sheetId);
  if (!sheet) {
    return fail(404, "sheet_not_found");
  }

  const pdfUrl = resolveSheetPdf(sheet);
  if (!pdfUrl) {
    return fail(404, "pdf_missing");
  }

  const filename = filenameForSheet(sheet.id);

  const local = await readLocalPackPdf(pdfUrl);
  if (local) {
    if (!isPdfMagic(local)) return fail(502, "not_pdf");
    return { ok: true, bytes: local, filename };
  }

  if (isProcorePdfUrl(pdfUrl)) return fail(502, "procore_pdf_unsupported");

  if (isGoogleDrivePdfUrl(pdfUrl)) {
    const fileId = driveFileId(pdfUrl);
    if (!fileId) return fail(400, "invalid_pdf_url");
    const drive = await fetchDrivePdf(fileId);
    if (!drive.ok) return drive;
    return { ...drive, filename };
  }

  if (isBrowserDirectPdfUrl(pdfUrl)) return fail(404, "pdf_missing");

  const remote = await fetchPublicHttpsPdf(pdfUrl);
  if (!remote.ok) return remote;
  return { ...remote, filename };
}
