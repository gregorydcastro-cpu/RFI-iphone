/**
 * Client load policy for sheet PDFs. Pure helpers — no fetch, no secrets.
 * The viewer retries a dropped phone connection or an empty body once,
 * then the cached copy, then the error banner. A Drive 502/504 already
 * retried inside /api/sheet-pdf, so a finished 5xx is a Retry tap.
 * A hung proxy stops at SHEET_PDF_CLIENT_TIMEOUT_MS instead of spinning.
 */

export const OFFLINE_PDF_HEADER = "X-GCFieldLog-Offline";
export const SHEET_PDF_CLIENT_ATTEMPTS = 2;
export const SHEET_PDF_CLIENT_BACKOFF_MS = 400;
/** Slightly past the 60s route budget so a slow PDF can finish. */
export const SHEET_PDF_CLIENT_TIMEOUT_MS = 70_000;
export const SHEET_PDF_PAINT_TIMEOUT_MS = 20_000;

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

/**
 * What the viewer does when fetch throws.
 * Unmount and a foreign abort stay quiet. A client deadline shows the
 * timeout banner once — it does not start another 70s wait.
 * A fast network drop retries once.
 */
export function sheetPdfFetchCatch(input: {
  cancelled: boolean;
  timedOut: boolean;
  aborted: boolean;
  attempt: number;
  attempts?: number;
}): "ignore" | "timeout" | "retry" | "banner" {
  if (input.cancelled) return "ignore";
  if (input.timedOut) return "timeout";
  if (input.aborted) return "ignore";
  if (
    shouldAutoRetrySheetPdf({
      attempt: input.attempt,
      attempts: input.attempts,
      network: true,
    })
  ) {
    return "retry";
  }
  return "banner";
}

export function isSheetPaintTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}
