/**
 * Field copy for a Procore pack refresh or pack load.
 * Short title, short message. Empty (nothing to show) is a status.
 * A dropped load is an alert with Retry. Reconnect is not an auto-retry loop.
 * No tokens, no raw fetch or status text.
 */

import type { RoomPack, Sheet } from "./pack.ts";
import {
  PACK_JOB_TEXT,
  PACK_RECONNECT_STRIP,
  PACK_RETRY_STRIP,
  PACK_RETRY_TEXT,
  packPullNotice,
  type PackPullNotice,
} from "./procoreAuthHealth.ts";
import { isRoomPackShape } from "./packStatus.ts";

/** One extra attempt after a fast network drop, 5xx, or empty/partial body. */
export const PACK_LOAD_ATTEMPTS = 2;
export const PACK_LOAD_BACKOFF_MS = 400;

export const PACK_NETWORK_TEXT =
  "Shaky signal. This pack stays on screen. Tap Retry.";

export const PACK_EMPTY_BODY_TEXT =
  "The pack came back empty. This pack stays on screen. Tap Retry.";

export const PACK_PARTIAL_TEXT =
  "The pack came back incomplete. This pack stays on screen. Tap Retry.";

export const PACK_EMPTY_TITLE = "No sheets in this pack";
export const PACK_EMPTY_MESSAGE = "Nothing to show for this room yet.";

export const PACK_NONE_TITLE = "No pack yet";
export const PACK_NONE_MESSAGE = "Nothing to show for this room.";

export const PACK_KEPT_TEXT = "No newer pack. This one stays on screen.";

export const PACK_START_TEXT =
  "That pull could not start. The saved pack stays on screen.";

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export type PackPayloadState = "missing" | "partial" | "empty" | "ready";

export function packEmptySpeak(): string {
  return `${PACK_EMPTY_TITLE}. ${PACK_EMPTY_MESSAGE}`;
}

export function packNoneSpeak(): string {
  return `${PACK_NONE_TITLE}. ${PACK_NONE_MESSAGE}`;
}

export function isTransientPackStatus(status: number): boolean {
  return TRANSIENT_STATUS.has(status) || (status >= 500 && status <= 599);
}

/**
 * A room pack the viewer can draw, an honest empty (no sheets),
 * or a body that stopped early.
 */
export function packPayloadState(pack: unknown): PackPayloadState {
  if (pack == null) return "missing";
  if (!isRoomPackShape(pack)) return "partial";
  if (pack.sheets.length === 0) return "empty";
  for (const sheet of pack.sheets) {
    if (!isSheetId(sheet)) return "partial";
  }
  return "ready";
}

function isSheetId(sheet: unknown): sheet is Sheet {
  if (!sheet || typeof sheet !== "object") return false;
  const id = (sheet as { id?: unknown }).id;
  return typeof id === "string" && id.trim().length > 0;
}

/**
 * One automatic retry. A client deadline does not start another wait.
 * Reconnect, view-only, and not-found do not loop.
 */
export function shouldAutoRetryPackLoad(input: {
  attempt: number;
  attempts?: number;
  network?: boolean;
  timedOut?: boolean;
  emptyBody?: boolean;
  partial?: boolean;
  httpStatus?: number;
  reconnectNeeded?: boolean;
  restReason?: string | null;
  viewOnly?: boolean;
}): boolean {
  const attempts = input.attempts ?? PACK_LOAD_ATTEMPTS;
  if (input.attempt >= attempts - 1) return false;
  if (input.viewOnly || input.timedOut) return false;
  if (input.reconnectNeeded) return false;
  const reason = input.restReason ?? "";
  if (
    reason === "token_refresh_failed" ||
    reason === "missing_tokens" ||
    reason === "missing_oauth" ||
    reason === "project_not_found"
  ) {
    return false;
  }
  const status = input.httpStatus ?? 0;
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }
  if (input.network || input.emptyBody || input.partial) return true;
  if (isTransientPackStatus(status)) return true;
  if (reason === "procore_unreachable" || reason === "api_error") return true;
  return false;
}

export function packFieldTitle(notice: PackPullNotice): string {
  if (notice.tone === "reconnect") return "Procore needs a reconnect";
  if (notice.tone === "hint") return "Saved pack";
  return "Pack did not load";
}

export function packFieldSpeak(notice: PackPullNotice): string {
  return `${packFieldTitle(notice)}. ${notice.text}`;
}

export function packFieldAlert(notice: PackPullNotice): boolean {
  return notice.tone === "retry";
}

type PackBody = {
  ok?: unknown;
  source?: unknown;
  pull?: unknown;
  restReason?: unknown;
  reconnectNeeded?: unknown;
  pack?: unknown;
};

function asBody(value: unknown): PackBody {
  if (!value || typeof value !== "object") return {};
  return value as PackBody;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function retryNotice(text: string): PackPullNotice {
  return {
    tone: "retry",
    text,
    strip: PACK_RETRY_STRIP,
    reconnect: false,
    retry: true,
  };
}

function hintNotice(text: string, strip: string): PackPullNotice {
  return {
    tone: "hint",
    text,
    strip,
    reconnect: false,
    retry: false,
  };
}

export type PackHttpClass = {
  pack?: RoomPack;
  source?: string;
  pull?: string;
  restReason?: string;
  notice: PackPullNotice | null;
  viewOnly: boolean;
  offline: boolean;
  /** Honest empty: nothing to show. Not a failed load. */
  empty: boolean;
  httpStatus: number;
  autoRetry: boolean;
};

/**
 * Turn one pack refresh or live response into field copy.
 * `error` strings on the body are ignored.
 */
export function classifyPackHttp(input: {
  httpStatus: number;
  ok: boolean;
  body: unknown;
  network?: boolean;
  timedOut?: boolean;
  /** JSON could not be read, or the body was blank. */
  unreadable?: boolean;
  attempt?: number;
}): PackHttpClass {
  const attempt = input.attempt ?? 0;
  const data = asBody(input.body);
  const restReason = asString(data.restReason);
  const reconnectNeeded = data.reconnectNeeded === true;
  const pull = asString(data.pull);
  const source = asString(data.source);
  const state = packPayloadState(data.pack);
  const shaped =
    state === "ready" || state === "empty" ? (data.pack as RoomPack) : undefined;

  const auto = (extra: {
    network?: boolean;
    timedOut?: boolean;
    emptyBody?: boolean;
    partial?: boolean;
    httpStatus?: number;
    reconnectNeeded?: boolean;
    restReason?: string | null;
    viewOnly?: boolean;
  }) =>
    shouldAutoRetryPackLoad({
      attempt,
      httpStatus: input.httpStatus,
      restReason,
      reconnectNeeded,
      ...extra,
    });

  if (input.timedOut) {
    return {
      notice: packPullNotice({ timedOut: true }),
      viewOnly: false,
      offline: true,
      empty: false,
      httpStatus: 0,
      autoRetry: false,
    };
  }

  if (input.network || (input.httpStatus === 0 && !input.ok)) {
    return {
      notice: retryNotice(PACK_NETWORK_TEXT),
      viewOnly: false,
      offline: true,
      empty: false,
      httpStatus: 0,
      autoRetry: auto({ network: true, httpStatus: 0 }),
    };
  }

  if (input.httpStatus === 403) {
    return {
      viewOnly: true,
      offline: false,
      empty: false,
      notice: null,
      httpStatus: 403,
      autoRetry: false,
    };
  }

  const authNotice = packPullNotice({
    restReason,
    pull,
    reconnectNeeded,
  });
  const reconnect = authNotice?.tone === "reconnect";

  if (input.ok && data.ok === true && shaped && !input.unreadable) {
    return {
      pack: shaped,
      source,
      pull,
      restReason,
      notice: authNotice,
      viewOnly: false,
      offline: false,
      empty: state === "empty",
      httpStatus: input.httpStatus,
      autoRetry: false,
    };
  }

  if (data.pack != null && state === "partial") {
    return {
      restReason,
      source,
      pull,
      notice: reconnect ? authNotice : retryNotice(PACK_PARTIAL_TEXT),
      viewOnly: false,
      offline: true,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: auto({
        partial: !reconnect,
        reconnectNeeded: reconnect || reconnectNeeded,
      }),
    };
  }

  if (reconnect && authNotice) {
    return {
      restReason,
      source,
      pull,
      notice: authNotice,
      viewOnly: false,
      offline: !input.ok,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: false,
    };
  }

  if (input.httpStatus === 404) {
    return {
      restReason,
      notice: null,
      viewOnly: false,
      offline: false,
      empty: true,
      httpStatus: 404,
      autoRetry: false,
    };
  }

  if (restReason === "project_not_found") {
    return {
      restReason,
      notice: hintNotice(PACK_JOB_TEXT, "Saved pack · job not on this Procore account."),
      viewOnly: false,
      offline: !input.ok,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: false,
    };
  }

  if (restReason === "missing_oauth") {
    return {
      restReason,
      notice: hintNotice(
        "Procore isn't connected for this pull. The saved pack stays on screen.",
        PACK_RECONNECT_STRIP,
      ),
      viewOnly: false,
      offline: !input.ok,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: false,
    };
  }

  if (authNotice?.tone === "retry") {
    return {
      restReason,
      source,
      pull,
      notice: authNotice,
      viewOnly: false,
      offline: !input.ok,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: auto({}),
    };
  }

  if (input.httpStatus === 400) {
    return {
      notice: hintNotice(PACK_START_TEXT, PACK_RETRY_STRIP),
      viewOnly: false,
      offline: false,
      empty: false,
      httpStatus: 400,
      autoRetry: false,
    };
  }

  if (input.httpStatus === 401) {
    return {
      notice: hintNotice(
        "Sign in again to pull this pack. The saved pack stays on screen.",
        PACK_RETRY_STRIP,
      ),
      viewOnly: false,
      offline: false,
      empty: false,
      httpStatus: 401,
      autoRetry: false,
    };
  }

  const blank =
    input.unreadable === true ||
    data.pack == null ||
    (input.ok && data.ok !== true);
  if (blank && (input.ok || input.httpStatus === 200 || input.httpStatus === 204)) {
    return {
      restReason,
      notice: retryNotice(PACK_EMPTY_BODY_TEXT),
      viewOnly: false,
      offline: false,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: auto({ emptyBody: true }),
    };
  }

  if (isTransientPackStatus(input.httpStatus)) {
    return {
      restReason,
      notice: retryNotice(PACK_RETRY_TEXT),
      viewOnly: false,
      offline: true,
      empty: false,
      httpStatus: input.httpStatus,
      autoRetry: auto({}),
    };
  }

  return {
    restReason,
    notice: retryNotice(PACK_RETRY_TEXT),
    viewOnly: false,
    offline: !input.ok,
    empty: false,
    httpStatus: input.httpStatus,
    autoRetry: false,
  };
}
