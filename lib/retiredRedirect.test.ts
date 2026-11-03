import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contactRedirects } from "./contactRedirect.ts";
import { signInAliasDestination, signInAliasRedirects } from "./fieldNotFound.ts";
import { legalRedirects } from "./legalRedirect.ts";
import { retiredRedirects } from "./retiredRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("retired aliases permanently move to account, jobs, pricing, home, security.txt, or the web manifest, including /integrations, /procore, /careers, /team, /partners, and /customers", () => {
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
      source: "/features",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/integrations",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/procore",
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
    {
      source: "/careers",
      destination: "/",
      permanent: true,
    },
    {
      source: "/team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/partners",
      destination: "/",
      permanent: true,
    },
    {
      source: "/customers",
      destination: "/",
      permanent: true,
    },
    {
      source: "/security.txt",
      destination: "/.well-known/security.txt",
      permanent: true,
    },
    {
      source: "/manifest.json",
      destination: "/manifest.webmanifest",
      permanent: true,
    },
    {
      source: "/site.webmanifest",
      destination: "/manifest.webmanifest",
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
  assert.equal(bySource.get("/features"), "/pricing");
  assert.equal(bySource.get("/features"), bySource.get("/plans"));
  assert.equal(bySource.get("/integrations"), "/pricing");
  assert.equal(bySource.get("/integrations"), bySource.get("/plans"));
  assert.equal(bySource.get("/procore"), "/pricing");
  assert.equal(bySource.get("/procore"), bySource.get("/plans"));
  assert.equal(bySource.get("/careers"), "/");
  assert.equal(bySource.get("/careers"), bySource.get("/about"));
  assert.equal(bySource.get("/team"), bySource.get("/about"));
  assert.equal(bySource.get("/partners"), bySource.get("/about"));
  assert.equal(bySource.get("/customers"), bySource.get("/about"));
  assert.equal(bySource.has("/api/procore"), false);
  assert.equal(bySource.has("/api/procore/status"), false);
  assert.equal(bySource.has("/api/procore/connect"), false);
  assert.equal(bySource.has("/api/procore/callback"), false);
  assert.equal(bySource.has("/api/procore/disconnect"), false);
  assert.equal(bySource.has("/api/procore/projects"), false);
  assert.equal(bySource.has("/procore/status"), false);
  assert.equal(bySource.has("/procore/connect"), false);
  assert.equal(bySource.get("/security.txt"), "/.well-known/security.txt");
  assert.equal(bySource.get("/manifest.json"), "/manifest.webmanifest");
  assert.equal(bySource.get("/site.webmanifest"), bySource.get("/manifest.json"));
  const sources = new Set(retiredRedirects().map((redirect) => redirect.source));
  for (const redirect of retiredRedirects()) {
    assert.equal(sources.has(redirect.destination), false, redirect.source);
    assert.doesNotMatch(redirect.source, /[:*]/, redirect.source);
    assert.equal(redirect.source.endsWith("/"), false, redirect.source);
    assert.equal(redirect.source.startsWith("/api"), false, redirect.source);
  }
  for (const source of ["/careers", "/team", "/partners", "/customers", "/integrations", "/procore"]) {
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  for (const path of [
    "/admin",
    "/api",
    "/humans.txt",
    "/zz-nope",
    "/api/procore",
    "/api/procore/status",
    "/api/procore/connect",
    "/api/procore/callback",
    "/api/procore/disconnect",
    "/api/procore/projects",
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
    "/api/docs",
    "/.well-known/apple-app-site-association",
  ]) {
    assert.equal(sources.has(path), false, path);
  }

  const everyRedirect = [
    ...contactRedirects(),
    ...legalRedirects(),
    ...retiredRedirects(),
    ...signInAliasRedirects(),
    { source: "/demo", destination: "/pack/maple-point", permanent: false },
  ];
  const everySource = new Set(everyRedirect.map((redirect) => redirect.source));
  for (const redirect of everyRedirect) {
    assert.equal(everySource.has(redirect.destination), false, redirect.source);
    assert.equal(redirect.source.startsWith("/api"), false, redirect.source);
  }
  for (const redirect of [...contactRedirects(), ...legalRedirects(), ...retiredRedirects()]) {
    assert.doesNotMatch(redirect.source, /[:*]/, redirect.source);
  }
  assert.equal(everySource.has("/legal/privacy"), true);
  assert.equal(everySource.has("/legal/terms"), true);
  assert.equal(everySource.has("/legal/:path*"), false);
  assert.equal(everySource.has("/legal/:slug"), false);
  const stay404 = [
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
    "/api/docs",
    "/.well-known/apple-app-site-association",
    "/zz-nope",
  ];
  for (const path of stay404) {
    assert.equal(everySource.has(path), false, path);
    assert.equal(signInAliasDestination(path), null, path);
  }
  assert.equal(signInAliasDestination("/api/docs/extra"), null);
  assert.equal(existsSync(new URL("../app/invite/[token]/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/[...slug]/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/stripe/checkout/route.ts", import.meta.url)), true);
  for (const page of [
    "app/rfi/page.tsx",
    "app/rfi/route.ts",
    "app/rfis/page.tsx",
    "app/rfis/route.ts",
    "app/submittals/page.tsx",
    "app/submittals/route.ts",
    "app/punch/page.tsx",
    "app/punch/route.ts",
    "app/daily-log/page.tsx",
    "app/daily-log/route.ts",
    "app/reports/page.tsx",
    "app/reports/route.ts",
    "app/photos/page.tsx",
    "app/photos/route.ts",
    "app/drawings/page.tsx",
    "app/drawings/route.ts",
    "app/schedule/page.tsx",
    "app/schedule/route.ts",
    "app/calendar/page.tsx",
    "app/calendar/route.ts",
    "app/invite/page.tsx",
    "app/invite/route.ts",
    "app/notifications/page.tsx",
    "app/notifications/route.ts",
    "app/billing/page.tsx",
    "app/billing/route.ts",
    "app/subscribe/page.tsx",
    "app/subscribe/route.ts",
    "app/upgrade/page.tsx",
    "app/upgrade/route.ts",
    "app/checkout/page.tsx",
    "app/checkout/route.ts",
    "app/api/docs/page.tsx",
    "app/api/docs/route.ts",
    "app/.well-known/apple-app-site-association/route.ts",
    "app/.well-known/apple-app-site-association/page.tsx",
    "public/.well-known/apple-app-site-association",
    "public/apple-app-site-association",
    "public/zz-nope",
    "public/zz-nope.html",
    "app/zz-nope/page.tsx",
    "app/zz-nope/route.ts",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
  assert.equal(everySource.has("/legal"), true);
  assert.equal(
    legalRedirects().find((redirect) => redirect.source === "/legal")?.destination,
    "/terms",
  );
  assert.equal(
    legalRedirects().find((redirect) => redirect.source === "/legal")?.permanent,
    true,
  );
  for (const redirect of contactRedirects()) {
    assert.equal(sources.has(redirect.source), false, redirect.source);
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.retiredRedirects\(\)/);
  assert.doesNotMatch(
    config,
    /\/settings|\/dashboard|\/forgot-password|\/reset-password|\/about|\/account|\/jobs|\/home|\/index\.html|\/profile|\/plans|\/pricing|\/projects|\/project|\/forgot|\/password-reset|\/reset|\/about-us|\/me|\/app|\/features|\/integrations|\/procore|\/careers|\/team|\/partners|\/customers|\/security\.txt|\/manifest\.json|\/site\.webmanifest|\/manifest\.webmanifest|\.well-known\/security\.txt/,
  );

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(
    proxy,
    /\/settings|\/dashboard|\/forgot-password|\/reset-password|\/about|\/home|\/index\.html|\/profile|\/plans|\/projects|\/forgot|\/password-reset|\/about-us|\/features|\/integrations|\/procore|\/careers|\/team|\/partners|\/customers|\/security\.txt|\/manifest\.json|\/site\.webmanifest|\/manifest\.webmanifest|\.well-known\/security\.txt/,
  );
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/"));
  assert.ok(PUBLIC_PAGE_PATHS.includes("/pricing"));
  assert.equal(existsSync(new URL("../app/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/account/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/jobs/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/procore/status/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/procore/connect/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/procore/callback/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/procore/disconnect/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/api/procore/projects/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/.well-known/security.txt/route.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/manifest.ts", import.meta.url)), true);
  assert.match(readRepo("app/.well-known/security.txt/route.ts"), /status:\s*200/);
  assert.match(readRepo("app/manifest.ts"), /webManifest/);
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
    "app/features/page.tsx",
    "app/features/route.ts",
    "app/security.txt/page.tsx",
    "app/security.txt/route.ts",
    "app/manifest.json/page.tsx",
    "app/manifest.json/route.ts",
    "app/site.webmanifest/page.tsx",
    "app/site.webmanifest/route.ts",
    "app/integrations/page.tsx",
    "app/integrations/route.ts",
    "app/procore/page.tsx",
    "app/procore/route.ts",
    "app/careers/page.tsx",
    "app/careers/route.ts",
    "app/team/page.tsx",
    "app/team/route.ts",
    "app/partners/page.tsx",
    "app/partners/route.ts",
    "app/customers/page.tsx",
    "app/customers/route.ts",
    "public/features",
    "public/features.html",
    "public/integrations",
    "public/integrations.html",
    "public/procore",
    "public/procore.html",
    "public/careers",
    "public/careers.html",
    "public/team",
    "public/team.html",
    "public/partners",
    "public/partners.html",
    "public/customers",
    "public/customers.html",
    "public/security.txt",
    "public/manifest.json",
    "public/site.webmanifest",
    "public/manifest.webmanifest",
    "public/.well-known/security.txt",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
