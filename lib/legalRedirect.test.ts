import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { legalRedirects } from "./legalRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legal aliases permanently move to /terms or /privacy (308), including /eula, /cookies, and /cookie-policy", () => {
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
      source: "/eula",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/privacy-policy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookies",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-policy",
      destination: "/privacy",
      permanent: true,
    },
  ]);
  for (const redirect of legalRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.ok(redirect.destination === "/terms" || redirect.destination === "/privacy");
  }

  const bySource = new Map(legalRedirects().map((redirect) => [redirect.source, redirect.destination]));
  assert.equal(bySource.get("/eula"), "/terms");
  assert.equal(bySource.get("/eula"), bySource.get("/legal"));
  assert.equal(bySource.get("/tos"), bySource.get("/legal"));
  assert.equal(bySource.get("/terms-of-service"), bySource.get("/legal"));
  assert.equal(bySource.get("/cookies"), "/privacy");
  assert.equal(bySource.get("/cookie-policy"), "/privacy");
  assert.equal(bySource.get("/cookies"), bySource.get("/privacy-policy"));
  const sources = new Set(legalRedirects().map((redirect) => redirect.source));
  for (const redirect of legalRedirects()) {
    assert.equal(sources.has(redirect.destination), false, redirect.source);
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.legalRedirects\(\)/);
  assert.doesNotMatch(config, /["']\/legal["']/);
  assert.doesNotMatch(config, /\/privacy-policy|\/tos|\/terms-of-service|\/eula|\/cookies|\/cookie-policy/);
  assert.doesNotMatch(config, /\/terms/);
  assert.doesNotMatch(config, /\/privacy/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/legal|\/privacy-policy|\/terms-of-service|\/tos|\/eula|\/cookies|\/cookie-policy/);
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
    "app/eula/page.tsx",
    "app/eula/route.ts",
    "app/cookies/page.tsx",
    "app/cookies/route.ts",
    "app/cookie-policy/page.tsx",
    "app/cookie-policy/route.ts",
    "public/eula",
    "public/eula.html",
    "public/cookies",
    "public/cookies.html",
    "public/cookie-policy",
    "public/cookie-policy.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
