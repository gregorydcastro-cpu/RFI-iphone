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
  [/signups not allowed/i, "Account creation is turned off on this host."],
  [/auth_unconfigured|not configured/i, authUnconfiguredMessage()],
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
