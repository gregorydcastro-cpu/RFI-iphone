import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  authUnconfiguredMessage,
  continuePlaceLabel,
  friendlyAuthError,
  loginArrivalMessage,
  loginCallbackMessage,
  loginModeCopy,
  parseFieldAuthMode,
  safeNextPath,
  signInContinuePath,
} from "./authMessages.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const fakeAuth = /stub cookie|guest bypass login|demo password|skip auth|fake auth/i;

test("parseFieldAuthMode only accepts signin, signup, otp", () => {
  assert.equal(parseFieldAuthMode("signin"), "signin");
  assert.equal(parseFieldAuthMode("signup"), "signup");
  assert.equal(parseFieldAuthMode("otp"), "otp");
  assert.equal(parseFieldAuthMode("viewer"), "signin");
  assert.equal(parseFieldAuthMode("puller"), "signin");
  assert.equal(parseFieldAuthMode(undefined), "signin");
});

test("safeNextPath stays on-site", () => {
  assert.equal(safeNextPath("/jobs"), "/jobs");
  assert.equal(safeNextPath("/time"), "/time");
  assert.equal(safeNextPath("//evil.example"), "/jobs");
  assert.equal(safeNextPath("https://evil.example"), "/jobs");
  assert.equal(safeNextPath(null), "/jobs");
});

test("loginCallbackMessage maps Auth callback failures", () => {
  assert.equal(loginCallbackMessage(null, "exchange_failed"), null);
  assert.equal(
    loginCallbackMessage("error", "auth_unconfigured"),
    authUnconfiguredMessage(),
  );
  assert.match(
    loginCallbackMessage("error", "missing_code") ?? "",
    /missing its code/i,
  );
  assert.match(
    loginCallbackMessage("error", "exchange_failed") ?? "",
    /expired or already used/i,
  );
  assert.match(loginCallbackMessage("error", "nope") ?? "", /expired or failed/i);
});

test("login arrival copy names the page and a dead session", () => {
  assert.equal(loginArrivalMessage({ auth: "error", reason: "exchange_failed" }), null);
  assert.equal(loginArrivalMessage({}), null);
  assert.equal(loginArrivalMessage({ signedOut: "1" }), "You are signed out.");
  assert.equal(
    loginArrivalMessage({ reason: "session_ended", next: "/jobs/maple-point" }),
    "Your sign-in ended. Sign in to go back to Maple Point.",
  );
  assert.equal(
    loginArrivalMessage({ next: "/pack/maple-point/rfi/new?sheet=E-101" }),
    "Sign in to go back to the RFI draft.",
  );
  assert.equal(continuePlaceLabel("/jobs/cedar-ridge"), "Cedar Ridge");
  assert.equal(continuePlaceLabel("//evil.example"), null);
  assert.equal(
    signInContinuePath("/pack/maple-point/rfi/new?sheet=E-101", true),
    "/?next=%2Fpack%2Fmaple-point%2Frfi%2Fnew%3Fsheet%3DE-101&reason=session_ended",
  );
  assert.equal(signInContinuePath("https://evil.example"), "/?next=%2Fjobs");
});

test("friendlyAuthError maps common Supabase failures", () => {
  assert.equal(
    friendlyAuthError("Invalid login credentials"),
    "Email or password is incorrect.",
  );
  assert.match(
    friendlyAuthError("Email not confirmed"),
    /confirm this account/i,
  );
  assert.match(
    friendlyAuthError("User already registered"),
    /already has an account/i,
  );
  assert.equal(
    friendlyAuthError("Password should be at least 6 characters"),
    "Password must be at least 6 characters.",
  );
  assert.equal(friendlyAuthError("email is required"), "Enter a crew email address.");
  assert.equal(friendlyAuthError(""), "Could not sign in.");
  assert.equal(
    friendlyAuthError("Could not create an account."),
    "Could not create an account.",
  );
  assert.match(friendlyAuthError("JWT expired"), /sign-in ended/i);
  assert.equal(
    friendlyAuthError("Invalid JSON"),
    "Sign-in could not read that request. Try again.",
  );
  assert.equal(
    friendlyAuthError("AuthApiError: jwt malformed"),
    "Your sign-in ended. Sign in again.",
  );
  assert.doesNotMatch(friendlyAuthError("AuthApiError: something odd"), /authapierror/i);
});

test("login form keeps real /api/session Auth and no role picker", () => {
  const src = readFileSync(new URL("../components/LoginForm.tsx", import.meta.url), "utf8");
  assert.match(src, /\/api\/session/);
  assert.match(src, /mode === "otp"/);
  assert.match(src, /loginArrivalMessage/);
  assert.match(src, /next: returnPath/);
  assert.equal(
    /setRole|FieldRoleName|gcfieldlog_stub_user|stub login/i.test(src),
    false,
  );
});

test("login page starts Auth from keys, not a Host allowlist", () => {
  const src = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(src, /isSupabaseAuthConfigured/);
  assert.equal(/isAllowedAuthHost|PRODUCTION_AUTH_HOSTS/.test(src), false);
});

test("login copy stays Maple Point / fictional and has no fake auth path", () => {
  const blob = [
    loginModeCopy("signin").helper,
    loginModeCopy("signup").helper,
    loginModeCopy("otp").helper,
    authUnconfiguredMessage(),
    friendlyAuthError("Invalid login credentials"),
    friendlyAuthError("JWT expired"),
    loginCallbackMessage("error", "auth_unconfigured"),
    loginArrivalMessage({ reason: "session_ended", next: "/jobs/maple-point" }) ?? "",
    loginArrivalMessage({ signedOut: "1" }) ?? "",
  ].join("\n");
  assert.match(blob, /Maple Point/);
  assert.equal(forbidden.test(blob), false);
  assert.equal(fakeAuth.test(blob), false);
});
