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
} from "./driveAuth";
import { loadLiveRoomPack } from "./livePack";
import { driveFileId, resolveSheetPdf } from "./packNormalize";
import {
  isBlockedFetchHost,
  isBrowserDirectPdfUrl,
  isGoogleDrivePdfUrl,
  isGoogleLoginHost,
  isPdfMagic,
  isProcorePdfUrl,
} from "./sheetPdfUrl";

export { DRIVE_AUTH_MISSING_MESSAGE, isPdfMagic, isBlockedFetchHost };

export const MAX_PDF_BYTES = 45 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;
const MAX_REDIRECTS = 5;

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
  code: string,
  error: string,
  extra?: { configured?: boolean },
): SheetPdfFailure {
  return { ok: false, status, code, error, ...extra };
}

function localPackPdfPath(pdfUrl: string): string | null {
  if (!isBrowserDirectPdfUrl(pdfUrl)) return null;
  const pathname = pdfUrl.split("?")[0] ?? pdfUrl;
  if (!pathname.startsWith("/packs/")) return null;
  const name = path.basename(pathname);
  if (!/^[a-zA-Z0-9._-]+\.pdf$/i.test(name)) return null;
  return path.join(process.cwd(), "public", "packs", name);
}

async function readLocalPackPdf(
  pdfUrl: string,
): Promise<Uint8Array | null> {
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

async function readLimitedBytes(
  response: Response,
): Promise<Uint8Array | "too_large"> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > MAX_PDF_BYTES) return "too_large";
  }
  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    return buf.byteLength > MAX_PDF_BYTES ? "too_large" : buf;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_PDF_BYTES) {
      await reader.cancel().catch(() => undefined);
      return "too_large";
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchHttps(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPublicHttpsPdf(
  startUrl: string,
): Promise<SheetPdfResult> {
  let url = startUrl;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return fail(400, "invalid_pdf_url", "Sheet PDF URL is invalid.");
    }
    if (parsed.protocol !== "https:") {
      return fail(400, "blocked_url", "Sheet PDF URL must be https.");
    }
    if (isBlockedFetchHost(parsed.hostname)) {
      return fail(400, "blocked_url", "Sheet PDF host is not allowed.");
    }
    if (isGoogleLoginHost(parsed.hostname)) {
      return fail(503, "drive_auth_missing", DRIVE_AUTH_MISSING_MESSAGE, {
        configured: false,
      });
    }

    let response: Response;
    try {
      response = await fetchHttps(url, {
        method: "GET",
        headers: { Accept: "application/pdf,application/octet-stream,*/*" },
      });
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" || /abort/i.test(error.message));
      return fail(
        502,
        aborted ? "upstream_timeout" : "upstream_failed",
        aborted
          ? "Timed out fetching the sheet PDF."
          : "Could not fetch the sheet PDF.",
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return fail(502, "upstream_failed", "Sheet PDF redirect was empty.");
      }
      url = new URL(location, url).toString();
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      return fail(503, "drive_auth_missing", DRIVE_AUTH_MISSING_MESSAGE, {
        configured: false,
      });
    }
    if (!response.ok) {
      return fail(
        502,
        "upstream_failed",
        `Could not fetch the sheet PDF (${response.status}).`,
      );
    }

    const bytes = await readLimitedBytes(response);
    if (bytes === "too_large") {
      return fail(502, "too_large", "Sheet PDF is larger than 45 MB.");
    }
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type.includes("text/html") || !isPdfMagic(bytes)) {
      if (isGoogleDrivePdfUrl(startUrl)) {
        return fail(503, "drive_auth_missing", DRIVE_AUTH_MISSING_MESSAGE, {
          configured: false,
        });
      }
      return fail(502, "not_pdf", "Upstream sheet was not a PDF.");
    }
    return { ok: true, bytes, filename: "sheet.pdf" };
  }
  return fail(502, "too_many_redirects", "Sheet PDF had too many redirects.");
}

async function fetchDriveMedia(input: {
  fileId: string;
  authorization?: string;
  apiKey?: string;
}): Promise<Response> {
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
    acknowledgeAbuse: "true",
  });
  if (input.apiKey) params.set("key", input.apiKey);
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    input.fileId,
  )}?${params.toString()}`;
  const headers: Record<string, string> = {
    Accept: "application/pdf,application/octet-stream,*/*",
  };
  if (input.authorization) headers.Authorization = input.authorization;
  return fetchHttps(url, { method: "GET", headers });
}

export async function fetchDrivePdf(fileId: string): Promise<SheetPdfResult> {
  const auth = readGoogleDriveAuth();
  if (!auth) {
    const publicAttempt = await fetchPublicHttpsPdf(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    );
    if (publicAttempt.ok) return publicAttempt;
    if (publicAttempt.code === "drive_auth_missing") return publicAttempt;
    return fail(503, "drive_auth_missing", DRIVE_AUTH_MISSING_MESSAGE, {
      configured: false,
    });
  }

  let response: Response;
  try {
    if (auth.kind === "service_account") {
      const token = await getDriveAccessToken(auth.account);
      response = await fetchDriveMedia({
        fileId,
        authorization: `Bearer ${token}`,
      });
    } else {
      response = await fetchDriveMedia({ fileId, apiKey: auth.apiKey });
    }
  } catch (error) {
    const code =
      error instanceof Error
        ? (error as Error & { code?: string }).code
        : undefined;
    if (code === "drive_auth_rejected") {
      return fail(
        503,
        "drive_auth_rejected",
        "Google Drive service account was rejected. Check GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON / GOOGLE_PRIVATE_KEY on Vercel.",
        { configured: true },
      );
    }
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || /abort/i.test(error.message));
    return fail(
      502,
      aborted ? "upstream_timeout" : "upstream_failed",
      aborted
        ? "Timed out fetching the Drive sheet PDF."
        : "Could not reach Google Drive.",
    );
  }

  if (response.status === 401) {
    return fail(
      503,
      "drive_auth_rejected",
      "Google Drive credentials were rejected.",
      { configured: true },
    );
  }
  if (response.status === 403 || response.status === 404) {
    return fail(
      502,
      "drive_forbidden",
      "Drive file is missing or not shared with the service account. Share the Procore bot pack folder with GOOGLE_CLIENT_EMAIL (Viewer).",
      { configured: true },
    );
  }
  if (!response.ok) {
    return fail(
      502,
      "upstream_failed",
      `Google Drive download failed (${response.status}).`,
    );
  }

  const bytes = await readLimitedBytes(response);
  if (bytes === "too_large") {
    return fail(502, "too_large", "Sheet PDF is larger than 45 MB.");
  }
  if (!isPdfMagic(bytes)) {
    return fail(502, "not_pdf", "Drive file was not a PDF.");
  }
  return { ok: true, bytes, filename: `${fileId}.pdf` };
}

export async function loadSheetPdf(input: {
  requestId: string;
  sheetId: string;
}): Promise<SheetPdfResult> {
  const live = await loadLiveRoomPack({ requestId: input.requestId });
  if (!live) {
    return fail(404, "pack_not_found", "Pack not available.");
  }

  const sheet = live.pack.sheets.find((item) => item.id === input.sheetId);
  if (!sheet) {
    return fail(404, "sheet_not_found", "Sheet not found in this pack.");
  }

  const pdfUrl = resolveSheetPdf(sheet);
  if (!pdfUrl) {
    return fail(404, "pdf_missing", "No PDF attached for this sheet.");
  }

  const filename = filenameForSheet(sheet.id);

  const local = await readLocalPackPdf(pdfUrl);
  if (local) {
    if (!isPdfMagic(local)) {
      return fail(502, "not_pdf", "Local sheet file was not a PDF.");
    }
    return { ok: true, bytes: local, filename };
  }

  if (isProcorePdfUrl(pdfUrl)) {
    return fail(
      502,
      "procore_pdf_unsupported",
      "This sheet points at Procore. The Procore bot should store a Google Drive or public/signed PDF URL in sheets[].pdf; the website does not fetch Procore drawings.",
    );
  }

  if (isGoogleDrivePdfUrl(pdfUrl)) {
    const fileId = driveFileId(pdfUrl);
    if (!fileId) {
      return fail(400, "invalid_pdf_url", "Drive sheet PDF URL is missing a file id.");
    }
    const drive = await fetchDrivePdf(fileId);
    if (!drive.ok) return drive;
    return { ...drive, filename };
  }

  if (isBrowserDirectPdfUrl(pdfUrl)) {
    return fail(404, "pdf_missing", "Local sheet PDF was not found.");
  }

  const remote = await fetchPublicHttpsPdf(pdfUrl);
  if (!remote.ok) return remote;
  return { ...remote, filename };
}
