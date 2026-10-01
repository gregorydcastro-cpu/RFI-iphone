/**
 * Field-facing Auth copy. Maps callback reasons and Supabase errors.
 * No role picker. No stub / guest / demo login path.
 */

export type FieldAuthMode = "signin" | "signup" | "otp";

export function parseFieldAuthMode(value: unknown): FieldAuthMode {
  if (value === "signup" || value === "otp") return value;
  return "signin";
}

const RETURN_PATH_ORIGIN = "https://www.gcfieldlog.com";

const AUTH_CALLBACK_REASONS = new Set([
  "missing_code",
  "exchange_failed",
  "auth_unconfigured",
]);

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function isAllowedAppPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  if (pathname.includes("//") || pathname.includes("\\")) return false;
  if (pathname === "/jobs" || pathname.startsWith("/jobs/")) return true;
  if (pathname === "/time" || pathname.startsWith("/time/")) return true;
  if (pathname === "/share" || pathname.startsWith("/share/")) return true;
  if (pathname === "/account" || pathname.startsWith("/account/")) return true;
  if (pathname === "/pricing" || pathname.startsWith("/pricing/")) return true;
  if (pathname.startsWith("/pack/") && pathname.length > "/pack/".length) return true;
  if (pathname.startsWith("/invite/") && pathname.length > "/invite/".length) return true;
  return false;
}

/**
 * Same-site return path after sign-in, invite accept, or share handoff.
 * Rejects protocol-relative, backslash, and login/callback targets so a
 * crafted `next` cannot leave the app or loop on `/`.
 */
export function safeNextPath(value: string | null | undefined): string {
  const fallback = "/jobs";
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("\\") || hasControlChars(trimmed)) return fallback;
  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return fallback;
  }
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.includes("\\") ||
    hasControlChars(decoded)
  ) {
    return fallback;
  }
  let url: URL;
  try {
    url = new URL(decoded, RETURN_PATH_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== RETURN_PATH_ORIGIN) return fallback;
  if (!isAllowedAppPath(url.pathname)) return fallback;
  if (url.search.includes("\\") || hasControlChars(url.search)) return fallback;
  return `${url.pathname}${url.search}`;
}

/** Invite landing path. Unsafe tokens fall back to jobs. */
export function inviteAcceptPath(token: string): string {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 256) return "/jobs";
  if (/[\\/?#%\s]/.test(trimmed) || trimmed.includes("..")) return "/jobs";
  return safeNextPath(`/invite/${encodeURIComponent(trimmed)}`);
}

export function isAuthCallbackReason(reason: string | null | undefined): boolean {
  return typeof reason === "string" && AUTH_CALLBACK_REASONS.has(reason);
}

/**
 * Where `/auth/callback` sends the crew.
 * Failures always land on login with `next` preserved — never on the
 * destination page, where the error would be dropped.
 */
export function authCallbackLocation(
  origin: string,
  next: string | null | undefined,
  outcome: "session" | "missing_code" | "exchange_failed" | "auth_unconfigured",
): string {
  const base = origin.replace(/\/$/, "") || RETURN_PATH_ORIGIN;
  const safe = safeNextPath(next);
  if (outcome === "session") return new URL(safe, base).toString();
  const login = new URL("/", base);
  login.searchParams.set("auth", "error");
  login.searchParams.set("reason", outcome);
  login.searchParams.set("next", safe);
  return login.toString();
}

/**
 * After sign-out or a dead auth cookie is cleared.
 * `cleared=1` stops login from sending the crew through logout again.
 */
export function sessionExitLocation(input: {
  origin: string;
  next?: string | null;
  reason?: string | null;
  auth?: string | null;
}): string {
  const base = input.origin.replace(/\/$/, "") || RETURN_PATH_ORIGIN;
  const login = new URL("/", base);
  const callbackReason =
    input.auth === "error" && isAuthCallbackReason(input.reason) ? input.reason : null;
  if (callbackReason) {
    login.searchParams.set("auth", "error");
    login.searchParams.set("reason", callbackReason);
    login.searchParams.set("cleared", "1");
    login.searchParams.set("next", safeNextPath(input.next));
    return login.toString();
  }
  if (input.reason === "session_ended") {
    login.searchParams.set("reason", "session_ended");
    login.searchParams.set("cleared", "1");
    login.searchParams.set("next", safeNextPath(input.next));
    return login.toString();
  }
  login.searchParams.set("signedOut", "1");
  if (typeof input.next === "string" && input.next.trim()) {
    login.searchParams.set("next", safeNextPath(input.next));
  }
  return login.toString();
}

/** Login → logout hop that drops a leftover auth cookie, then returns here. */
export function staleSessionClearPath(input: {
  next?: string | null;
  auth?: string | null;
  reason?: string | null;
}): string {
  const params = new URLSearchParams();
  if (input.auth === "error" && isAuthCallbackReason(input.reason)) {
    params.set("auth", "error");
    params.set("reason", input.reason ?? "");
  } else {
    params.set("reason", "session_ended");
  }
  params.set("next", safeNextPath(input.next));
  return `/api/session/logout?${params.toString()}`;
}

export function inviteSwitchAccountHref(token: string): string {
  const params = new URLSearchParams();
  params.set("next", inviteAcceptPath(token));
  return `/api/session/logout?${params.toString()}`;
}

export function authUnconfiguredMessage(): string {
  return "Supabase Auth is not configured on this host. Sign-in cannot start until the site has Auth keys.";
}

export function loginCallbackMessage(
  auth: string | null | undefined,
  reason: string | null | undefined,
): string | null {
  if (auth !== "error") return null;
  switch (reason) {
    case "auth_unconfigured":
      return authUnconfiguredMessage();
    case "missing_code":
      return "That sign-in link is missing its code. Request a new magic link.";
    case "exchange_failed":
      return "Sign-in link expired or already used. Request a new magic link.";
    default:
      return "Sign-in link expired or failed. Try again.";
  }
}

const JOB_PLACE_LABELS: Record<string, string> = {
  "maple-point": "Maple Point",
  "cedar-ridge": "Cedar Ridge",
  "harbor-view": "Harbor View",
  "pine-hollow": "Pine Hollow",
};

/** Short spoken name for a same-site return path. Null when there is no next. */
export function continuePlaceLabel(next: string | null | undefined): string | null {
  if (!next || safeNextPath(next) !== next.trim()) return null;
  const pathname = (next.split("?")[0] ?? next).replace(/\/+$/, "") || "/";
  if (pathname === "/jobs") return "jobs";
  if (pathname.startsWith("/jobs/")) {
    const slug = pathname.slice("/jobs/".length).split("/")[0] ?? "";
    return JOB_PLACE_LABELS[slug] ?? "that job";
  }
  if (pathname === "/time" || pathname.startsWith("/time/")) return "time";
  if (pathname === "/share" || pathname.startsWith("/share/")) return "share";
  if (pathname.startsWith("/invite/")) return "the invite";
  if (pathname === "/account" || pathname.startsWith("/account/")) return "account";
  if (pathname.includes("/rfi/new")) return "the RFI draft";
  if (pathname.includes("/materials")) return "materials";
  if (pathname.startsWith("/pack/")) return "the pack";
  if (pathname === "/pricing" || pathname.startsWith("/pricing/")) return "pricing";
  return "that page";
}

/**
 * One short line for the login card when a gated page, logout, or a dead
 * session sent the crew here. Callback errors stay on loginCallbackMessage.
 */
export function loginArrivalMessage(query: {
  auth?: string | null;
  reason?: string | null;
  signedOut?: string | null;
  next?: string | null;
}): string | null {
  if (query.auth === "error") return null;
  const place = continuePlaceLabel(query.next);
  const ended = query.reason === "session_ended";
  const signedOut = query.signedOut === "1" || query.signedOut === "true";
  if (ended && place) {
    return `Your sign-in ended. Sign in to go back to ${place}.`;
  }
  if (ended) return "Your sign-in ended. Sign in to continue.";
  if (signedOut && place) {
    return `You are signed out. Sign in to go back to ${place}.`;
  }
  if (signedOut) return "You are signed out.";
  if (place) return `Sign in to go back to ${place}.`;
  return null;
}

/** Login URL that returns the crew to a same-site page after sign-in. */
export function signInContinuePath(nextPath: string, sessionEnded = false): string {
  const params = new URLSearchParams();
  params.set("next", safeNextPath(nextPath));
  if (sessionEnded) params.set("reason", "session_ended");
  return `/?${params.toString()}`;
}

export function sessionGateLead(sessionEnded: boolean): string {
  return sessionEnded ? "Your sign-in ended." : "You are signed out.";
}

/** Signed-out / dead-session banner for share, time, and account. */
export function signedOutGate(input: {
  next: string;
  sessionEnded?: boolean;
  detail: string;
}): { lead: string; href: string; text: string } {
  const ended = Boolean(input.sessionEnded);
  const lead = sessionGateLead(ended);
  const href = signInContinuePath(input.next, ended);
  return { lead, href, text: `${lead} Sign in ${input.detail}` };
}

export type InviteLanding =
  | { kind: "form" }
  | {
      kind: "blocked";
      title: string;
      body: string;
      action: "signin" | "jobs" | "switch";
    };

export function inviteEmailsConflict(
  inviteeEmail: string | null | undefined,
  sessionEmail: string | null | undefined,
): boolean {
  if (!inviteeEmail || !sessionEmail) return false;
  return inviteeEmail.trim().toLowerCase() !== sessionEmail.trim().toLowerCase();
}

/** What the invite page shows before the accept form. Success after redeem is separate. */
export function inviteLanding(input: {
  status: "valid" | "expired" | "used" | "not_found";
  signedIn: boolean;
  inviteeEmail?: string | null;
  sessionEmail?: string | null;
}): InviteLanding {
  if (input.status === "not_found") {
    return {
      kind: "blocked",
      title: "Invite not found",
      body: "This link is not a valid crew invite.",
      action: "signin",
    };
  }
  if (input.status === "expired") {
    return {
      kind: "blocked",
      title: "Invite expired",
      body: "Ask the GC or foreman for a new link.",
      action: "signin",
    };
  }
  if (input.status === "used") {
    return input.signedIn
      ? {
          kind: "blocked",
          title: "Invite already used",
          body: "This link is single-use and already on an account. Open jobs to continue. The invited role stays on the account that accepted it.",
          action: "jobs",
        }
      : {
          kind: "blocked",
          title: "Invite already used",
          body: "This link is single-use. Sign in with the email that accepted it. The invited role stays on that account.",
          action: "signin",
        };
  }
  if (
    input.signedIn &&
    inviteEmailsConflict(input.inviteeEmail, input.sessionEmail)
  ) {
    return {
      kind: "blocked",
      title: "Different email",
      body: "This invite is for a different email. Sign out, then accept it with the invited address.",
      action: "switch",
    };
  }
  return { kind: "form" };
}

export function inviteFormHelper(input: {
  signedIn: boolean;
  role: "viewer" | "full" | null;
  sessionEmail?: string | null;
}): string {
  const next =
    input.role === "full"
      ? "Then connect your own Procore."
      : "Then open packs read-only.";
  if (input.signedIn) {
    const who = input.sessionEmail ? ` as ${input.sessionEmail}` : "";
    return `Signed in${who}. Tap accept to store this invite on your account. ${next} Role is baked into this link.`;
  }
  return `Sign in or create an account with this email. The invite role is stored on that account. ${next} Role is baked into this link.`;
}

export function inviteConfirmMessage(mode: "otp" | "signup"): string {
  if (mode === "otp") {
    return "Check your email for a sign-in link. It brings you back to this invite. Then tap Accept.";
  }
  return "Check your email to confirm this account. The link brings you back to this invite. Then tap Accept.";
}

export function inviteAcceptedMessage(role: "viewer" | "full"): {
  title: string;
  body: string;
} {
  if (role === "full") {
    return {
      title: "You are in as full crew",
      body: "Connect your own Procore next. Access stays full crew. Connecting does not change the invite role.",
    };
  }
  return {
    title: "You are in as view only",
    body: "View-only session. Sheets and red boxes only. Connecting Procore will not upgrade this account.",
  };
}

const AUTH_ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "Email or password is incorrect."],
  [/email not confirmed/i, "Check your email to confirm this account, then sign in."],
  [/user already registered/i, "That email already has an account. Sign in or use a magic link."],
  [/already been registered/i, "That email already has an account. Sign in or use a magic link."],
  [/password should be at least/i, "Password must be at least 6 characters."],
  [/password is required/i, "Enter a password, or switch to Magic link."],
  [/email is required/i, "Enter a crew email address."],
  [/unable to validate email/i, "Enter a valid email address."],
  [/email rate limit/i, "Too many emails sent. Wait a minute and try again."],
  [
    /for security purposes, you can only request this after/i,
    "Wait a moment, then request another magic link.",
  ],
  [/user_already_exists/i, "That email already has an account. Sign in or use a magic link."],
  [/signups not allowed/i, "Account creation is turned off on this host."],
  [/auth_unconfigured|not configured/i, authUnconfiguredMessage()],
  [
    /jwt|refresh token|refresh_token|auth session missing|token has expired|invalid claim/i,
    "Your sign-in ended. Sign in again.",
  ],
  [/invalid json|unexpected token/i, "Sign-in could not read that request. Try again."],
  [
    /failed to fetch|fetch failed|network request|econn|enotfound/i,
    "Could not reach sign-in. Check the connection and try again.",
  ],
  [
    /database error|duplicate key|pgrst/i,
    "Could not finish sign-in. Try again in a moment.",
  ],
];

export function friendlyAuthError(
  message: string | null | undefined,
  fallback = "Could not sign in.",
): string {
  const raw = (message ?? "").trim();
  if (!raw) return fallback;
  for (const [pattern, text] of AUTH_ERROR_MAP) {
    if (pattern.test(raw)) return text;
  }
  if (/supabase|authapierror|bearer |stack trace|sqlstate/i.test(raw)) return fallback;
  return raw;
}

export function loginModeCopy(mode: FieldAuthMode): {
  title: string;
  helper: string;
  submit: string;
  pending: string;
} {
  switch (mode) {
    case "signup":
      return {
        title: "Create account",
        helper:
          "New crew account for Maple Point and other fictional jobs. Confirm email if asked, then you land on jobs.",
        submit: "Create account",
        pending: "Creating…",
      };
    case "otp":
      return {
        title: "Email a sign-in link",
        helper:
          "No password on this screen. We email a one-tap link to your crew address.",
        submit: "Email me a link",
        pending: "Sending…",
      };
    default:
      return {
        title: "Sign in",
        helper:
          "Open Maple Point packs, time, and share with your crew email and password.",
        submit: "Sign in",
        pending: "Signing in…",
      };
  }
}
