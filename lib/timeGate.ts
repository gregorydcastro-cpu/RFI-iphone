/**
 * Signed-out time clock. Copy and links only — no roster, PINs, or punches.
 */

import { signInContinuePath } from "./authMessages.ts";

export const TIME_CLOCK_SIGN_IN_COPY = "Sign in to use the time clock.";

function barePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/** Public time URL. The clock itself lives at /time/board and is not this path. */
export function isTimeClockPath(pathname: string): boolean {
  return barePath(pathname) === "/time";
}

/** Internal clock URL. Signed-out requests are sent back to /time. */
export function isTimeBoardPath(pathname: string): boolean {
  return barePath(pathname) === "/time/board";
}

export const TIME_SIGNED_OUT_TITLE = "Time — GC Field Log";

export function timeSignInGate(sessionEnded: boolean): {
  text: string;
  signInHref: string;
  homeHref: "/";
  signInLabel: "Sign in";
  homeLabel: "Home";
} {
  const ended = Boolean(sessionEnded);
  const text = ended
    ? `Your sign-in ended. ${TIME_CLOCK_SIGN_IN_COPY}`
    : TIME_CLOCK_SIGN_IN_COPY;
  return {
    text,
    signInHref: signInContinuePath("/time", ended),
    homeHref: "/",
    signInLabel: "Sign in",
    homeLabel: "Home",
  };
}
