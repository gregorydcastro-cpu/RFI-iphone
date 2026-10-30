import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { legalRedirects } from "./legalRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legal aliases permanently move to /terms or /privacy (308)", () => {
  assert.deepEqual(legalRedirects(), [
    {
      source: "/legal",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/tos",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-of-service",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/privacy-policy",
      destination: "/privacy",
      permanent: true,
    },
  ]);
  for (const redirect of legalRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.ok(redirect.destination === "/terms" || redirect.destination === "/privacy");
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.legalRedirects\(\)/);
  assert.doesNotMatch(config, /["']\/legal["']/);
  assert.doesNotMatch(config, /\/privacy-policy|\/tos|\/terms-of-service/);
  assert.doesNotMatch(config, /\/terms/);
  assert.doesNotMatch(config, /\/privacy/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/legal|\/privacy-policy|\/terms-of-service|\/tos/);
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/terms"));
  assert.ok(PUBLIC_PAGE_PATHS.includes("/privacy"));
  const terms = readRepo("app/terms/page.tsx");
  assert.match(terms, /publicPageMetadata\("\/terms"\)/);
  const privacy = readRepo("app/privacy/page.tsx");
  assert.match(privacy, /publicPageMetadata\("\/privacy"\)/);
  for (const page of [
    "app/legal/page.tsx",
    "app/legal/route.ts",
    "app/tos/page.tsx",
    "app/tos/route.ts",
    "app/terms-of-service/page.tsx",
    "app/terms-of-service/route.ts",
    "app/privacy-policy/page.tsx",
    "app/privacy-policy/route.ts",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
