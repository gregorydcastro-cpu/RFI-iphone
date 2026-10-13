/**
 * Signed-out account. Copy and links only — no Procore, share, or billing.
 */

import { signInContinuePath } from "./authMessages.ts";

export const ACCOUNT_SIGN_IN_COPY = "Sign in to open your account.";

export const ACCOUNT_PAGE_TITLE = "Account — GC Field Log";

function barePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Public account URL. The dashboard lives at /account/board and is not this path. */
export function isAccountPath(pathname: string): boolean {
  return barePath(pathname) === "/account";
}

/** Internal dashboard URL. Signed-out requests are sent back to /account. */
export function isAccountBoardPath(pathname: string): boolean {
  return barePath(pathname) === "/account/board";
}

export function accountSignInGate(sessionEnded: boolean): {
  text: string;
  signInHref: string;
  homeHref: "/";
  signInLabel: "Sign in";
  homeLabel: "Home";
} {
  const ended = Boolean(sessionEnded);
  const text = ended
    ? `Your sign-in ended. ${ACCOUNT_SIGN_IN_COPY}`
    : ACCOUNT_SIGN_IN_COPY;
  return {
    text,
    signInHref: signInContinuePath("/account", ended),
    homeHref: "/",
    signInLabel: "Sign in",
    homeLabel: "Home",
  };
}
