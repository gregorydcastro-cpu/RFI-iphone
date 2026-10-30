import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contactRedirects } from "./contactRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("/contact, /help, /faq, /contact-us, and /support-center permanently move to /support", () => {
  assert.deepEqual(contactRedirects(), [
    {
      source: "/contact",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/help",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/faq",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/contact-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/support-center",
      destination: "/support",
      permanent: true,
    },
  ]);
  for (const redirect of contactRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.equal(redirect.destination, "/support");
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.contactRedirects\(\)/);
  assert.doesNotMatch(config, /\/privacy|\/terms|\/support|\/help|\/faq/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/contact|\/help|\/faq|\/contact-us|\/support-center/);
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/support"));
  const support = readRepo("app/support/page.tsx");
  assert.match(support, /publicPageMetadata\("\/support"\)/);
  for (const page of [
    "app/contact/page.tsx",
    "app/contact/route.ts",
    "app/help/page.tsx",
    "app/help/route.ts",
    "app/faq/page.tsx",
    "app/faq/route.ts",
    "app/contact-us/page.tsx",
    "app/contact-us/route.ts",
    "app/support-center/page.tsx",
    "app/support-center/route.ts",
    "public/contact-us",
    "public/contact-us.html",
    "public/support-center",
    "public/support-center.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
