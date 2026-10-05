/**
 * Field copy for a markup cloud save.
 * Short title, short message. Nothing drawn is a status.
 * A dropped save is an alert with Retry. One automatic retry for a fast
 * network drop, a server miss, or a save that stops early, then the banner.
 * The local copy stays. No keys, no raw fetch text.
 */

import type {
  MarkupOverlayRecord,
  MarkupStorageKind,
  MarkupVectorsJson,
} from "./markup.ts";

/** One extra attempt after a fast network drop, 5xx, or a save that stops early. */
export const MARKUP_SAVE_ATTEMPTS = 2;
export const MARKUP_SAVE_BACKOFF_MS = 400;
/** Past the server's markup write budget so a slow save can finish. */
export const MARKUP_SAVE_TIMEOUT_MS = 12_000;

export const MARKUP_SAVE_FAILS = [
  "network",
  "server",
  "abort",
  "view_only",
  "signed_out",
] as const;

export type MarkupSaveFail = (typeof MARKUP_SAVE_FAILS)[number];

export const MARKUP_SAVE_TITLE = "Markup did not save";

export const MARKUP_NETWORK_MESSAGE =
  "Shaky signal. Kept on this device. Tap Retry.";

export const MARKUP_SERVER_MESSAGE =
  "Could not save this markup. Kept on this device. Tap Retry.";

export const MARKUP_ABORT_MESSAGE =
  "The save stopped early. Kept on this device. Tap Retry.";

export const MARKUP_VIEW_ONLY_MESSAGE = "This login is view-only.";

export const MARKUP_SIGNED_OUT_MESSAGE = "Sign in first.";

export const MARKUP_BAD_MESSAGE = "Could not save this markup.";

export const MARKUP_EMPTY_TITLE = "Nothing to save";
export const MARKUP_EMPTY_MESSAGE = "No markup on this sheet yet.";

export const MARKUP_DRAFT_STILL =
  "Draft still goes to the foreman.";

export type MarkupSaveBanner = {
  title: string;
  message: string;
  speak: string;
  retry: boolean;
};

export type MarkupSaveSurface =
  | { kind: "saving"; label: "Saving…"; tone: "saving" }
  | { kind: "saved"; label: "Saved"; tone: "saved" }
  | { kind: "local"; label: "Local only"; tone: "local" }
  | { kind: "empty"; title: string; message: string; speak: string }
  | ({ kind: "error" } & MarkupSaveBanner);

export type MarkupPutResult = {
  storage: MarkupStorageKind;
  fail: MarkupSaveFail | null;
  retryable: boolean;
  httpStatus: number;
  row: MarkupOverlayRecord | null;
};

const QUERY_VALUES = new Set<string>([
  "failed",
  "network",
  "server",
  "abort",
  "view_only",
  "signed_out",
]);

function speak(title: string, message: string): string {
  return `${title}. ${message}`;
}

function banner(message: string, retry: boolean): MarkupSaveBanner {
  return {
    title: MARKUP_SAVE_TITLE,
    message,
    speak: speak(MARKUP_SAVE_TITLE, message),
    retry,
  };
}

export function markupSaveEmptySpeak(): string {
  return speak(MARKUP_EMPTY_TITLE, MARKUP_EMPTY_MESSAGE);
}

/**
 * Phone-sized failure copy. Retry only when another tap can land the cloud write.
 * View-only and signed-out do not offer Retry.
 */
export function markupSaveBanner(
  fail: MarkupSaveFail,
  retryable = true,
): MarkupSaveBanner {
  if (fail === "view_only") return banner(MARKUP_VIEW_ONLY_MESSAGE, false);
  if (fail === "signed_out") return banner(MARKUP_SIGNED_OUT_MESSAGE, false);
  if (fail === "network") return banner(MARKUP_NETWORK_MESSAGE, true);
  if (fail === "abort") return banner(MARKUP_ABORT_MESSAGE, true);
  if (!retryable) return banner(MARKUP_BAD_MESSAGE, false);
  return banner(MARKUP_SERVER_MESSAGE, true);
}

/** Same card, plus the foreman draft that a failed cloud save still allows. */
export function markupSaveDraftBanner(
  fail: MarkupSaveFail,
  retryable = true,
): MarkupSaveBanner {
  const base = markupSaveBanner(fail, retryable);
  const message = base.message.includes("Tap Retry.")
    ? base.message.replace("Tap Retry.", `${MARKUP_DRAFT_STILL} Tap Retry.`)
    : `${base.message} ${MARKUP_DRAFT_STILL}`;
  return {
    ...base,
    message,
    speak: speak(base.title, message),
  };
}

export function isMarkupSaveFail(value: unknown): value is MarkupSaveFail {
  return (
    value === "network" ||
    value === "server" ||
    value === "abort" ||
    value === "view_only" ||
    value === "signed_out"
  );
}

export function markupSaveQueryValue(
  value: boolean | string | null | undefined,
): string | null {
  if (value === true) return "failed";
  if (typeof value !== "string") return null;
  return QUERY_VALUES.has(value) ? value : null;
}

/** `failed` is the older query. It is a server miss the crew can retry. */
export function markupSaveFromQuery(value: string | null | undefined): {
  fail: MarkupSaveFail | null;
  retryable: boolean;
} {
  if (value === "network" || value === "abort") return { fail: value, retryable: true };
  if (value === "server" || value === "failed") return { fail: "server", retryable: true };
  if (value === "view_only") return { fail: "view_only", retryable: false };
  if (value === "signed_out") return { fail: "signed_out", retryable: false };
  return { fail: null, retryable: false };
}

/**
 * Nothing drawn is a status. A failed cloud write is an alert, including a
 * clear that did not reach the crew. In-flight with no failure yet stays the chip.
 * A retry keeps the card up.
 */
export function markupSaveSurface(input: {
  saving?: boolean;
  itemCount: number;
  storage: MarkupStorageKind;
  persistFailed?: boolean;
  fail?: MarkupSaveFail | null;
  retryable?: boolean;
  /** A finished write that left the sheet empty. Not the resting chip. */
  settledEmpty?: boolean;
}): MarkupSaveSurface {
  if (input.fail && isMarkupSaveFail(input.fail)) {
    return {
      kind: "error",
      ...markupSaveBanner(input.fail, input.retryable !== false),
    };
  }
  if (input.saving) return { kind: "saving", label: "Saving…", tone: "saving" };
  if (input.persistFailed || input.storage === "unavailable") {
    return {
      kind: "error",
      ...markupSaveBanner("server", input.retryable !== false),
    };
  }
  if (input.settledEmpty && input.itemCount <= 0) {
    return {
      kind: "empty",
      title: MARKUP_EMPTY_TITLE,
      message: MARKUP_EMPTY_MESSAGE,
      speak: markupSaveEmptySpeak(),
    };
  }
  if (input.storage === "supabase") {
    return { kind: "saved", label: "Saved", tone: "saved" };
  }
  return { kind: "local", label: "Local only", tone: "local" };
}

export function shouldAutoRetryMarkupSave(input: {
  attempt: number;
  attempts?: number;
  fail: MarkupSaveFail | null;
  retryable: boolean;
}): boolean {
  const attempts = input.attempts ?? MARKUP_SAVE_ATTEMPTS;
  if (input.attempt >= attempts - 1) return false;
  if (!input.retryable || !input.fail) return false;
  return input.fail === "network" || input.fail === "abort" || input.fail === "server";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function asRow(value: unknown): MarkupOverlayRecord | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = record.id;
  if (typeof id !== "string" || id.trim().length === 0) return null;
  return record as MarkupOverlayRecord;
}

/**
 * One PUT response. `error` text on the body is ignored.
 * An empty sheet is not decided here — the caller counts vectors.
 */
export function classifyMarkupPutResponse(input: {
  thrown?: boolean;
  aborted?: boolean;
  offline?: boolean;
  unreadable?: boolean;
  httpStatus?: number;
  ok?: boolean;
  body?: unknown;
}): MarkupPutResult {
  const status = input.httpStatus ?? 0;
  if (input.aborted || input.unreadable) {
    return {
      storage: "local",
      fail: "abort",
      retryable: true,
      httpStatus: status,
      row: null,
    };
  }
  if (input.offline || input.thrown || status === 0) {
    return {
      storage: "local",
      fail: "network",
      retryable: true,
      httpStatus: 0,
      row: null,
    };
  }
  if (status === 401) {
    return {
      storage: "local",
      fail: "signed_out",
      retryable: false,
      httpStatus: status,
      row: null,
    };
  }
  if (status === 403) {
    return {
      storage: "local",
      fail: "view_only",
      retryable: false,
      httpStatus: status,
      row: null,
    };
  }
  if (status === 400) {
    return {
      storage: "local",
      fail: "server",
      retryable: false,
      httpStatus: status,
      row: null,
    };
  }

  const data = asRecord(input.body);
  const row = asRow(data?.row);
  const storage = typeof data?.storage === "string" ? data.storage : "";
  const named = isMarkupSaveFail(data?.fail) ? data.fail : null;
  const ok = input.ok !== false && (data?.ok !== false);

  if (ok && storage === "supabase" && row) {
    return { storage: "supabase", fail: null, retryable: false, httpStatus: status, row };
  }
  if (ok && (storage === "unconfigured" || storage === "local")) {
    return {
      storage: storage === "local" ? "local" : "unconfigured",
      fail: null,
      retryable: false,
      httpStatus: status,
      row,
    };
  }
  if (ok && storage === "unavailable") {
    const fail = named ?? "server";
    const retryable = fail === "network" || fail === "abort" || fail === "server";
    return {
      storage: "unavailable",
      fail,
      retryable,
      httpStatus: status,
      row,
    };
  }
  if (status === 408 || status === 504) {
    return {
      storage: "local",
      fail: "abort",
      retryable: true,
      httpStatus: status,
      row: null,
    };
  }
  if (status === 429 || status >= 500) {
    return {
      storage: "local",
      fail: "server",
      retryable: true,
      httpStatus: status,
      row: null,
    };
  }
  return {
    storage: "local",
    fail: "server",
    retryable: true,
    httpStatus: status,
    row: null,
  };
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMarkupPut(input: {
  id: string;
  requestId: string;
  sheetId: string;
  vectors: MarkupVectorsJson;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<MarkupPutResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await input.fetchImpl("/api/markups", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: input.id,
        request_id: input.requestId,
        sheet_id: input.sheetId,
        vectors: input.vectors,
      }),
      signal: controller.signal,
    });
    let body: unknown = null;
    let unreadable = false;
    try {
      body = await response.json();
    } catch {
      unreadable = true;
    }
    return classifyMarkupPutResponse({
      httpStatus: response.status,
      ok: response.ok,
      body,
      unreadable,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return classifyMarkupPutResponse({
      thrown: !aborted,
      aborted,
      httpStatus: 0,
      body: null,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cloud write for one overlay. Retries a dropped, aborted, or 5xx save once.
 * View-only, signed-out, and a bad body do not loop. Does not touch localStorage.
 */
export async function putMarkupOverlay(input: {
  id: string;
  requestId: string;
  sheetId: string;
  vectors: MarkupVectorsJson;
  fetchImpl?: typeof fetch;
  attempts?: number;
  backoffMs?: number;
  timeoutMs?: number;
}): Promise<MarkupPutResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts = input.attempts ?? MARKUP_SAVE_ATTEMPTS;
  const backoffMs = input.backoffMs ?? MARKUP_SAVE_BACKOFF_MS;
  const timeoutMs = input.timeoutMs ?? MARKUP_SAVE_TIMEOUT_MS;
  let last = classifyMarkupPutResponse({ thrown: true, httpStatus: 0, body: null });
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    last = offline
      ? classifyMarkupPutResponse({ offline: true, httpStatus: 0, body: null })
      : await fetchMarkupPut({
          id: input.id,
          requestId: input.requestId,
          sheetId: input.sheetId,
          vectors: input.vectors,
          fetchImpl,
          timeoutMs,
        });
    if (!last.fail) return last;
    if (
      !shouldAutoRetryMarkupSave({
        attempt,
        attempts,
        fail: last.fail,
        retryable: last.retryable,
      })
    ) {
      return last;
    }
    await wait(backoffMs);
  }
  return last;
}
