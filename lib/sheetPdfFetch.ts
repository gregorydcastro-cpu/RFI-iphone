/**
 * Bounded Drive / upstream fetch. Two attempts stay inside the 60s route budget.
 * Callers must not put request URLs (they can carry an API key) into errors.
 */

import { isRetryableDriveStatus } from "./sheetPdfErrors.ts";

/** Per-attempt cap for PDF bytes. Two attempts plus token exchange stay under maxDuration. */
export const SHEET_PDF_FETCH_TIMEOUT_MS = 20_000;
export const SHEET_PDF_TOKEN_TIMEOUT_MS = 6_000;
export const SHEET_PDF_RETRY_ATTEMPTS = 2;
export const SHEET_PDF_RETRY_BASE_MS = 300;
export const SHEET_PDF_RETRY_MAX_WAIT_MS = 1_500;
export const MAX_PDF_BYTES = 45 * 1024 * 1024;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type FetchRetryOptions<T> = {
  fetchImpl?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  attempts?: number;
  now?: () => number;
  /** Read a 2xx body before the attempt timer is cleared. Timeouts retry. */
  consumeBody?: (response: Response) => Promise<T>;
};

export type FetchRetryResult<T> =
  | { ok: true; response: Response; body: T | undefined; attempts: number }
  | { ok: false; kind: "timeout" | "unreachable"; attempts: number };

export function parseRetryAfterMs(
  header: string | null,
  now = Date.now(),
): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(Number(trimmed) * 1000);
  }
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

/** Negative means the Retry-After is too long to wait inside this route. */
export function sheetPdfBackoffMs(
  attempt: number,
  retryAfterMs: number | null,
): number {
  if (retryAfterMs != null && retryAfterMs > SHEET_PDF_RETRY_MAX_WAIT_MS) {
    return -1;
  }
  if (retryAfterMs != null) return retryAfterMs;
  return SHEET_PDF_RETRY_BASE_MS * 2 ** Math.max(0, attempt);
}

export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  return /aborted|timeout/i.test(error.message);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cancelBody(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => undefined);
}

export async function fetchWithBoundedRetry<T>(
  build: () => { url: string; init: RequestInit },
  options?: FetchRetryOptions<T>,
): Promise<FetchRetryResult<T>> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const sleep = options?.sleep ?? defaultSleep;
  const timeoutMs = options?.timeoutMs ?? SHEET_PDF_FETCH_TIMEOUT_MS;
  const attempts = options?.attempts ?? SHEET_PDF_RETRY_ATTEMPTS;
  const now = options?.now ?? Date.now;

  for (let i = 0; i < attempts; i++) {
    const { url, init } = build();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const clear = () => clearTimeout(timer);
    try {
      const response = await fetchImpl(url, {
        ...init,
        redirect: init.redirect ?? "manual",
        signal: controller.signal,
      });
      const retryable = isRetryableDriveStatus(response.status);
      const last = i === attempts - 1;
      if (retryable && !last) {
        clear();
        const wait = sheetPdfBackoffMs(
          i,
          parseRetryAfterMs(response.headers.get("retry-after"), now()),
        );
        await cancelBody(response);
        if (wait < 0) {
          return { ok: true, response, body: undefined, attempts: i + 1 };
        }
        await sleep(wait);
        continue;
      }

      if (response.ok && options?.consumeBody) {
        try {
          const body = await options.consumeBody(response);
          clear();
          return { ok: true, response, body, attempts: i + 1 };
        } catch (error) {
          clear();
          await cancelBody(response);
          const timedOut = isTimeoutError(error);
          if (!timedOut || last) {
            return {
              ok: false,
              kind: timedOut ? "timeout" : "unreachable",
              attempts: i + 1,
            };
          }
          await sleep(sheetPdfBackoffMs(i, null));
          continue;
        }
      }

      clear();
      if (!response.ok) await cancelBody(response);
      return { ok: true, response, body: undefined, attempts: i + 1 };
    } catch (error) {
      clear();
      const timedOut = isTimeoutError(error);
      if (i === attempts - 1) {
        return {
          ok: false,
          kind: timedOut ? "timeout" : "unreachable",
          attempts: i + 1,
        };
      }
      await sleep(sheetPdfBackoffMs(i, null));
    }
  }

  return { ok: false, kind: "unreachable", attempts };
}

export async function readLimitedBytes(
  response: Response,
  maxBytes = MAX_PDF_BYTES,
): Promise<Uint8Array | "too_large"> {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > maxBytes) return "too_large";
  }
  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    return buf.byteLength > maxBytes ? "too_large" : buf;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
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
