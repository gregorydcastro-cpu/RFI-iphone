/**
 * Browser paths that sign out through the existing session logout route.
 * These are route handlers, not next.config redirects: a redirect to /
 * would leave the Supabase session cookie in place.
 */
export const SIGN_OUT_ALIAS_PATHS = [
  "/logout",
  "/log-out",
  "/sign-out",
  "/signout",
] as const;

export const SESSION_LOGOUT_ROUTE = "app/api/session/logout/route.ts";
