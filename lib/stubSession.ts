/**
 * Leftover stub cookie from the abandoned stub-session path (PR #33).
 * Not a login. Primary session is Supabase Auth (lib/session.ts).
 * proxy / logout expire this cookie so it cannot remain the session.
 */

import { STUB_SESSION_COOKIE } from "./auth";

export { STUB_SESSION_COOKIE };

export function expireStubSessionCookie(secure: boolean): {
  name: string;
  value: string;
  httpOnly: boolean;
  path: string;
  sameSite: "lax";
  maxAge: number;
  secure: boolean;
} {
  return {
    name: STUB_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 0,
    secure,
  };
}
