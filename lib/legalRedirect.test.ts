import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { legalRedirects } from "./legalRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("/legal permanently moves to /terms (308)", () => {
  assert.deepEqual(legalRedirects(), [
    {
      source: "/legal",
      destination: "/terms",
      permanent: true,
    },
  ]);
  for (const redirect of legalRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.equal(redirect.destination, "/terms");
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.legalRedirects\(\)/);
  assert.doesNotMatch(config, /["']\/legal["']/);
  assert.doesNotMatch(config, /\/terms/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/legal/);
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/terms"));
  const terms = readRepo("app/terms/page.tsx");
  assert.match(terms, /publicPageMetadata\("\/terms"\)/);
  for (const page of ["app/legal/page.tsx", "app/legal/route.ts"]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
