import type { VoiceErrorCode } from "./voiceErrors";

/** Per-attempt timeout. One retry stays under the 30s route budget. */
export const VOICE_FETCH_TIMEOUT_MS = 12_000;
export const VOICE_RETRY_ATTEMPTS = 2;
export const VOICE_RETRY_BASE_MS = 400;
export const VOICE_RETRY_MAX_WAIT_MS = 2_000;

export function isRetryableVoiceStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503;
}

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

/** Negative means do not wait / do not retry (Retry-After is too long). */
export function backoffMs(attempt: number, retryAfterMs: number | null): number {
  if (retryAfterMs != null && retryAfterMs > VOICE_RETRY_MAX_WAIT_MS) return -1;
  if (retryAfterMs != null) return retryAfterMs;
  return VOICE_RETRY_BASE_MS * 2 ** Math.max(0, attempt);
}

export function mapUpstreamVoiceError(
  status: number,
  kind: "stt" | "tts",
): { code: VoiceErrorCode; status: number } {
  if (status === 401) return { code: "rejected", status: 502 };
  if (status === 429) return { code: "busy", status: 429 };
  if (status === 413) return { code: "too_large", status: 413 };
  if (status === 404 && kind === "tts") return { code: "unknown_voice", status: 404 };
  if (status === 422) {
    return kind === "stt"
      ? { code: "no_speech", status: 422 }
      : { code: "bad_input", status: 400 };
  }
  if (status === 400) return { code: "bad_input", status: 400 };
  if (status === 408 || status === 504) return { code: "timeout", status: 504 };
  return {
    code: status >= 500 ? "failed" : "bad_input",
    status: status >= 400 && status < 500 ? 400 : 502,
  };
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type VoiceFetchResult =
  | { ok: true; response: Response }
  | { ok: false; kind: "timeout" | "unreachable" };

export async function fetchXaiWithRetry(
  build: () => { url: string; init: RequestInit },
  options?: {
    fetchImpl?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
    attempts?: number;
    now?: () => number;
  },
): Promise<VoiceFetchResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const sleep =
    options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = options?.timeoutMs ?? VOICE_FETCH_TIMEOUT_MS;
  const attempts = options?.attempts ?? VOICE_RETRY_ATTEMPTS;
  const now = options?.now ?? Date.now;

  for (let i = 0; i < attempts; i++) {
    const { url, init } = build();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      const retryable = isRetryableVoiceStatus(response.status);
      if (!retryable || i === attempts - 1) {
        return { ok: true, response };
      }
      const wait = backoffMs(
        i,
        parseRetryAfterMs(response.headers.get("retry-after"), now()),
      );
      if (wait < 0) return { ok: true, response };
      await sleep(wait);
    } catch (error) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
      if (i === attempts - 1) {
        return { ok: false, kind: timedOut ? "timeout" : "unreachable" };
      }
      await sleep(backoffMs(i, null));
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, kind: "unreachable" };
}
