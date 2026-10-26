import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEPLOY_SHA_ENV,
  DEPLOY_SHA_LENGTH,
  HEALTH_CACHE_CONTROL,
  HEALTH_PATH,
  healthBody,
  healthResponse,
  isPublicHealthPath,
  shortDeploySha,
} from "./health.ts";
import { ROBOTS_DISALLOW } from "./siteInfo.ts";
import { isRobotsDisallowedPath } from "./siteMetadata.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("liveness body is ok and a short deploy sha", () => {
  assert.equal(DEPLOY_SHA_ENV, "VERCEL_GIT_COMMIT_SHA");
  assert.equal(DEPLOY_SHA_LENGTH, 7);
  assert.equal(shortDeploySha(undefined), null);
  assert.equal(shortDeploySha(null), null);
  assert.equal(shortDeploySha(""), null);
  assert.equal(shortDeploySha("   "), null);
  assert.equal(shortDeploySha("abc1234ffff"), "abc1234");
  assert.equal(shortDeploySha("  abc1234ffff\n"), "abc1234");
  assert.equal(shortDeploySha("abc"), "abc");

  const full = "0123456789abcdef0123456789abcdef01234567";
  assert.equal(full.length, 40);
  assert.equal(shortDeploySha(full), "0123456");
  assert.equal(shortDeploySha(full).length, 7);
  assert.equal(full.includes(shortDeploySha(full) ?? ""), true);
  assert.equal(JSON.stringify(healthBody(full)).includes(full), false);

  assert.deepEqual(healthBody(undefined), { ok: true, commit: null });
  assert.deepEqual(healthBody(null), { ok: true, commit: null });
  assert.deepEqual(healthBody("  "), { ok: true, commit: null });
  assert.deepEqual(healthBody(full), { ok: true, commit: "0123456" });
});

test("liveness response is 200 JSON and Cache-Control no-store", async () => {
  const full = "0123456789abcdef0123456789abcdef01234567";
  const response = healthResponse(full);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), HEALTH_CACHE_CONTROL);
  assert.equal(HEALTH_CACHE_CONTROL, "no-store");
  const type = response.headers.get("content-type") ?? "";
  assert.match(type, /^application\/json\b/);
  assert.deepEqual(await response.json(), { ok: true, commit: "0123456" });

  const missing = healthResponse(undefined);
  assert.equal(missing.status, 200);
  assert.equal(missing.headers.get("cache-control"), "no-store");
  assert.deepEqual(await missing.json(), { ok: true, commit: null });
  assert.doesNotMatch(JSON.stringify(await healthResponse("   ").json()), /secret|stripe|supabase/i);
});

test("signed-out proxy lets /api/health through before the session refresh", () => {
  assert.equal(HEALTH_PATH, "/api/health");
  assert.equal(isPublicHealthPath("/api/health"), true);
  assert.equal(isPublicHealthPath("/api/health/"), false);
  assert.equal(isPublicHealthPath("/api/healthz"), false);
  assert.equal(isPublicHealthPath("/api/health/extra"), false);
  assert.equal(isPublicHealthPath("/api"), false);
  assert.equal(isPublicHealthPath("/health"), false);
  assert.equal(isPublicHealthPath("/API/health"), false);

  const proxy = readRepo("proxy.ts");
  const slashAt = proxy.indexOf("slashToCanonical(");
  const healthAt = proxy.indexOf("isPublicHealthPath(");
  const sessionAt = proxy.indexOf("await updateSession(");
  assert.ok(slashAt >= 0 && healthAt > slashAt);
  assert.ok(sessionAt > healthAt);
  assert.match(proxy, /isPublicHealthPath\(request\.nextUrl\.pathname\)/);
  assert.match(proxy, /NextResponse\.next\(\{ request \}\)/);
  assert.doesNotMatch(proxy, /redirect/);

  const route = readRepo("app/api/health/route.ts");
  assert.match(route, /export function GET\(/);
  assert.match(route, /healthResponse\(readEnv\(DEPLOY_SHA_ENV\)\)/);
  assert.match(route, /dynamic = "force-dynamic"/);
  assert.doesNotMatch(route, /readAppSession|stripe|supabase|getUser|createClient/i);
  assert.doesNotMatch(route, /process\.env/);
  assert.doesNotMatch(route, /apiNotFoundResponse/);

  const helper = readRepo("lib/health.ts");
  assert.match(helper, /VERCEL_GIT_COMMIT_SHA/);
  assert.doesNotMatch(helper, /from ["'][^"']*(stripe|supabase|session)/);
  assert.doesNotMatch(helper, /readAppSession|createClient|stripe\(/);
});

test("/api stays disallowed in robots, including liveness", () => {
  assert.ok(ROBOTS_DISALLOW.includes("/api"));
  assert.equal(ROBOTS_DISALLOW.includes("/api/health"), false);
  assert.equal(isRobotsDisallowedPath("/api"), true);
  assert.equal(isRobotsDisallowedPath("/api/health"), true);
  assert.equal(isRobotsDisallowedPath(HEALTH_PATH), true);
  assert.equal(isRobotsDisallowedPath("/support"), false);

  const robots = readRepo("app/robots.ts");
  assert.match(robots, /robotsRules/);
  assert.doesNotMatch(robots, /\/api\/health/);
  assert.doesNotMatch(readRepo("lib/siteInfo.ts"), /\/api\/health/);
});
