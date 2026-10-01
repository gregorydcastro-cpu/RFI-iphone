/**
 * Field-facing Auth copy. Maps callback reasons and Supabase errors.
 * No role picker. No stub / guest / demo login path.
 */

export type FieldAuthMode = "signin" | "signup" | "otp";

export function parseFieldAuthMode(value: unknown): FieldAuthMode {
  if (value === "signup" || value === "otp") return value;
  return "signin";
}

export function safeNextPath(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/jobs";
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
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  const pathname = (next.split("?")[0] ?? next).replace(/\/+$/, "") || "/";
  if (pathname === "/jobs") return "jobs";
  if (pathname.startsWith("/jobs/")) {
    const slug = pathname.slice("/jobs/".length).split("/")[0] ?? "";
    return JOB_PLACE_LABELS[slug] ?? "that job";
  }
  if (pathname === "/time" || pathname.startsWith("/time/")) return "time";
  if (pathname === "/share" || pathname.startsWith("/share/")) return "share";
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
  const next =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/jobs";
  const params = new URLSearchParams();
  params.set("next", next);
  if (sessionEnded) params.set("reason", "session_ended");
  return `/?${params.toString()}`;
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
