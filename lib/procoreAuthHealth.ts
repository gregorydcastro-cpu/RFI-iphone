/**
 * Field-facing Procore auth health. No tokens, no client secrets.
 *
 * A stored row is not proof the puller is still signed in with Procore.
 * Access tokens last ~1.5h. When the refresh grant is rejected, the row
 * keeps notify_email but drops the refresh token and moves expires_at
 * into the past so status can say reconnect without a new column.
 */

import { accessTokenNeedsRefresh } from "./procoreTokenExpiry.ts";

/** Past stamp written when a refresh grant is rejected. Not a secret. */
export const PROCORE_RECONNECT_EXPIRES_AT = "1970-01-01T00:00:00.000Z";

/** Phone wait for one pack pull. Server budget is shorter. */
export const PACK_REFRESH_CLIENT_MS = 25_000;

/** Phone wait for Refresh all. The revision check does not call Procore. */
export const SHARE_REFRESH_CLIENT_MS = 25_000;

export const PACK_RECONNECT_TEXT =
  "Procore needs a reconnect. This pack stays on screen. Reconnect, then pull again.";

export const PACK_RETRY_TEXT =
  "Procore didn't answer. This pack stays on screen. Retry when you have a signal.";

export const PACK_TIMEOUT_TEXT =
  "Pull didn't finish. This pack stays on screen. Retry.";

export const PACK_JOB_TEXT =
  "That job isn't on this Procore account. The saved pack stays on screen.";

export const PACK_RECONNECT_STRIP = "Saved pack · Procore needs a reconnect.";
export const PACK_RETRY_STRIP = "Saved pack · pull did not finish.";
export const PACK_JOB_STRIP = "Saved pack · job not on this Procore account.";

export const SHARE_RECONNECT_NOTE =
  "Procore needs a reconnect. Refresh all still checks saved revisions. Reconnect before a live pack pull.";

export const SHARE_REFRESH_TIMEOUT =
  "Refresh all didn't finish. Saved pins stay put. Retry.";

const SAFE_RETURN =
  /^\/(?:account|time|share|jobs(?:\/[A-Za-z0-9_-]+)?|pack\/[A-Za-z0-9._-]+)(?:\?[A-Za-z0-9._~%=&-]*)?$/;

/**
 * Same-site return after Connect Procore. Pack, jobs, share, time, account.
 * Rejects open redirects and path tricks.
 */
export function safeProcoreReturnPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 200) return null;
  if (trimmed.includes("..") || trimmed.includes("//") || trimmed.includes("\\")) {
    return null;
  }
  if (!SAFE_RETURN.test(trimmed)) return null;
  return trimmed;
}

export function procoreReturnFromCookie(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    return safeProcoreReturnPath(decodeURIComponent(value));
  } catch {
    return safeProcoreReturnPath(value);
  }
}

export function procoreReconnectHref(returnPath?: string | null): string {
  const safe = safeProcoreReturnPath(returnPath);
  if (!safe) return "/api/procore/connect";
  return `/api/procore/connect?next=${encodeURIComponent(safe)}`;
}

/**
 * 400/401/403 on the token endpoint means the refresh token is dead.
 * Timeouts, 429, and 5xx are a blip — keep the stored tokens.
 */
export function classifyProcoreTokenFailure(
  status: number,
): "rejected" | "transient" {
  if (status === 400 || status === 401 || status === 403) return "rejected";
  return "transient";
}

/**
 * True when this row cannot mint a new access token.
 * A future expiry with a refresh token is still connected.
 */
export function procoreReconnectNeeded(input: {
  expiresAt: string | null | undefined;
  hasRefreshToken: boolean;
  nowMs?: number;
}): boolean {
  if (input.hasRefreshToken) return false;
  return accessTokenNeedsRefresh(input.expiresAt, input.nowMs);
}

export type PackPullNoticeTone = "reconnect" | "retry" | "hint";

export type PackPullNotice = {
  tone: PackPullNoticeTone;
  text: string;
  strip: string;
  reconnect: boolean;
  retry: boolean;
};

const RECONNECT_NOTICE: PackPullNotice = {
  tone: "reconnect",
  text: PACK_RECONNECT_TEXT,
  strip: PACK_RECONNECT_STRIP,
  reconnect: true,
  retry: true,
};

const RETRY_NOTICE: PackPullNotice = {
  tone: "retry",
  text: PACK_RETRY_TEXT,
  strip: PACK_RETRY_STRIP,
  reconnect: false,
  retry: true,
};

const TIMEOUT_NOTICE: PackPullNotice = {
  tone: "retry",
  text: PACK_TIMEOUT_TEXT,
  strip: PACK_RETRY_STRIP,
  reconnect: false,
  retry: true,
};

const JOB_NOTICE: PackPullNotice = {
  tone: "hint",
  text: PACK_JOB_TEXT,
  strip: PACK_JOB_STRIP,
  reconnect: false,
  retry: false,
};

/**
 * Soft-fail copy for a pack pull. A live Procore pull with reason ok
 * clears the banner. Cached packs stay on screen either way.
 */
export function packPullNotice(input: {
  restReason?: string | null;
  pull?: string | null;
  reconnectNeeded?: boolean;
  timedOut?: boolean;
  viewOnly?: boolean;
}): PackPullNotice | null {
  if (input.viewOnly) return null;
  if (input.timedOut) return TIMEOUT_NOTICE;
  if (input.reconnectNeeded) return RECONNECT_NOTICE;
  if (input.pull === "procore" && (!input.restReason || input.restReason === "ok")) {
    return null;
  }
  switch (input.restReason) {
    case "token_refresh_failed":
    case "missing_tokens":
      return RECONNECT_NOTICE;
    case "procore_unreachable":
    case "api_error":
      return RETRY_NOTICE;
    case "project_not_found":
      return JOB_NOTICE;
    default:
      return null;
  }
}

export function restNeedsReconnect(reason: string | null | undefined): boolean {
  return reason === "token_refresh_failed" || reason === "missing_tokens";
}
