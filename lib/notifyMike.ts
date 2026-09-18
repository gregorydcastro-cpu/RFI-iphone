/**
 * Notify Mike when a pinned sheet revision actually bumps.
 *
 * Server-only. Destination is NOTIFY_MIKE_EMAIL (demo/config), never a
 * hardcoded personal address and never NEXT_PUBLIC_. There is no in-repo
 * Gmail/SMS path yet — this helper sends email via Resend (RESEND_API_KEY)
 * or Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD). SMS is reserved
 * (NOTIFY_MIKE_SMS) and not sent.
 *
 * Missing mail env logs + returns a structured skip (code
 * notify_unconfigured, status 503). Refresh callers must not fail the
 * persist when notify is skipped or send fails.
 */

import type { ShareRefreshBump, ShareRefreshError } from "./shareRefresh";
import type { GmailSmtpInput, GmailSmtpResult } from "./gmailSmtp";

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isNotifyEmail(value: string | undefined): value is string {
  return Boolean(value && EMAIL_RE.test(value));
}

export function readNotifyMikeEmail(): string | undefined {
  const configured = readSecretEnv(NOTIFY_MIKE_EMAIL_KEY);
  if (isNotifyEmail(configured)) return configured.toLowerCase();
  const gmail = readSecretEnv(GMAIL_USER_KEY);
  if (isNotifyEmail(gmail)) return gmail.toLowerCase();
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

export function notifyMikeConfigured(): boolean {
  return Boolean(readNotifyMikeEmail() && notifyMailerConfigured());
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
  note: string;
}): NotifyMikeSummary {
  const sent = input.code === "sent";
  const skipped = input.code === "no_bumps" || input.code === "persist_failed" || input.code === "notify_unconfigured";
  const attempted = input.code === "sent" || input.code === "send_failed";
  return {
    attempted,
    sent,
    skipped,
    code: input.code,
    status: sent || input.code === "no_bumps" || input.code === "persist_failed" ? 200 : 503,
    bumps: input.bumps,
    provider: input.provider ?? null,
    to_configured: Boolean(input.toConfigured),
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

/**
 * After a refresh persist, email Mike only when there are real persisted bumps.
 * Never throws — callers attach the structured result and keep refresh ok.
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
      note: "Revision bump did not persist; Mike was not notified.",
    });
    console.info("[gcfieldlog] notify Mike skipped", { code: result.code });
    return result;
  }
  if (eligible.length === 0) {
    const result = summary({
      code: "no_bumps",
      bumps: 0,
      toConfigured: Boolean(readNotifyMikeEmail()),
      note: "No persisted revision bumps. Mike was not notified.",
    });
    return result;
  }

  const to = readNotifyMikeEmail();
  const resendKey = readResendApiKey();
  const gmail = readGmailSmtpConfig();
  const provider: NotifyMikeProvider = resendKey ? "resend" : gmail ? "gmail" : null;

  if (!to || !provider) {
    const result = summary({
      code: "notify_unconfigured",
      bumps: eligible.length,
      toConfigured: Boolean(to),
      note:
        "NOTIFY_MIKE_EMAIL (or GMAIL_USER) plus RESEND_API_KEY or GMAIL_APP_PASSWORD are required to email Mike. Refresh still saved. Never NEXT_PUBLIC_ these keys. SMS is not sent.",
    });
    console.info("[gcfieldlog] notify Mike skipped", {
      code: result.code,
      bumps: result.bumps,
      to_configured: result.to_configured,
    });
    return result;
  }

  const from = readNotifyFromEmail() || (provider === "gmail" && gmail ? gmail.user : DEFAULT_NOTIFY_FROM);
  const { subject, text } = formatNotifyMikeMessage(eligible);
  const message: NotifyMikeMessage = { to, from, subject, text };

  let send: NotifyMikeSendResult;
  try {
    if (provider === "resend" && resendKey) {
      const fetchImpl = deps.fetch ?? fetch;
      send = await sendResendEmail(message, resendKey, fetchImpl);
    } else if (gmail) {
      const smtp =
        deps.sendGmail ??
        (await import("./gmailSmtp")).sendGmailSmtp;
      send = await smtp({
        user: gmail.user,
        password: gmail.password,
        to,
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

  if (send.ok) {
    const result = summary({
      code: "sent",
      bumps: eligible.length,
      provider,
      toConfigured: true,
      note: `Emailed Mike ${eligible.length} pinned sheet bump${eligible.length === 1 ? "" : "s"} (${provider}). SMS is not sent.`,
    });
    console.info("[gcfieldlog] notify Mike sent", {
      code: result.code,
      bumps: result.bumps,
      provider,
      to: maskEmail(to),
    });
    return result;
  }

  const result = summary({
    code: "send_failed",
    bumps: eligible.length,
    provider,
    toConfigured: true,
    note: `Refresh still saved. Email to Mike failed (${send.error ?? "send_failed"}).`,
  });
  console.error("[gcfieldlog] notify Mike failed", {
    code: result.code,
    bumps: result.bumps,
    provider,
    error: send.error ?? "send_failed",
  });
  return result;
}
