import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contactRedirects } from "./contactRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("/contact, /help, /faq, /contact-us, /support-center, /docs, /status, /blog, /changelog, /news, /press, /roadmap, /guides, /resources, /case-studies, /testimonials, /webinar, and /events permanently move to /support", () => {
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
    {
      source: "/docs",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/status",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/blog",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/changelog",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/news",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/press",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/roadmap",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/guides",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/resources",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/case-studies",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/testimonials",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/webinar",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/events",
      destination: "/support",
      permanent: true,
    },
  ]);
  const sources = new Set(contactRedirects().map((redirect) => redirect.source));
  for (const redirect of contactRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.equal(redirect.destination, "/support");
    assert.equal(sources.has(redirect.destination), false, redirect.source);
    assert.equal(redirect.source.slice(1).includes("/"), false, redirect.source);
    assert.doesNotMatch(redirect.source, /[:*]/);
    assert.equal(redirect.source.endsWith("/"), false, redirect.source);
  }
  const bySource = new Map(contactRedirects().map((redirect) => [redirect.source, redirect.destination]));
  assert.equal(bySource.get("/blog"), "/support");
  assert.equal(bySource.get("/changelog"), bySource.get("/contact"));
  assert.equal(bySource.get("/news"), bySource.get("/contact"));
  assert.equal(bySource.get("/press"), bySource.get("/contact"));
  assert.equal(bySource.get("/roadmap"), bySource.get("/contact"));
  assert.equal(bySource.get("/guides"), "/support");
  assert.equal(bySource.get("/resources"), bySource.get("/contact"));
  assert.equal(bySource.get("/case-studies"), bySource.get("/contact"));
  assert.equal(bySource.get("/testimonials"), bySource.get("/contact"));
  assert.equal(bySource.get("/webinar"), bySource.get("/contact"));
  assert.equal(bySource.get("/events"), bySource.get("/contact"));
  assert.equal(bySource.has("/webinar/extra"), false);
  assert.equal(bySource.has("/guides/post"), false);
  assert.equal(bySource.has("/web"), false);
  for (const path of [
    "/admin",
    "/api",
    "/humans.txt",
    "/zz-nope",
    "/blog/post",
    "/api/procore/status",
    "/api/docs",
    "/rfi",
    "/rfis",
    "/submittals",
    "/punch",
    "/daily-log",
    "/reports",
    "/photos",
    "/drawings",
    "/schedule",
    "/calendar",
    "/invite",
    "/notifications",
    "/billing",
    "/subscribe",
    "/upgrade",
    "/checkout",
    "/.well-known/apple-app-site-association",
  ]) {
    assert.equal(sources.has(path), false, path);
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.contactRedirects\(\)/);
  assert.doesNotMatch(config, /\/privacy|\/terms|\/support|\/help|\/faq|\/docs|\/status|\/blog|\/changelog|\/news|\/press|\/roadmap|\/guides|\/resources|\/case-studies|\/testimonials|\/webinar|\/events/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/contact|\/help|\/faq|\/contact-us|\/support-center|\/docs|\/status|\/blog|\/changelog|\/news|\/press|\/roadmap|\/guides|\/resources|\/case-studies|\/testimonials|\/webinar|\/events/);
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
    "app/docs/page.tsx",
    "app/docs/route.ts",
    "app/status/page.tsx",
    "app/status/route.ts",
    "public/docs",
    "public/docs.html",
    "public/status",
    "public/status.html",
    "app/blog/page.tsx",
    "app/blog/route.ts",
    "app/changelog/page.tsx",
    "app/changelog/route.ts",
    "app/news/page.tsx",
    "app/news/route.ts",
    "app/press/page.tsx",
    "app/press/route.ts",
    "app/roadmap/page.tsx",
    "app/roadmap/route.ts",
    "public/blog",
    "public/blog.html",
    "public/changelog",
    "public/changelog.html",
    "public/news",
    "public/news.html",
    "public/press",
    "public/press.html",
    "public/roadmap",
    "public/roadmap.html",
    "app/guides/page.tsx",
    "app/guides/route.ts",
    "app/resources/page.tsx",
    "app/resources/route.ts",
    "app/case-studies/page.tsx",
    "app/case-studies/route.ts",
    "app/testimonials/page.tsx",
    "app/testimonials/route.ts",
    "app/webinar/page.tsx",
    "app/webinar/route.ts",
    "app/events/page.tsx",
    "app/events/route.ts",
    "public/guides",
    "public/guides.html",
    "public/resources",
    "public/resources.html",
    "public/case-studies",
    "public/case-studies.html",
    "public/testimonials",
    "public/testimonials.html",
    "public/webinar",
    "public/webinar.html",
    "public/events",
    "public/events.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
