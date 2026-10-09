import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  TIME_CLOCK_SIGN_IN_COPY,
  TIME_SIGNED_OUT_TITLE,
  isTimeBoardPath,
  isTimeClockPath,
  timeSignInGate,
} from "./timeGate.ts";

const ROOT = new URL("..", import.meta.url);

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function quoted(source: string, field: string): string[] {
  return [...source.matchAll(new RegExp(`${field}:\\s*"([^"]+)"`, "g"))].map(
    (match) => match[1] ?? "",
  );
}

const DEMO_PINS = quoted(readRepo("lib/timeDemo.ts"), "pin_stub");
const DEMO_NAMES = [
  ...quoted(readRepo("lib/timeDemo.ts"), "name"),
  ...quoted(readRepo("lib/crew.ts"), "name"),
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

test("signed-out time copy returns the crew to /time", () => {
  assert.equal(TIME_CLOCK_SIGN_IN_COPY, "Sign in to use the time clock.");
  assert.equal(TIME_SIGNED_OUT_TITLE, "Time — GC Field Log");

  const open = timeSignInGate(false);
  assert.equal(open.text, "Sign in to use the time clock.");
  assert.equal(open.signInHref, "/?next=%2Ftime");
  assert.equal(open.homeHref, "/");
  assert.equal(open.signInLabel, "Sign in");
  assert.equal(open.homeLabel, "Home");

  const ended = timeSignInGate(true);
  assert.equal(ended.text, "Your sign-in ended. Sign in to use the time clock.");
  assert.equal(ended.signInHref, "/?next=%2Ftime&reason=session_ended");
  assert.equal(ended.homeHref, "/");

  assert.equal(isTimeClockPath("/time"), true);
  assert.equal(isTimeClockPath("/time/"), true);
  assert.equal(isTimeClockPath("/time/board"), false);
  assert.equal(isTimeClockPath("/timeline"), false);
  assert.equal(isTimeClockPath("/jobs"), false);
  assert.equal(isTimeBoardPath("/time/board"), true);
  assert.equal(isTimeBoardPath("/time/board/"), true);
  assert.equal(isTimeBoardPath("/time"), false);
});

test("signed-out /time renders a sign-in shell and does not load the roster", () => {
  const page = readRepo("app/time/page.tsx");
  const shell = readRepo("components/TimeSignInShell.tsx");
  const signedIn = readRepo("app/time/SignedInTime.tsx");
  const board = readRepo("app/time/board/page.tsx");
  const proxy = readRepo("proxy.ts");
  const route = readRepo("lib/timeRoute.ts");

  assert.match(page, /TimeSignInShell/);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(page, /if \(session\) redirect\("\/time\/board"\)/);
  assert.doesNotMatch(page, /getTimeSnapshot|TimeBoard|timeDemo|timeStore|pin_stub|SignedInTime/);

  assert.match(shell, /timeSignInGate/);
  assert.match(shell, /gate\.signInHref/);
  assert.match(shell, /gate\.homeHref/);
  assert.match(shell, /label="Hear this"/);
  assert.doesNotMatch(shell, /timeDemo|timeStore|TimeBoard|WorkerPunchCard|pin_stub|getTimeSnapshot/);
  for (const name of DEMO_NAMES) {
    assert.equal(shell.includes(name), false, name);
    assert.equal(page.includes(name), false, name);
  }
  for (const pin of DEMO_PINS) {
    assert.equal(shell.includes(pin), false, pin);
    assert.equal(page.includes(pin), false, pin);
  }

  assert.match(signedIn, /getTimeSnapshot/);
  assert.match(signedIn, /<TimeBoard/);
  assert.match(signedIn, /signedIn/);
  assert.match(board, /await import\("\.\.\/SignedInTime"\)/);
  assert.match(board, /if \(!session\) redirect\("\/time"\)/);
  const redirectAt = board.indexOf('redirect("/time")');
  const importAt = board.indexOf('await import("../SignedInTime")');
  assert.ok(redirectAt >= 0 && importAt > redirectAt);
  assert.doesNotMatch(board, /timeDemo|from "@\/app\/time\/SignedInTime"/);

  assert.match(proxy, /shouldServeTimeBoard/);
  assert.match(proxy, /shouldSendTimeBoardBack/);
  assert.match(proxy, /timeBoardRewrite/);
  assert.match(proxy, /sendSignedOutToTimeShell/);
  assert.doesNotMatch(proxy, /NextResponse\.rewrite\(/);
  assert.doesNotMatch(proxy, /redirect/);
  assert.match(route, /NextResponse\.rewrite/);
  assert.match(route, /NextResponse\.redirect/);
  assert.match(route, /url\.pathname = "\/time\/board"/);
  assert.match(route, /isTimeClockPath/);
  assert.match(route, /isTimeBoardPath/);
});

test("GET /api/time checks the session before loading crew or punches", () => {
  const route = readRepo("app/api/time/route.ts");
  const fn = route.slice(route.indexOf("export async function GET"));
  const sessionAt = fn.indexOf("await readAppSession()");
  const snapAt = fn.indexOf("await getTimeSnapshot");
  assert.ok(sessionAt >= 0 && snapAt > sessionAt);
  const beforeSnapshot = fn.slice(0, snapAt);
  assert.match(beforeSnapshot, /if \(!session\)/);
  assert.match(beforeSnapshot, /Sign in first\./);
  assert.match(beforeSnapshot, /status: 401/);
  assert.doesNotMatch(beforeSnapshot, /workers|pin_stub|MAPLE_POINT/);

  const smoke = readRepo("scripts/smoke-go-live.sh");
  assert.match(smoke, /GET \/api\/time without a session must not return the crew roster/);
  assert.match(smoke, /expected 401, no roster/);
  assert.doesNotMatch(smoke, /GET \/api\/time\?job=maple-point \(must be 200\)/);
});

test("demo PIN fixtures are not imported by client components", () => {
  const files = walk(ROOT.pathname).filter((file) => /\.(tsx|ts|jsx|js)$/.test(file));
  const clientImporters: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (!text.includes("timeDemo")) continue;
    const relative = path.relative(ROOT.pathname, file);
    if (relative === "lib/timeStore.ts" || relative === "lib/timeGate.test.ts") continue;
    if (text.includes('"use client"') || text.includes("'use client'")) {
      clientImporters.push(relative);
    }
    if (relative.startsWith(`components${path.sep}`)) {
      clientImporters.push(relative);
    }
  }
  assert.deepEqual(clientImporters, []);
});

test("demo PIN digits live only in the server fixture and tests", () => {
  const roots = ["app", "components", "lib", "scripts", "docs"].map((dir) =>
    path.join(ROOT.pathname, dir),
  );
  const files = [
    ...roots.flatMap((dir) => walk(dir)),
    path.join(ROOT.pathname, "README.md"),
  ].filter((file) => {
    const relative = path.relative(ROOT.pathname, file);
    if (relative === "lib/timeDemo.ts") return false;
    if (relative.endsWith(".test.ts")) return false;
    return /\.(tsx|ts|jsx|js|mjs|md|sh)$/.test(file);
  });
  const leaks: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const pin of DEMO_PINS) {
      const hit = new RegExp(`(?<![0-9])${pin}(?![0-9])`).test(text);
      if (hit) leaks.push(`${path.relative(ROOT.pathname, file)}:${pin}`);
    }
  }
  assert.deepEqual(leaks, []);
  assert.equal(DEMO_PINS.length, 6);
});
