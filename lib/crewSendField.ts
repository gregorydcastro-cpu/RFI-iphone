/**
 * Field copy for an invite email and a share-portal link.
 * Short title, short line. A blank share send is a status.
 * A dropped send is an alert with Retry. One automatic retry for a fast
 * network drop or an email-service miss, then the card.
 * A timeout does not start another long wait.
 * View-only and a bad email do not offer Retry.
 * No provider names, no raw fetch text.
 */

export const CREW_SEND_CLIENT_MS = 12_000;
export const CREW_SEND_ATTEMPTS = 2;
export const CREW_SEND_BACKOFF_MS = 400;

export const SHARE_LINK_PATH = "/api/share/link";

export const CREW_SEND_CODES = [
  "offline",
  "timeout",
  "email_failed",
  "forbidden",
  "invalid",
  "unavailable",
] as const;

export type CrewSendCode = (typeof CREW_SEND_CODES)[number];
export type CrewSendKind = "invite" | "share";
export type CrewSendRole = "viewer" | "full";

export type CrewSendJob = {
  slug: string;
  name: string;
};

/** Picker and send allow-list. Fictional demo jobs only. */
export const CREW_SEND_JOBS: readonly CrewSendJob[] = [
  { slug: "maple-point", name: "Maple Point Medical Office" },
  { slug: "cedar-ridge", name: "Cedar Ridge Outpatient" },
];

export const INVITE_FAIL_TITLE = "Invite didn't send";
export const SHARE_FAIL_TITLE = "Share link didn't go through";

export const CREW_OFFLINE_MESSAGE = "No connection. Tap Retry.";
export const INVITE_TIMEOUT_MESSAGE = "The send stopped early. Tap Retry.";
export const SHARE_TIMEOUT_MESSAGE = "The link stopped early. Tap Retry.";
export const CREW_EMAIL_MESSAGE = "The email service did not take it. Tap Retry.";
export const INVITE_UNAVAILABLE_MESSAGE = "Could not make this invite. Tap Retry.";
export const SHARE_UNAVAILABLE_MESSAGE = "Could not make this link. Tap Retry.";
export const CREW_FORBIDDEN_MESSAGE = "This login is view-only.";
export const CREW_SIGNED_OUT_MESSAGE = "Sign in first.";
export const CREW_EMAIL_INVALID_MESSAGE = "Check the email address.";
export const CREW_ROLE_INVALID_MESSAGE = "Pick full or view only.";
export const CREW_JOB_INVALID_MESSAGE = "Pick a job.";

export const INVITE_EMPTY_TITLE = "Nothing to send";
export const INVITE_EMPTY_MESSAGE = "No invite email yet.";
export const SHARE_EMPTY_TITLE = "Nothing to send";
export const SHARE_EMPTY_MESSAGE = "No share link to send yet.";

export const INVITE_SENT_MESSAGE = "Invite sent.";
export const SHARE_SENT_MESSAGE = "Share link sent.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_SET = new Set<string>(CREW_SEND_CODES);

export type CrewSendDetail = "signed_out" | "role" | "job";

export type CrewSendBanner = {
  title: string;
  message: string;
  speak: string;
  retry: boolean;
  code: CrewSendCode;
  detail?: CrewSendDetail;
};

export type CrewSendEmpty = {
  title: string;
  message: string;
  speak: string;
};

export type CrewSendDraft =
  | {
      ok: true;
      kind: CrewSendKind;
      recipient: string | null;
      role: CrewSendRole;
      job: CrewSendJob | null;
    }
  | { ok: false; empty: CrewSendEmpty }
  | { ok: false; banner: CrewSendBanner };

export type CrewSendSuccess = {
  ok: true;
  url: string | null;
  sent: boolean;
};

export type CrewSendFailure = {
  ok: false;
  code: CrewSendCode;
  banner: CrewSendBanner;
};

export type CrewSendOutcome = CrewSendSuccess | CrewSendFailure;

function speak(title: string, message: string): string {
  return `${title}. ${message}`;
}

export function crewSendTitle(kind: CrewSendKind): string {
  return kind === "invite" ? INVITE_FAIL_TITLE : SHARE_FAIL_TITLE;
}

export function crewSendJob(value: unknown): CrewSendJob | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return CREW_SEND_JOBS.find((job) => job.slug === slug) ?? null;
}

export function parseCrewRole(value: unknown): CrewSendRole | null {
  return value === "viewer" || value === "full" ? value : null;
}

/** Blank is empty. A typed address that is not an email is invalid. */
export function parseCrewRecipient(value: unknown): "empty" | "invalid" | string {
  if (typeof value !== "string") return "invalid";
  const email = value.trim().toLowerCase();
  if (!email) return "empty";
  if (!EMAIL_RE.test(email)) return "invalid";
  return email;
}

export function crewSendHttpStatus(code: CrewSendCode): number {
  if (code === "invalid") return 400;
  if (code === "forbidden") return 403;
  if (code === "timeout") return 504;
  if (code === "offline" || code === "unavailable") return 503;
  return 502;
}

export function isCrewSendCode(value: unknown): value is CrewSendCode {
  return typeof value === "string" && CODE_SET.has(value);
}

function banner(
  kind: CrewSendKind,
  code: CrewSendCode,
  message: string,
  retry: boolean,
  detail?: CrewSendDetail,
): CrewSendBanner {
  const title = crewSendTitle(kind);
  return {
    title,
    message,
    speak: speak(title, message),
    retry,
    code,
    ...(detail ? { detail } : {}),
  };
}

/**
 * Phone-sized failure copy. Retry only when another tap can send again.
 * View-only, signed-out, and a bad email do not offer Retry.
 */
export function crewSendBanner(
  kind: CrewSendKind,
  code: CrewSendCode,
  detail?: CrewSendDetail,
): CrewSendBanner {
  if (code === "forbidden") {
    return banner(
      kind,
      code,
      detail === "signed_out" ? CREW_SIGNED_OUT_MESSAGE : CREW_FORBIDDEN_MESSAGE,
      false,
      detail === "signed_out" ? "signed_out" : undefined,
    );
  }
  if (code === "invalid") {
    const message =
      detail === "role"
        ? CREW_ROLE_INVALID_MESSAGE
        : detail === "job"
          ? CREW_JOB_INVALID_MESSAGE
          : CREW_EMAIL_INVALID_MESSAGE;
    const invalidDetail = detail === "role" || detail === "job" ? detail : undefined;
    return banner(kind, code, message, false, invalidDetail);
  }
  if (code === "offline") return banner(kind, code, CREW_OFFLINE_MESSAGE, true);
  if (code === "timeout") {
    return banner(
      kind,
      code,
      kind === "invite" ? INVITE_TIMEOUT_MESSAGE : SHARE_TIMEOUT_MESSAGE,
      true,
    );
  }
  if (code === "unavailable") {
    return banner(
      kind,
      code,
      kind === "invite" ? INVITE_UNAVAILABLE_MESSAGE : SHARE_UNAVAILABLE_MESSAGE,
      true,
    );
  }
  return banner(kind, code, CREW_EMAIL_MESSAGE, true);
}

export function crewSendEmpty(kind: CrewSendKind): CrewSendEmpty {
  const title = kind === "invite" ? INVITE_EMPTY_TITLE : SHARE_EMPTY_TITLE;
  const message = kind === "invite" ? INVITE_EMPTY_MESSAGE : SHARE_EMPTY_MESSAGE;
  return { title, message, speak: speak(title, message) };
}

export function crewSendSentMessage(kind: CrewSendKind): string {
  return kind === "invite" ? INVITE_SENT_MESSAGE : SHARE_SENT_MESSAGE;
}

/**
 * Blank share recipient is a status. Blank invite email can still mint a link.
 * A bad email, role, or job is plain copy with no Retry.
 */
export function classifyCrewSendDraft(input: {
  kind: CrewSendKind;
  recipient: unknown;
  role: unknown;
  job: unknown;
  emailOptional?: boolean;
}): CrewSendDraft {
  const role = parseCrewRole(input.role);
  if (!role) {
    return { ok: false, banner: crewSendBanner(input.kind, "invalid", "role") };
  }
  const recipient = parseCrewRecipient(input.recipient);
  if (recipient === "invalid") {
    return { ok: false, banner: crewSendBanner(input.kind, "invalid") };
  }
  if (recipient === "empty") {
    if (input.kind === "share" || !input.emailOptional) {
      return { ok: false, empty: crewSendEmpty(input.kind) };
    }
  }
  const jobRaw = typeof input.job === "string" ? input.job.trim() : input.job;
  const jobMissing = jobRaw == null || jobRaw === "";
  const job = jobMissing ? null : crewSendJob(jobRaw);
  if (input.kind === "share" && !job) {
    return { ok: false, banner: crewSendBanner(input.kind, "invalid", "job") };
  }
  if (!jobMissing && !job) {
    return { ok: false, banner: crewSendBanner(input.kind, "invalid", "job") };
  }
  return {
    ok: true,
    kind: input.kind,
    recipient: recipient === "empty" ? null : recipient,
    role,
    job,
  };
}

export function sharePortalUrl(origin: string, jobSlug: string): string | null {
  const job = crewSendJob(jobSlug);
  const base = origin.trim().replace(/\/$/, "");
  if (!job || !/^https?:\/\//i.test(base)) return null;
  return `${base}/share?job=${encodeURIComponent(job.slug)}`;
}

export function inviteMail(input: {
  url: string;
  role: CrewSendRole;
  jobName: string | null;
}): { subject: string; text: string } {
  const roleLine = input.role === "viewer" ? "view only" : "full crew";
  const jobLine = input.jobName ? `Job: ${input.jobName}\n` : "";
  return {
    subject: input.jobName
      ? `GC Field Log invite — ${input.jobName}`
      : "GC Field Log invite",
    text: `You are invited to GC Field Log as ${roleLine}.\n${jobLine}Open: ${input.url}\n`,
  };
}

export function shareLinkMail(input: {
  url: string;
  role: CrewSendRole;
  jobName: string;
}): { subject: string; text: string } {
  const roleLine = input.role === "viewer" ? "view only" : "full crew";
  return {
    subject: `GC Field Log share link — ${input.jobName}`,
    text: `A share link for ${input.jobName} is ready.\nRole: ${roleLine}\nOpen: ${input.url}\n`,
  };
}

export function shouldAutoRetryCrewSend(input: {
  attempt: number;
  attempts?: number;
  code: CrewSendCode;
}): boolean {
  const attempts = input.attempts ?? CREW_SEND_ATTEMPTS;
  if (input.attempt >= attempts - 1) return false;
  return input.code === "offline" || input.code === "email_failed" || input.code === "unavailable";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

/** A 200 body is success only when the API confirmed the send or the link. */
export function crewSendConfirmed(input: {
  emailRequested: boolean;
  body: unknown;
}): { url: string | null; sent: boolean } | null {
  const data = asRecord(input.body);
  if (!data || data.ok !== true) return null;
  const url = typeof data.url === "string" && data.url.trim() ? data.url.trim() : null;
  const sent = data.sent === true;
  if (input.emailRequested) {
    if (!sent) return null;
    return { url, sent: true };
  }
  if (!url) return null;
  return { url, sent: false };
}

export function classifyCrewSendResponse(input: {
  kind: CrewSendKind;
  thrown?: boolean;
  timedOut?: boolean;
  httpStatus?: number;
  body?: unknown;
}): CrewSendBanner {
  const status = input.httpStatus ?? 0;
  if (input.timedOut || status === 408 || status === 504) {
    return crewSendBanner(input.kind, "timeout");
  }
  if (input.thrown || status === 0) {
    return crewSendBanner(input.kind, "offline");
  }
  const data = asRecord(input.body);
  const named = isCrewSendCode(data?.code) ? data.code : null;
  const detail =
    data?.detail === "signed_out" || data?.detail === "role" || data?.detail === "job"
      ? data.detail
      : undefined;
  if (status === 401) return crewSendBanner(input.kind, "forbidden", "signed_out");
  if (named === "invalid") return crewSendBanner(input.kind, "invalid", detail);
  if (named === "forbidden") {
    return crewSendBanner(input.kind, "forbidden", detail === "signed_out" ? "signed_out" : undefined);
  }
  if (named) return crewSendBanner(input.kind, named);
  if (status === 400) return crewSendBanner(input.kind, "invalid");
  if (status === 403) return crewSendBanner(input.kind, "forbidden");
  if (status === 503) return crewSendBanner(input.kind, "unavailable");
  return crewSendBanner(input.kind, "email_failed");
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(input: {
  kind: CrewSendKind;
  path: string;
  body: Record<string, unknown>;
  emailRequested: boolean;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<CrewSendOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs);
  try {
    const response = await input.fetchImpl(input.path, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const confirmed = crewSendConfirmed({
      emailRequested: input.emailRequested,
      body,
    });
    if (response.ok && confirmed) {
      return { ok: true, url: confirmed.url, sent: confirmed.sent };
    }
    const failure = classifyCrewSendResponse({
      kind: input.kind,
      httpStatus: response.ok ? 502 : response.status,
      body: response.ok ? { code: "email_failed" } : body,
    });
    return { ok: false, code: failure.code, banner: failure };
  } catch (error) {
    const aborted = timedOut || (error instanceof Error && error.name === "AbortError");
    const failure = classifyCrewSendResponse({
      kind: input.kind,
      thrown: !aborted,
      timedOut: aborted,
      httpStatus: 0,
    });
    return { ok: false, code: failure.code, banner: failure };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send or generate with the same body the crew already typed.
 * Retries a fast drop or an email-service miss once. A timeout, a bad
 * email, and view-only do not loop.
 */
export async function postCrewSend(input: {
  kind: CrewSendKind;
  path: string;
  body: Record<string, unknown>;
  emailRequested: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  attempts?: number;
  backoffMs?: number;
  offline?: boolean;
}): Promise<CrewSendOutcome> {
  const offline =
    input.offline ??
    (typeof navigator !== "undefined" && navigator.onLine === false);
  if (offline) {
    const failure = crewSendBanner(input.kind, "offline");
    return { ok: false, code: failure.code, banner: failure };
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const attempts = input.attempts ?? CREW_SEND_ATTEMPTS;
  const backoffMs = input.backoffMs ?? CREW_SEND_BACKOFF_MS;
  const timeoutMs = input.timeoutMs ?? CREW_SEND_CLIENT_MS;
  let last: CrewSendFailure = {
    ok: false,
    code: "offline",
    banner: crewSendBanner(input.kind, "offline"),
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await postOnce({
      kind: input.kind,
      path: input.path,
      body: input.body,
      emailRequested: input.emailRequested,
      fetchImpl,
      timeoutMs,
    });
    if (outcome.ok) return outcome;
    last = outcome;
    if (
      !shouldAutoRetryCrewSend({
        attempt,
        attempts,
        code: outcome.code,
      })
    ) {
      return outcome;
    }
    await wait(backoffMs);
  }
  return last;
}
