import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalSlashPath } from "./canonicalSlashPath.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("trailing slashes keep the canonical path, except the not-found document", () => {
  assert.equal(canonicalSlashPath("/"), null);
  assert.equal(canonicalSlashPath("/pricing"), null);
  assert.equal(canonicalSlashPath("/_not-found"), null);
  assert.equal(canonicalSlashPath("/_not-found/"), null);
  assert.equal(canonicalSlashPath("/_not-found///"), null);
  assert.equal(canonicalSlashPath("/pricing/"), "/pricing");
  assert.equal(canonicalSlashPath("/pricing///"), "/pricing");
  assert.equal(canonicalSlashPath("/pack/maple-point/"), "/pack/maple-point");
  assert.equal(canonicalSlashPath("/invite/not-a-real-token/"), "/invite/not-a-real-token");
  assert.equal(canonicalSlashPath("/.well-known/security.txt/"), "/.well-known/security.txt");
});

test("the proxy sees /_not-found/ because Next's slash trim is off", () => {
  const config = readRepo("next.config.ts");
  const proxy = readRepo("proxy.ts");
  const helper = readRepo("lib/slashPath.ts");
  const paths = readRepo("lib/canonicalSlashPath.ts");
  assert.match(paths, /stripped === "\/_not-found"/);
  assert.match(config, /skipTrailingSlashRedirect:\s*true/);
  assert.match(proxy, /slashToCanonical/);
  assert.doesNotMatch(proxy, /redirect/);
  assert.match(helper, /NextResponse\.redirect\(url, 308\)/);
  assert.match(helper, /new URL\(request\.url\)/);
  assert.doesNotMatch(helper, /nextUrl\.clone\(\)/);
  const slashAt = proxy.indexOf("slashToCanonical(");
  const directAt = proxy.indexOf("if (isDirectNotFoundRequest(");
  assert.ok(slashAt >= 0 && directAt > slashAt);
});
