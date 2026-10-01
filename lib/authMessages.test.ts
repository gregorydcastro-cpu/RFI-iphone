import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  authCallbackLocation,
  authUnconfiguredMessage,
  continuePlaceLabel,
  friendlyAuthError,
  inviteAcceptPath,
  inviteAcceptedMessage,
  inviteConfirmMessage,
  inviteFormHelper,
  inviteLanding,
  inviteSwitchAccountHref,
  loginArrivalMessage,
  loginCallbackMessage,
  loginModeCopy,
  parseFieldAuthMode,
  safeNextPath,
  sessionExitLocation,
  sessionGateLead,
  signInContinuePath,
  signedOutGate,
  staleSessionClearPath,
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
  assert.equal(safeNextPath(" /share "), "/share");
  assert.equal(safeNextPath("/invite/tok_demo"), "/invite/tok_demo");
  assert.equal(
    safeNextPath("/pack/maple-point/rfi/new?sheet=E-101"),
    "/pack/maple-point/rfi/new?sheet=E-101",
  );
  assert.equal(safeNextPath("//evil.example"), "/jobs");
  assert.equal(safeNextPath("https://evil.example"), "/jobs");
  assert.equal(safeNextPath("https://www.gcfieldlog.com/jobs"), "/jobs");
  assert.equal(safeNextPath("/\\evil.example"), "/jobs");
  assert.equal(safeNextPath("/\\/evil.example"), "/jobs");
  assert.equal(safeNextPath("/%2F%2Fevil.example"), "/jobs");
  assert.equal(safeNextPath("/%5Cevil.example"), "/jobs");
  assert.equal(safeNextPath("/?next=/jobs"), "/jobs");
  assert.equal(safeNextPath("/auth/callback?code=1"), "/jobs");
  assert.equal(safeNextPath("/api/session"), "/jobs");
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
  assert.equal(continuePlaceLabel("/invite/tok_demo"), "the invite");
  assert.equal(continuePlaceLabel("/share"), "share");
  assert.equal(continuePlaceLabel("//evil.example"), null);
  assert.equal(continuePlaceLabel("/\\evil.example"), null);
  assert.equal(
    signInContinuePath("/pack/maple-point/rfi/new?sheet=E-101", true),
    "/?next=%2Fpack%2Fmaple-point%2Frfi%2Fnew%3Fsheet%3DE-101&reason=session_ended",
  );
  assert.equal(signInContinuePath("https://evil.example"), "/?next=%2Fjobs");
  assert.equal(signInContinuePath("/?next=/share"), "/?next=%2Fjobs");
  assert.equal(
    loginArrivalMessage({ signedOut: "1", next: "/invite/tok_demo" }),
    "You are signed out. Sign in to go back to the invite.",
  );
  assert.equal(
    loginArrivalMessage({ reason: "session_ended", next: "/share" }),
    "Your sign-in ended. Sign in to go back to share.",
  );
});

test("auth callback failures return to login and keep a safe next", () => {
  assert.equal(
    authCallbackLocation("https://www.gcfieldlog.com", "/invite/tok_demo", "session"),
    "https://www.gcfieldlog.com/invite/tok_demo",
  );
  assert.equal(
    authCallbackLocation("https://www.gcfieldlog.com", "/\\evil.example", "session"),
    "https://www.gcfieldlog.com/jobs",
  );
  const failed = new URL(
    authCallbackLocation(
      "https://www.gcfieldlog.com",
      "/pack/maple-point/rfi/new?sheet=E-101",
      "auth_unconfigured",
    ),
  );
  assert.equal(failed.origin, "https://www.gcfieldlog.com");
  assert.equal(failed.pathname, "/");
  assert.equal(failed.searchParams.get("auth"), "error");
  assert.equal(failed.searchParams.get("reason"), "auth_unconfigured");
  assert.equal(failed.searchParams.get("sheet"), null);
  assert.equal(
    failed.searchParams.get("next"),
    "/pack/maple-point/rfi/new?sheet=E-101",
  );
  const missing = new URL(
    authCallbackLocation("https://gcfieldlog.com", "/share", "missing_code"),
  );
  assert.equal(missing.pathname, "/");
  assert.equal(missing.searchParams.get("reason"), "missing_code");
  assert.equal(missing.searchParams.get("next"), "/share");
});

test("dead-session clear and sign-out keep a same-site return", () => {
  assert.equal(
    staleSessionClearPath({ next: "/share" }),
    "/api/session/logout?reason=session_ended&next=%2Fshare",
  );
  assert.equal(
    staleSessionClearPath({
      next: "//evil.example",
      auth: "error",
      reason: "exchange_failed",
    }),
    "/api/session/logout?auth=error&reason=exchange_failed&next=%2Fjobs",
  );
  const ended = new URL(
    sessionExitLocation({
      origin: "https://www.gcfieldlog.com",
      reason: "session_ended",
      next: "/invite/tok_demo",
    }),
  );
  assert.equal(ended.pathname, "/");
  assert.equal(ended.searchParams.get("reason"), "session_ended");
  assert.equal(ended.searchParams.get("cleared"), "1");
  assert.equal(ended.searchParams.get("next"), "/invite/tok_demo");
  assert.equal(ended.searchParams.get("signedOut"), null);
  const callback = new URL(
    sessionExitLocation({
      origin: "https://www.gcfieldlog.com",
      auth: "error",
      reason: "exchange_failed",
      next: "/share",
    }),
  );
  assert.equal(callback.searchParams.get("auth"), "error");
  assert.equal(callback.searchParams.get("reason"), "exchange_failed");
  assert.equal(callback.searchParams.get("cleared"), "1");
  assert.equal(callback.searchParams.get("next"), "/share");
  const signedOut = new URL(
    sessionExitLocation({
      origin: "https://www.gcfieldlog.com",
      next: "/invite/tok_demo",
    }),
  );
  assert.equal(signedOut.searchParams.get("signedOut"), "1");
  assert.equal(signedOut.searchParams.get("next"), "/invite/tok_demo");
  assert.equal(signedOut.searchParams.get("cleared"), null);
  const plain = new URL(sessionExitLocation({ origin: "https://www.gcfieldlog.com" }));
  assert.equal(plain.search, "?signedOut=1");
});

test("invite accept return path and landing states", () => {
  assert.equal(inviteAcceptPath("tok_demo"), "/invite/tok_demo");
  assert.equal(inviteAcceptPath("../jobs"), "/jobs");
  assert.equal(inviteAcceptPath("tok/other"), "/jobs");
  assert.equal(
    inviteSwitchAccountHref("tok_demo"),
    "/api/session/logout?next=%2Finvite%2Ftok_demo",
  );
  assert.equal(inviteLanding({ status: "valid", signedIn: false }).kind, "form");
  const mismatch = inviteLanding({
    status: "valid",
    signedIn: true,
    inviteeEmail: "alex.rivera@crew.example",
    sessionEmail: "pat.nguyen@crew.example",
  });
  assert.equal(mismatch.kind, "blocked");
  if (mismatch.kind === "blocked") assert.equal(mismatch.action, "switch");
  const usedIn = inviteLanding({ status: "used", signedIn: true });
  assert.equal(usedIn.kind, "blocked");
  if (usedIn.kind === "blocked") assert.equal(usedIn.action, "jobs");
  const same = inviteLanding({
    status: "valid",
    signedIn: true,
    inviteeEmail: "Alex.Rivera@crew.example",
    sessionEmail: "alex.rivera@crew.example",
  });
  assert.equal(same.kind, "form");
  assert.match(inviteConfirmMessage("otp"), /brings you back to this invite/i);
  assert.match(inviteConfirmMessage("signup"), /tap Accept/i);
  assert.match(
    inviteFormHelper({
      signedIn: true,
      role: "full",
      sessionEmail: "alex.rivera@crew.example",
    }),
    /Signed in as alex.rivera@crew.example/,
  );
  assert.equal(inviteAcceptedMessage("viewer").title, "You are in as view only");
  assert.equal(sessionGateLead(true), "Your sign-in ended.");
  const share = signedOutGate({
    next: "/share",
    sessionEnded: true,
    detail: "to create share folders and pin Maple Point sheets.",
  });
  assert.equal(share.lead, "Your sign-in ended.");
  assert.equal(
    share.href,
    "/?next=%2Fshare&reason=session_ended",
  );
  assert.match(share.text, /Maple Point/);
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
  assert.match(src, /staleSessionClearPath/);
  assert.match(src, /cleared !== "1"/);
  assert.equal(/isAllowedAuthHost|PRODUCTION_AUTH_HOSTS/.test(src), false);
});

test("callback, logout, invite, and share return paths stay on the safe helpers", () => {
  const callback = readFileSync(
    new URL("../app/auth/callback/route.ts", import.meta.url),
    "utf8",
  );
  const logout = readFileSync(
    new URL("../app/api/session/logout/route.ts", import.meta.url),
    "utf8",
  );
  const redeem = readFileSync(
    new URL("../app/api/invites/[token]/redeem/route.ts", import.meta.url),
    "utf8",
  );
  const invitePage = readFileSync(
    new URL("../app/invite/[token]/page.tsx", import.meta.url),
    "utf8",
  );
  const inviteForm = readFileSync(
    new URL("../components/InviteRedeemForm.tsx", import.meta.url),
    "utf8",
  );
  const sharePage = readFileSync(new URL("../app/share/page.tsx", import.meta.url), "utf8");
  const sharePortal = readFileSync(
    new URL("../components/SharePortal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(callback, /authCallbackLocation/);
  assert.match(callback, /expireSupabaseAuthCookies/);
  assert.equal(/dest\.pathname/.test(callback), false);
  assert.match(logout, /sessionExitLocation/);
  assert.match(logout, /expireSupabaseAuthCookies/);
  assert.match(redeem, /inviteAcceptPath/);
  assert.match(redeem, /friendlyAuthError\(\s*error\?\.message/);
  assert.equal(/\/invite\/\$\{/.test(redeem), false);
  assert.match(invitePage, /inviteAcceptPath/);
  assert.match(invitePage, /signInContinuePath/);
  const success = inviteForm.indexOf("if (redeemedRole)");
  const landing = inviteForm.indexOf("inviteLanding(");
  assert.ok(success > 0 && landing > success);
  assert.match(inviteForm, /Hear this/);
  assert.match(inviteForm, /actionHref\.startsWith\("\/api\/"\)/);
  assert.match(sharePage, /sessionEnded/);
  assert.match(sharePortal, /signedOutGate/);
  assert.match(sharePortal, /Hear this/);
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
    inviteConfirmMessage("otp"),
    inviteConfirmMessage("signup"),
    inviteFormHelper({ signedIn: false, role: "viewer" }),
    inviteAcceptedMessage("full").body,
    ...(["not_found", "expired", "used"] as const).map((status) => {
      const landing = inviteLanding({ status, signedIn: false });
      return landing.kind === "blocked" ? `${landing.title} ${landing.body}` : "";
    }),
    (() => {
      const landing = inviteLanding({
        status: "valid",
        signedIn: true,
        inviteeEmail: "alex.rivera@crew.example",
        sessionEmail: "pat.nguyen@crew.example",
      });
      return landing.kind === "blocked" ? `${landing.title} ${landing.body}` : "";
    })(),
    signedOutGate({
      next: "/share",
      sessionEnded: true,
      detail: "to create share folders and pin Maple Point sheets.",
    }).text,
    sessionGateLead(false),
  ].join("\n");
  assert.match(blob, /Maple Point/);
  assert.equal(forbidden.test(blob), false);
  assert.equal(fakeAuth.test(blob), false);
  assert.equal(/jwt|refresh token|refresh_token/i.test(blob), false);
});
