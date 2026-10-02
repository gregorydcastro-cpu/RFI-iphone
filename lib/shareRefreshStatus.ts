/**
 * Field-crew copy for manual Refresh all.
 *
 * The portal compares pinned sheets to known pack revisions. It does not
 * download drawings and does not call Procore REST. These helpers turn that
 * result into progress, success, and "could not refresh" lines.
 */

import {
  SHARE_RECONNECT_NOTE,
  SHARE_REFRESH_TIMEOUT,
} from "./procoreAuthHealth.ts";
import { isTransientPackStatus } from "./packLoadField.ts";
import type { ShareRefreshError, ShareRefreshItem } from "./shareRefresh";

export const SHARE_REFRESH_PROGRESS_LABEL = "Checking pinned sheet revisions…";
export const SHARE_REFRESH_BUSY_LABEL = "Refreshing…";

export type ShareRefreshNotifyView = {
  sent?: boolean;
  code?: string;
};

export type ShareRefreshOutcomeInput = {
  scanned?: number;
  bumped?: number;
  unchanged?: number;
  missing?: number;
  items?: ShareRefreshItem[];
  errors?: ShareRefreshError[];
  notify?: ShareRefreshNotifyView;
};

export type ShareRefreshPinMark = "bumped" | "current" | "unavailable";

export type ShareRefreshLineTone = "update" | "problem" | "hint";

export type ShareRefreshLine = {
  tone: ShareRefreshLineTone;
  text: string;
};

export type ShareRefreshOutcomeTone = "empty" | "clear" | "partial";

export type ShareRefreshOutcome = {
  tone: ShareRefreshOutcomeTone;
  headline: string;
  lines: ShareRefreshLine[];
  notifyLine: string | null;
  marks: Record<string, ShareRefreshPinMark>;
};

const PULLER_ONLY =
  "Refresh all is for pullers. You can still create folders and pin Maple Point packs.";

const PROCORE_METADATA_ONLY =
  "Procore isn't connected. Refresh all checks known pack revisions only. Connect Procore on Account before a live pack pull.";

function sheetName(sheetId: string | undefined): string {
  const id = sheetId?.trim();
  return id && id.length > 0 ? id : "That sheet";
}

function revName(rev: string | null | undefined): string | null {
  const trimmed = rev?.trim();
  return trimmed ? trimmed : null;
}

function pushLine(
  lines: ShareRefreshLine[],
  seen: Set<string>,
  line: ShareRefreshLine,
) {
  if (seen.has(line.text)) return;
  seen.add(line.text);
  lines.push(line);
}

function bumpLine(item: ShareRefreshItem): string {
  const from = revName(item.previous_rev);
  const to = revName(item.current_rev);
  if (from && to) return `${item.sheet_id} moved from Rev ${from} to Rev ${to}.`;
  if (to) return `${item.sheet_id} is now Rev ${to}.`;
  return `${item.sheet_id} has a new revision.`;
}

function headlineFor(input: {
  scanned: number;
  bumped: number;
  sheetFailures: number;
}): string {
  const { scanned, bumped, sheetFailures } = input;
  if (scanned === 0) return "No pinned sheets to check.";
  if (sheetFailures === scanned && bumped === 0) {
    return scanned === 1
      ? "That pinned sheet could not be refreshed."
      : `${scanned} pinned sheets could not be refreshed.`;
  }
  if (bumped === 0 && sheetFailures === 0) {
    return scanned === 1
      ? "Pinned sheet is current."
      : `All ${scanned} pinned sheets are current.`;
  }
  const bits: string[] = [];
  if (bumped > 0) {
    bits.push(bumped === 1 ? "1 revision updated" : `${bumped} revisions updated`);
  }
  if (sheetFailures > 0) {
    bits.push(
      sheetFailures === 1 ? "1 could not refresh" : `${sheetFailures} could not refresh`,
    );
  }
  return `Checked ${scanned} pinned sheets. ${bits.join(", ")}.`;
}

function notifyLineFor(
  notify: ShareRefreshNotifyView | undefined,
  bumped: number,
): string | null {
  if (!notify) return null;
  if (notify.sent || notify.code === "sent") return "Revision email sent.";
  if (notify.code === "send_failed") {
    return "The revision email did not send. The sheet check still saved.";
  }
  if (notify.code === "notify_email_unset" && bumped > 0) {
    return "No revision email — set the notify address on Account.";
  }
  if (notify.code === "notify_unconfigured" && bumped > 0) {
    return "No revision email — mail is not set up on this site.";
  }
  if (notify.code === "persist_failed") {
    return "No revision email — the revision update did not save.";
  }
  return null;
}

export function describeShareRefreshOutcome(
  input: ShareRefreshOutcomeInput,
): ShareRefreshOutcome {
  const items = input.items ?? [];
  const errors = input.errors ?? [];
  const scanned = input.scanned ?? items.length;

  const failedPinIds = new Set(
    errors.flatMap((error) => (error.pin_id ? [error.pin_id] : [])),
  );
  const bumped =
    items.length > 0
      ? items.filter(
          (item) => item.status === "bumped" && !failedPinIds.has(item.pin_id),
        ).length
      : (input.bumped ?? 0);
  const sheetFailures = new Set<string>(failedPinIds);
  for (const item of items) {
    if (item.status === "missing") sheetFailures.add(item.pin_id);
  }

  const lines: ShareRefreshLine[] = [];
  const seen = new Set<string>();
  const marks: Record<string, ShareRefreshPinMark> = {};

  if (scanned === 0) {
    return {
      tone: "empty",
      headline: headlineFor({ scanned: 0, bumped: 0, sheetFailures: 0 }),
      lines: [
        {
          tone: "hint",
          text: "Pin a Maple Point pack or discipline, then refresh again.",
        },
      ],
      notifyLine: null,
      marks,
    };
  }

  for (const item of items) {
    if (failedPinIds.has(item.pin_id)) {
      marks[item.pin_id] = "unavailable";
      continue;
    }
    if (item.status === "missing") {
      marks[item.pin_id] = "unavailable";
      pushLine(lines, seen, {
        tone: "problem",
        text: `${sheetName(item.sheet_id)} could not be refreshed. No current revision is on the pack.`,
      });
      continue;
    }
    if (item.status === "bumped") {
      marks[item.pin_id] = "bumped";
      pushLine(lines, seen, { tone: "update", text: bumpLine(item) });
      continue;
    }
    marks[item.pin_id] = "current";
  }

  for (const error of errors) {
    if (error.pin_id) {
      pushLine(lines, seen, {
        tone: "problem",
        text: `${sheetName(error.sheet_id)} could not be saved. It is still on the previous revision.`,
      });
      continue;
    }
    pushLine(lines, seen, {
      tone: "problem",
      text: "Revision notes could not be saved. Try Refresh all again.",
    });
  }

  const failureCount = sheetFailures.size;
  const tone: ShareRefreshOutcomeTone =
    failureCount > 0 || errors.length > 0 ? "partial" : "clear";

  return {
    tone,
    headline: headlineFor({
      scanned,
      bumped,
      sheetFailures: failureCount,
    }),
    lines,
    notifyLine: notifyLineFor(input.notify, bumped),
    marks,
  };
}

export function shareRefreshBlockedMessage(input: {
  canRefresh: boolean;
  procoreConnected: boolean;
  reconnectNeeded?: boolean;
}): string | null {
  if (!input.canRefresh) return PULLER_ONLY;
  if (input.reconnectNeeded) return SHARE_RECONNECT_NOTE;
  if (!input.procoreConnected) return PROCORE_METADATA_ONLY;
  return null;
}

export function shareRefreshFailureMessage(input: {
  status: number;
  error?: string;
  network?: boolean;
  timedOut?: boolean;
}): string {
  return shareRefreshFailureView(input).message;
}

export type ShareRefreshFailure = {
  title: string;
  message: string;
  speak: string;
  retry: boolean;
};

const SHARE_REFRESH_FAIL_TITLE = "Refresh did not finish";
const SHARE_REFRESH_FAIL_RETRY = "Refresh all did not finish. Tap Retry.";
const SHARE_REFRESH_NETWORK = "Shaky signal. Saved pins stay put. Tap Retry.";

/**
 * Hard failure of Refresh all. Never echoes upstream or table text.
 * Empty (no pins) and a partial check are outcomes, not this card.
 */
export function shareRefreshFailureView(input: {
  status: number;
  error?: string;
  network?: boolean;
  timedOut?: boolean;
}): ShareRefreshFailure {
  if (input.timedOut) {
    const message = SHARE_REFRESH_TIMEOUT;
    return {
      title: SHARE_REFRESH_FAIL_TITLE,
      message,
      speak: `${SHARE_REFRESH_FAIL_TITLE}. ${message}`,
      retry: true,
    };
  }
  if (input.network || input.status === 0) {
    const message = input.network ? SHARE_REFRESH_NETWORK : SHARE_REFRESH_TIMEOUT;
    return {
      title: SHARE_REFRESH_FAIL_TITLE,
      message,
      speak: `${SHARE_REFRESH_FAIL_TITLE}. ${message}`,
      retry: true,
    };
  }
  if (input.status === 401) {
    const message = "Sign in to refresh pinned sheets.";
    return {
      title: "Sign in to refresh",
      message,
      speak: message,
      retry: false,
    };
  }
  if (input.status === 403) {
    return {
      title: "Pullers only",
      message: PULLER_ONLY,
      speak: PULLER_ONLY,
      retry: false,
    };
  }
  const retry = isTransientPackStatus(input.status);
  const message = SHARE_REFRESH_FAIL_RETRY;
  return {
    title: SHARE_REFRESH_FAIL_TITLE,
    message,
    speak: `${SHARE_REFRESH_FAIL_TITLE}. ${message}`,
    retry,
  };
}

export function shareOutcomeSpeak(outcome: ShareRefreshOutcome): string {
  return [outcome.headline, ...outcome.lines.map((line) => line.text), outcome.notifyLine]
    .filter((line): line is string => Boolean(line && line.trim()))
    .join(" ");
}

/** One retry for a fast drop, a 5xx, or an unreadable body. A timeout does not start another wait. */
export function shouldAutoRetryShareRefresh(input: {
  attempt: number;
  attempts?: number;
  status?: number;
  network?: boolean;
  emptyBody?: boolean;
  timedOut?: boolean;
}): boolean {
  const attempts = input.attempts ?? 2;
  if (input.attempt >= attempts - 1) return false;
  if (input.timedOut) return false;
  const status = input.status ?? 0;
  if (status === 401 || status === 403 || status === 400 || status === 404) {
    return false;
  }
  if (input.network || input.emptyBody) return true;
  return isTransientPackStatus(status);
}
