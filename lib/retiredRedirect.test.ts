import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { retiredRedirects } from "./retiredRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("retired aliases permanently move to account, jobs, pricing, or home", () => {
  assert.deepEqual(retiredRedirects(), [
    {
      source: "/settings",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/profile",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/me",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/account/settings",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/settings/profile",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/dashboard",
      destination: "/jobs",
      permanent: true,
    },
    {
      source: "/projects",
      destination: "/jobs",
      permanent: true,
    },
    {
      source: "/project",
      destination: "/jobs",
      permanent: true,
    },
    {
      source: "/app",
      destination: "/jobs",
      permanent: true,
    },
    {
      source: "/plans",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/forgot-password",
      destination: "/",
      permanent: true,
    },
    {
      source: "/reset-password",
      destination: "/",
      permanent: true,
    },
    {
      source: "/about",
      destination: "/",
      permanent: true,
    },
    {
      source: "/home",
      destination: "/",
      permanent: true,
    },
    {
      source: "/index.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/forgot",
      destination: "/",
      permanent: true,
    },
    {
      source: "/password-reset",
      destination: "/",
      permanent: true,
    },
    {
      source: "/reset",
      destination: "/",
      permanent: true,
    },
    {
      source: "/about-us",
      destination: "/",
      permanent: true,
    },
  ]);
  for (const redirect of retiredRedirects()) {
    assert.equal(redirect.permanent, true);
  }

  const bySource = new Map(retiredRedirects().map((redirect) => [redirect.source, redirect.destination]));
  assert.equal(bySource.get("/forgot"), bySource.get("/forgot-password"));
  assert.equal(bySource.get("/password-reset"), bySource.get("/forgot-password"));
  assert.equal(bySource.get("/reset"), bySource.get("/forgot-password"));
  assert.equal(bySource.get("/about-us"), bySource.get("/about"));
  const sources = new Set(retiredRedirects().map((redirect) => redirect.source));
  for (const redirect of retiredRedirects()) {
    assert.equal(sources.has(redirect.destination), false, redirect.source);
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.retiredRedirects\(\)/);
  assert.doesNotMatch(
    config,
    /\/settings|\/dashboard|\/forgot-password|\/reset-password|\/about|\/account|\/jobs|\/home|\/index\.html|\/profile|\/plans|\/pricing|\/projects|\/project|\/forgot|\/password-reset|\/reset|\/about-us|\/me|\/app/,
  );

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(
    proxy,
    /\/settings|\/dashboard|\/forgot-password|\/reset-password|\/about|\/home|\/index\.html|\/profile|\/plans|\/projects|\/forgot|\/password-reset|\/about-us/,
  );
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/"));
  assert.ok(PUBLIC_PAGE_PATHS.includes("/pricing"));
  assert.equal(existsSync(new URL("../app/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/account/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/jobs/page.tsx", import.meta.url)), true);
  const pricing = readRepo("app/pricing/page.tsx");
  assert.match(pricing, /publicPageMetadata\("\/pricing"\)/);
  for (const page of [
    "app/settings/page.tsx",
    "app/settings/route.ts",
    "app/dashboard/page.tsx",
    "app/dashboard/route.ts",
    "app/forgot-password/page.tsx",
    "app/forgot-password/route.ts",
    "app/reset-password/page.tsx",
    "app/reset-password/route.ts",
    "app/about/page.tsx",
    "app/about/route.ts",
    "app/home/page.tsx",
    "app/home/route.ts",
    "app/index.html",
    "public/index.html",
    "app/profile/page.tsx",
    "app/profile/route.ts",
    "app/me/page.tsx",
    "app/me/route.ts",
    "app/account/settings/page.tsx",
    "app/account/settings/route.ts",
    "app/settings/profile/page.tsx",
    "app/settings/profile/route.ts",
    "app/projects/page.tsx",
    "app/projects/route.ts",
    "app/project/page.tsx",
    "app/project/route.ts",
    "app/app/page.tsx",
    "app/app/route.ts",
    "app/plans/page.tsx",
    "app/plans/route.ts",
    "app/forgot/page.tsx",
    "app/forgot/route.ts",
    "app/password-reset/page.tsx",
    "app/password-reset/route.ts",
    "app/reset/page.tsx",
    "app/reset/route.ts",
    "app/about-us/page.tsx",
    "app/about-us/route.ts",
    "public/profile",
    "public/profile.html",
    "public/me",
    "public/me.html",
    "public/projects",
    "public/projects.html",
    "public/project",
    "public/project.html",
    "public/app",
    "public/app.html",
    "public/plans",
    "public/plans.html",
    "public/forgot",
    "public/forgot.html",
    "public/password-reset",
    "public/password-reset.html",
    "public/reset",
    "public/reset.html",
    "public/about-us",
    "public/about-us.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
