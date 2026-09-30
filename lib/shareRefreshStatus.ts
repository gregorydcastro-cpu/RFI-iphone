/**
 * Field-crew copy for manual Refresh all.
 *
 * The portal compares pinned sheets to known pack revisions. It does not
 * download drawings and does not call Procore REST. These helpers turn that
 * result into progress, success, and "could not refresh" lines.
 */

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
}): string | null {
  if (!input.canRefresh) return PULLER_ONLY;
  if (!input.procoreConnected) return PROCORE_METADATA_ONLY;
  return null;
}

export function shareRefreshFailureMessage(input: {
  status: number;
  error?: string;
}): string {
  if (input.status === 401) return "Sign in to refresh pinned sheets.";
  if (input.status === 403) return PULLER_ONLY;
  const error = input.error?.trim() ?? "";
  if (
    error.length === 0 ||
    /cookie|header|sheet_revision_cache|pinned_sheets|notify_email|procoreLinked/i.test(
      error,
    )
  ) {
    return "Refresh all did not finish. Try again.";
  }
  return error;
}
