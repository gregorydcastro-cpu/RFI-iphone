/**
 * One plain email through the existing Resend sender.
 * Missing RESEND_API_KEY is email_failed. A non-2xx is email_failed.
 * The provider body stays off the response. No new env names.
 */

import {
  DEFAULT_NOTIFY_FROM,
  RESEND_API_URL,
  readNotifyFromEmail,
  readResendApiKey,
} from "./notifyMike.ts";

export const FIELD_EMAIL_TIMEOUT_MS = 8_000;

export type FieldEmailCode = "offline" | "timeout" | "email_failed";

export type FieldEmailResult = { ok: true } | { ok: false; code: FieldEmailCode };

export async function sendFieldEmail(input: {
  to: string;
  subject: string;
  text: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<FieldEmailResult> {
  const apiKey = readResendApiKey();
  if (!apiKey) return { ok: false, code: "email_failed" };

  const from = readNotifyFromEmail() || DEFAULT_NOTIFY_FROM;
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? FIELD_EMAIL_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
      signal: controller.signal,
    });
    if (response.ok) return { ok: true };
    return { ok: false, code: "email_failed" };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, code: aborted ? "timeout" : "offline" };
  } finally {
    clearTimeout(timer);
  }
}
