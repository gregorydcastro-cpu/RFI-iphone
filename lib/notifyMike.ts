/**
 * Email the share-folder owner when a pinned sheet revision actually bumps.
 *
 * Server-only. Destination is `procore_connections.notify_email` for the
 * owner_user_id on each persisted bump (pin → share_folders → connection).
 * NOTIFY_MIKE_EMAIL is a temporary fallback only when that column is unset.
 * Sender is RESEND_API_KEY (or Gmail SMTP). Never NEXT_PUBLIC_ these keys.
 *
 * Missing per-user email (and no fallback) is a structured skip
 * (notify_email_unset, status 200). Missing mailer env is
 * notify_unconfigured (503 on the notify object). Refresh callers must
 * not fail the persist when notify is skipped or send fails.
 */

import type { GmailSmtpInput, GmailSmtpResult } from "./gmailSmtp";
import type { ShareRefreshBump, ShareRefreshError } from "./shareRefresh";

export const NOTIFY_MIKE_EMAIL_KEY = "NOTIFY_MIKE_EMAIL";
export const NOTIFY_FROM_EMAIL_KEY = "NOTIFY_FROM_EMAIL";
export const RESEND_API_KEY_NAME = "RESEND_API_KEY";
export const RESEND_FROM_KEY = "RESEND_FROM";
export const GMAIL_USER_KEY = "GMAIL_USER";
export const GMAIL_APP_PASSWORD_KEY = "GMAIL_APP_PASSWORD";
export const NOTIFY_MIKE_SMS_KEY = "NOTIFY_MIKE_SMS";

export const RESEND_API_URL = "https://api.resend.com/emails";
export const DEFAULT_NOTIFY_FROM = "GC Field Log <notify@gcfieldlog.com>";

export type NotifyMikeCode =
  | "no_bumps"
  | "persist_failed"
  | "notify_unconfigured"
  | "notify_email_unset"
  | "sent"
  | "send_failed";

export type NotifyMikeProvider = "resend" | "gmail" | null;

export type NotifyMikeSummary = {
  attempted: boolean;
  sent: boolean;
  skipped: boolean;
  code: NotifyMikeCode;
  status: 200 | 503;
  bumps: number;
  provider: NotifyMikeProvider;
  to_configured: boolean;
  recipients: number;
  skipped_unset: number;
  fallback_used: boolean;
  sms: { attempted: false; todo: true };
  note: string;
};

export type NotifyMikeMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
};

export type NotifyMikeSendResult = {
  ok: boolean;
  error?: string;
};

export type NotifyMikeDeps = {
  fetch?: typeof fetch;
  sendGmail?: (input: GmailSmtpInput) => Promise<GmailSmtpResult>;
  lookupNotifyEmails?: (userIds: string[]) => Promise<Map<string, string | null>>;
};

function readSecretEnv(key: string): string | undefined {
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readSecretEnvAlias(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = readSecretEnv(key);
    if (value) return value;
  }
  return undefined;
}

export const NOTIFY_EMAIL_COLUMN = "notify_email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotifyEmailParse =
  | { ok: true; notify_email: string | null }
  | { ok: false; error: string };

export type NotifyRecipientSource = "notify_email" | "fallback";

export type NotifyRecipientDelivery = {
  to: string;
  owner_user_id: string;
  source: NotifyRecipientSource;
  bumps: ShareRefreshBump[];
};

export type NotifyRecipientSkipReason = "unset" | "no_owner";

export type NotifyRecipientSkip = {
  owner_user_id: string | null;
  reason: NotifyRecipientSkipReason;
  bumps: ShareRefreshBump[];
};

export type NotifyRecipientPlan = {
  deliveries: NotifyRecipientDelivery[];
  skipped: NotifyRecipientSkip[];
};

/** Trim + basic email validation. Blank becomes null (clear / skip). */
export function parseNotifyEmailInput(
  value: string | null | undefined,
): NotifyEmailParse {
  if (value == null) return { ok: true, notify_email: null };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, notify_email: null };
  if (!EMAIL_RE.test(trimmed)) {
    return { ok: false, error: "Enter a valid notify email." };
  }
  return { ok: true, notify_email: trimmed.toLowerCase() };
}

export function isNotifyEmail(value: string | undefined | null): value is string {
  return Boolean(value && EMAIL_RE.test(value));
}

export function normalizeNotifyEmail(
  value: string | null | undefined,
): string | null {
  const parsed = parseNotifyEmailInput(value);
  return parsed.ok ? parsed.notify_email : null;
}

/**
 * Group persisted bumps by folder owner, then attach notify_email.
 * Prefer the per-user column. Optional fallback (NOTIFY_MIKE_EMAIL) is
 * temporary migration cover only.
 */
export function resolveBumpNotifyRecipients(
  bumps: ShareRefreshBump[],
  emailsByUserId: Map<string, string | null>,
  fallbackEmail?: string | null,
): NotifyRecipientPlan {
  const fallback = normalizeNotifyEmail(fallbackEmail);
  const byOwner = new Map<string | null, ShareRefreshBump[]>();
  for (const bump of bumps) {
    const owner = bump.owner_user_id?.trim() || null;
    const list = byOwner.get(owner) ?? [];
    list.push(bump);
    byOwner.set(owner, list);
  }

  const deliveries: NotifyRecipientDelivery[] = [];
  const skipped: NotifyRecipientSkip[] = [];

  for (const [owner_user_id, ownerBumps] of byOwner) {
    if (!owner_user_id) {
      skipped.push({ owner_user_id: null, reason: "no_owner", bumps: ownerBumps });
      continue;
    }
    const stored = normalizeNotifyEmail(emailsByUserId.get(owner_user_id));
    if (stored) {
      deliveries.push({
        to: stored,
        owner_user_id,
        source: "notify_email",
        bumps: ownerBumps,
      });
      continue;
    }
    if (fallback) {
      deliveries.push({
        to: fallback,
        owner_user_id,
        source: "fallback",
        bumps: ownerBumps,
      });
      continue;
    }
    skipped.push({ owner_user_id, reason: "unset", bumps: ownerBumps });
  }

  return { deliveries, skipped };
}

/** Temporary global fallback. Prefer procore_connections.notify_email. */
export function readNotifyMikeEmail(): string | undefined {
  const configured = readSecretEnv(NOTIFY_MIKE_EMAIL_KEY);
  if (isNotifyEmail(configured)) return configured.toLowerCase();
  return undefined;
}

export function readNotifyFromEmail(): string | undefined {
  const configured = readSecretEnvAlias(NOTIFY_FROM_EMAIL_KEY, RESEND_FROM_KEY, GMAIL_USER_KEY);
  return configured;
}

export function readResendApiKey(): string | undefined {
  return readSecretEnv(RESEND_API_KEY_NAME);
}

export function readGmailSmtpConfig(): { user: string; password: string } | null {
  const user = readSecretEnv(GMAIL_USER_KEY);
  const password = readSecretEnv(GMAIL_APP_PASSWORD_KEY);
  if (!isNotifyEmail(user) || !password) return null;
  return { user, password };
}

export function notifyMailerConfigured(): boolean {
  return Boolean(readResendApiKey() || readGmailSmtpConfig());
}

/** Shared sender is configured. Recipients come from notify_email rows. */
export function notifyMikeConfigured(): boolean {
  return notifyMailerConfigured();
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(invalid)";
  const shown = local.slice(0, 1);
  return `${shown}***@${domain}`;
}

/** Bumps that persisted. Cache-wide failure or per-sheet persist errors skip notify. */
export function notifyEligibleBumps(
  bumps: ShareRefreshBump[],
  errors: ShareRefreshError[] = [],
): ShareRefreshBump[] {
  if (bumps.length === 0) return [];
  const cacheFailed = errors.some((item) => item.error.includes("sheet_revision_cache"));
  if (cacheFailed) return [];
  const failed = new Set(
    errors
      .filter((item) => item.sheet_id)
      .map((item) => `${item.project_name ?? ""}::${item.sheet_id}`),
  );
  return bumps.filter((bump) => !failed.has(`${bump.project_name}::${bump.sheet_id}`));
}

export function formatNotifyMikeMessage(bumps: ShareRefreshBump[]): {
  subject: string;
  text: string;
} {
  const first = bumps[0];
  const subject =
    bumps.length === 1 && first
      ? `GC Field Log: ${first.sheet_id} bumped to Rev ${first.new_rev}`
      : `GC Field Log: ${bumps.length} pinned sheet revisions bumped`;

  const lines = [
    "Pinned sheet revision bumped.",
    "",
    ...bumps.flatMap((bump) => [
      `Project: ${bump.project_name}`,
      `Sheet: ${bump.sheet_id}`,
      `Revision: ${bump.old_rev || "(none)"} → ${bump.new_rev}`,
      "",
    ]),
    "Unchanged sheets were not notified.",
  ];

  return { subject, text: lines.join("\n").trim() };
}

function summary(input: {
  code: NotifyMikeCode;
  bumps: number;
  provider?: NotifyMikeProvider;
  toConfigured?: boolean;
  recipients?: number;
  skippedUnset?: number;
  fallbackUsed?: boolean;
  note: string;
}): NotifyMikeSummary {
  const sent = input.code === "sent";
  const skipped =
    input.code === "no_bumps" ||
    input.code === "persist_failed" ||
    input.code === "notify_unconfigured" ||
    input.code === "notify_email_unset";
  const attempted = input.code === "sent" || input.code === "send_failed";
  return {
    attempted,
    sent,
    skipped,
    code: input.code,
    status:
      sent ||
      input.code === "no_bumps" ||
      input.code === "persist_failed" ||
      input.code === "notify_email_unset"
        ? 200
        : 503,
    bumps: input.bumps,
    provider: input.provider ?? null,
    to_configured: Boolean(input.toConfigured),
    recipients: input.recipients ?? 0,
    skipped_unset: input.skippedUnset ?? 0,
    fallback_used: Boolean(input.fallbackUsed),
    sms: { attempted: false, todo: true },
    note: input.note,
  };
}

async function sendResendEmail(
  message: NotifyMikeMessage,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<NotifyMikeSendResult> {
  const response = await fetchImpl(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (response.ok) return { ok: true };
  let detail = `resend_http_${response.status}`;
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      detail = body.message.trim().slice(0, 180);
    }
  } catch {
    /* keep status code */
  }
  return { ok: false, error: detail };
}

async function lookupEmails(
  userIds: string[],
  deps: NotifyMikeDeps,
): Promise<Map<string, string | null>> {
  if (deps.lookupNotifyEmails) return deps.lookupNotifyEmails(userIds);
  const { fetchNotifyEmailsByUserIds } = await import("./notifyEmailStore");
  return fetchNotifyEmailsByUserIds(userIds);
}

function skippedUnsetCount(plan: NotifyRecipientPlan): number {
  return plan.skipped.reduce((sum, item) => sum + item.bumps.length, 0);
}

/**
 * After a refresh persist, email each bump's connection owner when they
 * have notify_email set. Never throws — callers attach the structured
 * result and keep refresh ok.
 */
export async function notifyMikeOnBumps(
  bumps: ShareRefreshBump[],
  errors: ShareRefreshError[] = [],
  deps: NotifyMikeDeps = {},
): Promise<NotifyMikeSummary> {
  const eligible = notifyEligibleBumps(bumps, errors);
  if (bumps.length > 0 && eligible.length === 0) {
    const result = summary({
      code: "persist_failed",
      bumps: 0,
      note: "Revision bump did not persist; owners were not notified.",
    });
    console.info("[gcfieldlog] notify skipped", { code: result.code });
    return result;
  }
  if (eligible.length === 0) {
    const result = summary({
      code: "no_bumps",
      bumps: 0,
      note: "No persisted revision bumps. Owners were not notified.",
    });
    return result;
  }

  const resendKey = readResendApiKey();
  const gmail = readGmailSmtpConfig();
  const provider: NotifyMikeProvider = resendKey ? "resend" : gmail ? "gmail" : null;

  if (!provider) {
    const result = summary({
      code: "notify_unconfigured",
      bumps: eligible.length,
      skippedUnset: eligible.length,
      note:
        "RESEND_API_KEY (or GMAIL_APP_PASSWORD) is required to send bump emails. Recipients come from procore_connections.notify_email. Refresh still saved. Never NEXT_PUBLIC_ these keys. SMS is not sent.",
    });
    console.info("[gcfieldlog] notify skipped", {
      code: result.code,
      bumps: result.bumps,
    });
    return result;
  }

  const ownerIds = [
    ...new Set(
      eligible
        .map((bump) => bump.owner_user_id)
        .filter((id): id is string => Boolean(id && id.trim())),
    ),
  ];
  const emailsByUserId = await lookupEmails(ownerIds, deps);
  const plan = resolveBumpNotifyRecipients(
    eligible,
    emailsByUserId,
    readNotifyMikeEmail(),
  );
  const skippedUnset = skippedUnsetCount(plan);
  const fallbackUsed = plan.deliveries.some((item) => item.source === "fallback");

  if (plan.deliveries.length === 0) {
    const result = summary({
      code: "notify_email_unset",
      bumps: eligible.length,
      skippedUnset,
      note:
        "Persisted bump(s) had no procore_connections.notify_email for the folder owner. Notify skipped. Refresh still saved.",
    });
    console.info("[gcfieldlog] notify skipped", {
      code: result.code,
      bumps: result.bumps,
      skipped_unset: skippedUnset,
    });
    return result;
  }

  const from = readNotifyFromEmail() || (provider === "gmail" && gmail ? gmail.user : DEFAULT_NOTIFY_FROM);
  const sent: NotifyRecipientDelivery[] = [];
  const failed: Array<NotifyRecipientDelivery & { error: string }> = [];

  for (const delivery of plan.deliveries) {
    const { subject, text } = formatNotifyMikeMessage(delivery.bumps);
    const message: NotifyMikeMessage = { to: delivery.to, from, subject, text };
    let send: NotifyMikeSendResult;
    try {
      if (provider === "resend" && resendKey) {
        const fetchImpl = deps.fetch ?? fetch;
        send = await sendResendEmail(message, resendKey, fetchImpl);
      } else if (gmail) {
        const smtp = deps.sendGmail ?? (await import("./gmailSmtp")).sendGmailSmtp;
        send = await smtp({
          user: gmail.user,
          password: gmail.password,
          to: delivery.to,
          from,
          subject,
          text,
        });
      } else {
        send = { ok: false, error: "notify_unconfigured" };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "notify_send_failed";
      send = { ok: false, error: detail.slice(0, 180) };
    }
    if (send.ok) sent.push(delivery);
    else failed.push({ ...delivery, error: send.error ?? "send_failed" });
  }

  if (sent.length > 0 && failed.length === 0) {
    const result = summary({
      code: "sent",
      bumps: sent.reduce((sum, item) => sum + item.bumps.length, 0),
      provider,
      toConfigured: true,
      recipients: sent.length,
      skippedUnset,
      fallbackUsed,
      note: `Emailed ${sent.length} owner${sent.length === 1 ? "" : "s"} for persisted sheet bump(s) (${provider}). SMS is not sent.`,
    });
    console.info("[gcfieldlog] notify sent", {
      code: result.code,
      bumps: result.bumps,
      provider,
      recipients: result.recipients,
      fallback_used: fallbackUsed,
      to: sent.map((item) => maskEmail(item.to)),
    });
    return result;
  }

  if (sent.length > 0) {
    const result = summary({
      code: "sent",
      bumps: sent.reduce((sum, item) => sum + item.bumps.length, 0),
      provider,
      toConfigured: true,
      recipients: sent.length,
      skippedUnset: skippedUnset + failed.reduce((sum, item) => sum + item.bumps.length, 0),
      fallbackUsed,
      note: `Emailed ${sent.length} owner(s); ${failed.length} send(s) failed. Refresh still saved.`,
    });
    console.error("[gcfieldlog] notify partial failure", {
      code: result.code,
      sent: sent.length,
      failed: failed.length,
      provider,
    });
    return result;
  }

  const result = summary({
    code: "send_failed",
    bumps: eligible.length,
    provider,
    toConfigured: true,
    recipients: 0,
    skippedUnset,
    fallbackUsed,
    note: `Refresh still saved. Email to owner(s) failed (${failed[0]?.error ?? "send_failed"}).`,
  });
  console.error("[gcfieldlog] notify failed", {
    code: result.code,
    bumps: result.bumps,
    provider,
    error: failed[0]?.error ?? "send_failed",
  });
  return result;
}
