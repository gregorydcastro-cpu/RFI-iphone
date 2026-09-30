/**
 * Client load policy for sheet PDFs. Pure helpers — no fetch, no secrets.
 * The viewer retries a dropped phone connection once, then the cached copy,
 * then the error banner. A Drive 502/504 already retried inside /api/sheet-pdf.
 */

export const OFFLINE_PDF_HEADER = "X-GCFieldLog-Offline";
export const SHEET_PDF_CLIENT_ATTEMPTS = 2;
export const SHEET_PDF_CLIENT_BACKOFF_MS = 400;

export function isOfflinePdfResponse(headers: {
  get(name: string): string | null;
}): boolean {
  return headers.get(OFFLINE_PDF_HEADER) === "1";
}

/**
 * True when the body ended before Content-Length and the bytes are not a
 * decompressed payload (gzip Content-Length is the compressed size).
 */
export function isShortPdfDownload(
  byteLength: number,
  contentLength: string | null,
  contentEncoding: string | null,
): boolean {
  const encoding = (contentEncoding ?? "").trim().toLowerCase();
  if (encoding && encoding !== "identity") return false;
  if (!contentLength) return false;
  const length = Number(contentLength.trim());
  if (!Number.isFinite(length) || length < 0) return false;
  return byteLength < length;
}

/**
 * One extra viewer attempt for failures /api/sheet-pdf never saw:
 * the connection dropped, or the body stopped early. Server-classified
 * Drive errors already used their retry; the banner Retry starts another load.
 */
export function shouldAutoRetrySheetPdf(input: {
  attempt: number;
  attempts?: number;
  network?: boolean;
  interrupted?: boolean;
}): boolean {
  const attempts = input.attempts ?? SHEET_PDF_CLIENT_ATTEMPTS;
  if (input.attempt >= attempts - 1) return false;
  return input.network === true || input.interrupted === true;
}
