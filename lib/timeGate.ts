/**
 * Signed-out time clock. Copy and links only — no roster, PINs, or punches.
 */

import { signInContinuePath } from "./authMessages.ts";

export const TIME_CLOCK_SIGN_IN_COPY = "Sign in to use the time clock.";

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
