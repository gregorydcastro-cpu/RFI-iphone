import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACCOUNT_PAGE_TITLE,
  ACCOUNT_SIGN_IN_COPY,
  accountSignInGate,
  isAccountBoardPath,
  isAccountPath,
} from "./accountGate.ts";

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const DASHBOARD_MARKERS = [
  "ProcoreConnectCard",
  "InviteCrewCard",
  "NotifyEmailForm",
  "getProcoreConnectionView",
  "stripeReadiness",
  "BILLING_OPENS_SOON",
  "data-billing-checkout",
  "Viewer portal folders",
  "Refresh all",
  "loadAccountNotifyEmail",
];

test("signed-out account copy returns the crew to /account", () => {
  assert.equal(ACCOUNT_SIGN_IN_COPY, "Sign in to open your account.");
  assert.equal(ACCOUNT_PAGE_TITLE, "Account — GC Field Log");

  const open = accountSignInGate(false);
  assert.equal(open.text, "Sign in to open your account.");
  assert.equal(open.signInHref, "/?next=%2Faccount");
  assert.equal(open.homeHref, "/");
  assert.equal(open.signInLabel, "Sign in");
  assert.equal(open.homeLabel, "Home");

  const ended = accountSignInGate(true);
  assert.equal(ended.text, "Your sign-in ended. Sign in to open your account.");
  assert.equal(ended.signInHref, "/?next=%2Faccount&reason=session_ended");
  assert.equal(ended.homeHref, "/");

  assert.equal(isAccountPath("/account"), true);
  assert.equal(isAccountPath("/account/"), true);
  assert.equal(isAccountPath("/account/board"), false);
  assert.equal(isAccountPath("/accounting"), false);
  assert.equal(isAccountBoardPath("/account/board"), true);
  assert.equal(isAccountBoardPath("/account/board/"), true);
  assert.equal(isAccountBoardPath("/account"), false);
});

test("signed-out /account renders a sign-in shell and does not load the dashboard", () => {
  const page = readRepo("app/account/page.tsx");
  const shell = readRepo("components/AccountSignInShell.tsx");
  const signedIn = readRepo("app/account/SignedInAccount.tsx");

  const board = readRepo("app/account/board/page.tsx");
  const proxy = readRepo("proxy.ts");
  const route = readRepo("lib/accountRoute.ts");

  assert.match(page, /AccountSignInShell/);
  assert.match(page, /title: ACCOUNT_PAGE_TITLE/);
  assert.match(page, /description: ACCOUNT_SIGN_IN_COPY/);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(page, /if \(session\) redirect\("\/account\/board"\)/);
  assert.doesNotMatch(page, /SignedInAccount|getProcoreConnectionView|stripeReadiness/);

  assert.match(board, /await import\("\.\.\/SignedInAccount"\)/);
  assert.match(board, /if \(!session\) redirect\("\/account"\)/);
  assert.match(board, /title: ACCOUNT_PAGE_TITLE/);
  assert.match(board, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  const redirectAt = board.indexOf('redirect("/account")');
  const importAt = board.indexOf('await import("../SignedInAccount")');
  assert.ok(redirectAt >= 0 && importAt > redirectAt);
  assert.doesNotMatch(board, /from "@\/app\/account\/SignedInAccount"/);

  assert.match(proxy, /shouldServeAccountBoard/);
  assert.match(proxy, /shouldSendAccountBoardBack/);
  assert.match(proxy, /accountBoardRewrite/);
  assert.match(proxy, /sendSignedOutToAccountShell/);
  assert.doesNotMatch(proxy, /NextResponse\.rewrite\(/);
  assert.doesNotMatch(proxy, /redirect/);
  assert.match(route, /NextResponse\.rewrite/);
  assert.match(route, /NextResponse\.redirect/);
  assert.match(route, /url\.pathname = "\/account\/board"/);
  assert.match(route, /isAccountPath/);
  assert.match(route, /isAccountBoardPath/);

  assert.match(shell, /accountSignInGate/);
  assert.match(shell, /gate\.signInHref/);
  assert.match(shell, /gate\.homeHref/);
  assert.match(shell, /label="Hear this"/);
  assert.match(shell, /SignedOutBar/);
  assert.doesNotMatch(shell, /AppHeader|procoreAuthHealth|procoreReturnPath/);
  const bar = readRepo("components/SignedOutBar.tsx");
  assert.match(bar, /Pricing/);
  assert.match(bar, />Login</);
  assert.doesNotMatch(bar, /AppHeader|Procore|Refresh all|Billing/);
  const header = readRepo("components/AppHeader.tsx");
  assert.match(header, /procoreReturnPath/);
  assert.doesNotMatch(header, /procoreAuthHealth/);

  for (const marker of DASHBOARD_MARKERS) {
    assert.equal(page.includes(marker), false, `page includes ${marker}`);
    assert.equal(shell.includes(marker), false, `shell includes ${marker}`);
  }

  assert.match(signedIn, /ProcoreConnectCard/);
  assert.match(signedIn, /Viewer portal folders/);
  assert.match(signedIn, /Refresh all/);
  assert.match(signedIn, /BILLING_OPENS_SOON/);
  assert.match(signedIn, /data-billing-checkout/);
  assert.match(signedIn, /logStripeEnvGap\("account"/);
  assert.match(signedIn, /getProcoreConnectionView/);
});

test("dashboard data APIs refuse a signed-out caller before loading records", () => {
  const checks: Array<{ file: string; marker: string; session?: string }> = [
    {
      file: "app/api/account/notify-email/route.ts",
      marker: "loadAccountNotifyEmail",
    },
    {
      file: "app/api/share/folders/route.ts",
      marker: "listSharePortal",
      session: "sessionFromRequest()",
    },
    {
      file: "app/api/share/pins/route.ts",
      marker: "pinSheetsToFolder",
      session: "sessionFromRequest()",
    },
    {
      file: "app/api/share/refresh-all/route.ts",
      marker: "refreshAllPinnedSheets",
      session: "fieldRoleForRequest",
    },
    { file: "app/api/invites/route.ts", marker: "mintInvite" },
  ];

  for (const check of checks) {
    const route = readRepo(check.file);
    const start = route.search(/export async function (GET|POST|PATCH)/);
    const handler = start >= 0 ? route.slice(start) : route;
    const sessionNeedle = check.session ?? "readAppSession()";
    const sessionAt = handler.indexOf(sessionNeedle);
    const markerAt = handler.indexOf(check.marker);
    assert.ok(sessionAt >= 0, `${check.file} reads the session`);
    assert.ok(markerAt > sessionAt, `${check.file} loads data after the session`);
    const before = handler.slice(0, markerAt);
    assert.match(before, /if \(!session\)/, check.file);
    assert.match(before, /401/, check.file);
  }
});
