/**
 * Drive and public HTTPS sheet PDF downloads.
 * No pack lookup, so unit tests can load this file under node:test.
 * Never returns credentials or upstream bodies.
 */

import {
  getDriveAccessToken,
  readGoogleDriveAuth,
  resetDriveTokenCache,
  type GoogleDriveAuth,
} from "./driveAuth.ts";
import {
  DriveTokenError,
  mapDriveDownloadStatus,
  SHEET_PDF_MESSAGES,
  type SheetPdfErrorCode,
} from "./sheetPdfErrors.ts";
import {
  fetchWithBoundedRetry,
  readLimitedBytes,
} from "./sheetPdfFetch.ts";
import {
  isAllowedDriveDownloadHost,
  isBlockedFetchHost,
  isGoogleDrivePdfUrl,
  isGoogleLoginHost,
  isPdfMagic,
} from "./sheetPdfUrl.ts";

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

export function fail(
  status: number,
  code: SheetPdfErrorCode,
  extra?: { configured?: boolean },
): SheetPdfFailure {
  return { ok: false, status, code, error: SHEET_PDF_MESSAGES[code], ...extra };
}

const MAX_REDIRECTS = 5;

const PUBLIC_FAILURES_TO_KEEP: ReadonlySet<SheetPdfErrorCode> = new Set([
  "timeout",
  "upstream_failed",
  "too_large",
  "not_pdf",
  "blocked_url",
  "invalid_pdf_url",
  "too_many_redirects",
  "empty_body",
]);

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

export type SheetPdfFetchDeps = {
  fetchImpl?: (input: string, init: RequestInit) => Promise<Response>;
  sleep?: (ms: number) => Promise<void>;
  /** Test hook. Omit to read server env. Pass null for the public fallback. */
  auth?: GoogleDriveAuth | null;
};

function resolveDriveAuth(deps?: SheetPdfFetchDeps): GoogleDriveAuth | null {
  if (deps && Object.prototype.hasOwnProperty.call(deps, "auth")) {
    return deps.auth ?? null;
  }
  return readGoogleDriveAuth();
}

/** One new token after Drive rejects the cached one. Not a loop. */
export function shouldRefreshDriveToken(input: {
  code: string;
  allowRefresh: boolean;
}): boolean {
  return input.allowRefresh && input.code === "drive_auth_rejected";
}

async function downloadHttpsPdf(
  startUrl: string,
  headers: Record<string, string>,
  mode: DownloadMode,
  deps?: SheetPdfFetchDeps,
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
      {
        fetchImpl: deps?.fetchImpl,
        sleep: deps?.sleep,
        consumeBody: (response) => readLimitedBytes(response),
      },
    );

    if (!fetched.ok) {
      const code =
        fetched.kind === "timeout"
          ? "timeout"
          : fetched.kind === "empty"
            ? "empty_body"
            : "upstream_failed";
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

export async function fetchPublicHttpsPdf(
  startUrl: string,
  deps?: SheetPdfFetchDeps,
): Promise<SheetPdfResult> {
  return downloadHttpsPdf(
    startUrl,
    { Accept: "application/pdf,application/octet-stream,*/*" },
    "public",
    deps,
  );
}

async function downloadDriveWithAccount(
  fileId: string,
  account: Extract<GoogleDriveAuth, { kind: "service_account" }>["account"],
  deps: SheetPdfFetchDeps | undefined,
  allowRefresh: boolean,
): Promise<SheetPdfResult> {
  const headers: Record<string, string> = {
    Accept: "application/pdf,application/octet-stream,*/*",
  };
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
    acknowledgeAbuse: "true",
  });
  try {
    const token = await getDriveAccessToken(account, {
      fetchImpl: deps?.fetchImpl,
      sleep: deps?.sleep,
    });
    headers.Authorization = `Bearer ${token}`;
  } catch (error) {
    return failureFromTokenError(error);
  }

  const startUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;
  const drive = await downloadHttpsPdf(startUrl, headers, "drive", deps);
  if (!drive.ok && shouldRefreshDriveToken({ code: drive.code, allowRefresh })) {
    resetDriveTokenCache();
    return downloadDriveWithAccount(fileId, account, deps, false);
  }
  if (!drive.ok) return drive;
  return { ...drive, filename: `${fileId}.pdf` };
}

export async function fetchDrivePdf(
  fileId: string,
  deps?: SheetPdfFetchDeps,
): Promise<SheetPdfResult> {
  const auth = resolveDriveAuth(deps);
  if (!auth) {
    const publicAttempt = await fetchPublicHttpsPdf(
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
      deps,
    );
    if (publicAttempt.ok) return publicAttempt;
    if (PUBLIC_FAILURES_TO_KEEP.has(publicAttempt.code as SheetPdfErrorCode)) {
      return { ...publicAttempt, configured: false };
    }
    return fail(503, "drive_auth_missing", { configured: false });
  }

  if (auth.kind === "service_account") {
    return downloadDriveWithAccount(fileId, auth.account, deps, true);
  }

  const headers: Record<string, string> = {
    Accept: "application/pdf,application/octet-stream,*/*",
  };
  const params = new URLSearchParams({
    alt: "media",
    supportsAllDrives: "true",
    acknowledgeAbuse: "true",
    key: auth.apiKey,
  });
  const startUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;
  const drive = await downloadHttpsPdf(startUrl, headers, "drive", deps);
  if (!drive.ok) return drive;
  return { ...drive, filename: `${fileId}.pdf` };
}

