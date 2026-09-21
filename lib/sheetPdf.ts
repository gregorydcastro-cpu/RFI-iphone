/**
 * Server-only live sheet PDF loader. Looks up the pack the same way the
 * viewer does, then fetches Drive (service account / API key) or a public
 * https URL. Never returns credentials to the client.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  DRIVE_AUTH_MISSING_MESSAGE,
  getDriveAccessToken,
  readGoogleDriveAuth,
} from "./driveAuth.ts";
import { loadLiveRoomPack } from "./livePack.ts";
import { driveFileId, resolveSheetPdf } from "./packNormalize.ts";
import {
  DriveTokenError,
  mapDriveDownloadStatus,
  SHEET_PDF_MESSAGES,
  type SheetPdfErrorCode,
} from "./sheetPdfErrors.ts";
import {
  fetchWithBoundedRetry,
  MAX_PDF_BYTES,
  readLimitedBytes,
} from "./sheetPdfFetch.ts";
import {
  isAllowedDriveDownloadHost,
  isBlockedFetchHost,
  isBrowserDirectPdfUrl,
  isGoogleDrivePdfUrl,
  isGoogleLoginHost,
  isPdfMagic,
  isProcorePdfUrl,
} from "./sheetPdfUrl.ts";

export { DRIVE_AUTH_MISSING_MESSAGE, MAX_PDF_BYTES, isPdfMagic, isBlockedFetchHost };

const MAX_REDIRECTS = 5;

const PUBLIC_FAILURES_TO_KEEP: ReadonlySet<SheetPdfErrorCode> = new Set([
  "timeout",
  "upstream_failed",
  "too_large",
  "not_pdf",
  "blocked_url",
  "invalid_pdf_url",
  "too_many_redirects",
]);

export type SheetPdfFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  configured?: boolean;
};

export type SheetPdfSuccess = {
  ok: true;
  bytes: Uint8Array;
  filename: string;
};

export type SheetPdfResult = SheetPdfSuccess | SheetPdfFailure;

function fail(
  status: number,
  code: SheetPdfErrorCode,
  extra?: { configured?: boolean },
): SheetPdfFailure {
  return { ok: false, status, code, error: SHEET_PDF_MESSAGES[code], ...extra };
}

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

function failureFromTokenError(error: unknown): SheetPdfFailure {
  if (error instanceof DriveTokenError) {
    if (error.code === "timeout") return fail(504, "timeout", { configured: true });
    if (error.code === "upstream_failed") {
      return fail(502, "upstream_failed", { configured: true });
    }
  }
  return fail(503, "drive_auth_rejected", { configured: true });
}

type DownloadMode = "drive" | "public";

async function downloadHttpsPdf(
  startUrl: string,
  headers: Record<string, string>,
  mode: DownloadMode,
): Promise<SheetPdfResult> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fail(400, "invalid_pdf_url");
    }
    if (parsed.protocol !== "https:") {
      return fail(400, "blocked_url");
    }
    if (mode === "drive") {
      if (isGoogleLoginHost(parsed.hostname)) {
        return fail(503, "drive_auth_rejected", { configured: true });
      }
      if (!isAllowedDriveDownloadHost(parsed.hostname)) {
        return fail(400, "blocked_url");
      }
    } else {
      if (isBlockedFetchHost(parsed.hostname)) return fail(400, "blocked_url");
      if (isGoogleLoginHost(parsed.hostname)) {
        return fail(503, "drive_auth_missing", { configured: false });
      }
    }

    const fetched = await fetchWithBoundedRetry(
      () => ({
        url,
        init: {
          method: "GET",
          headers,
          redirect: "manual",
          cache: "no-store",
        },
      }),
      { consumeBody: (response) => readLimitedBytes(response) },
    );

    if (!fetched.ok) {
      const code = fetched.kind === "timeout" ? "timeout" : "upstream_failed";
      return fail(
        code === "timeout" ? 504 : 502,
        code,
        mode === "drive" ? { configured: true } : undefined,
      );
    }

    const response = fetched.response;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return fail(502, "upstream_failed");
      url = new URL(location, url).toString();
      continue;
    }

    if (mode === "drive") {
      if (!response.ok) {
        const mapped = mapDriveDownloadStatus(response.status);
        return fail(mapped.httpStatus, mapped.code, { configured: true });
      }
    } else if (response.status === 401 || response.status === 403) {
      return fail(503, "drive_auth_missing", { configured: false });
    } else if (response.status === 404) {
      return fail(404, "not_found");
    } else if (!response.ok) {
      const mapped = mapDriveDownloadStatus(response.status);
      const code =
        mapped.code === "drive_auth_rejected" || mapped.code === "drive_forbidden"
          ? "upstream_failed"
          : mapped.code;
      return fail(mapped.httpStatus, code);
    }

    const bytes = fetched.body;
    if (!bytes || bytes === "too_large") return fail(502, "too_large");
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type.includes("text/html") || !isPdfMagic(bytes)) {
      if (mode === "public" && isGoogleDrivePdfUrl(startUrl)) {
        return fail(503, "drive_auth_missing", { configured: false });
      }
      return fail(502, "not_pdf");
    }
    return { ok: true, bytes, filename: "sheet.pdf" };
  }
  return fail(502, "too_many_redirects");
}

export async function fetchPublicHttpsPdf(startUrl: string): Promise<SheetPdfResult> {
  return downloadHttpsPdf(
    startUrl,
    { Accept: "application/pdf,application/octet-stream,*/*" },
    "public",
  );
}

export async function fetchDrivePdf(fileId: string): Promise<SheetPdfResult> {
  const auth = readGoogleDriveAuth();
  if (!auth) {
    const publicAttempt = await fetchPublicHttpsPdf(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    );
    if (publicAttempt.ok) return publicAttempt;
    if (PUBLIC_FAILURES_TO_KEEP.has(publicAttempt.code as SheetPdfErrorCode)) {
      return { ...publicAttempt, configured: false };
    }
    return fail(503, "drive_auth_missing", { configured: false });
  }

  const headers: Record<string, string> = {
    Accept: "application/pdf,application/octet-stream,*/*",
  };
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
    acknowledgeAbuse: "true",
  });
  try {
    if (auth.kind === "service_account") {
      const token = await getDriveAccessToken(auth.account);
      headers.Authorization = `Bearer ${token}`;
    } else {
      params.set("key", auth.apiKey);
    }
  } catch (error) {
    return failureFromTokenError(error);
  }

  const startUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;
  const drive = await downloadHttpsPdf(startUrl, headers, "drive");
  if (!drive.ok) return drive;
  return { ...drive, filename: `${fileId}.pdf` };
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
