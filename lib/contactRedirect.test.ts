import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contactRedirects } from "./contactRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("/contact permanently moves to /support", () => {
  assert.deepEqual(contactRedirects(), [
    {
      source: "/contact",
      destination: "/support",
      permanent: true,
    },
  ]);

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.contactRedirects\(\)/);
  assert.doesNotMatch(config, /\/privacy|\/terms|\/support/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/contact/);
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/support"));
  const support = readRepo("app/support/page.tsx");
  assert.match(support, /publicPageMetadata\("\/support"\)/);
  assert.equal(existsSync(new URL("../app/contact/page.tsx", import.meta.url)), false);
});
