import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contactRedirects } from "./contactRedirect.ts";
import {
  demoAliasDestination,
  demoAliasRedirects,
  signInAliasDestination,
  signInAliasRedirects,
} from "./fieldNotFound.ts";
import { legalRedirects } from "./legalRedirect.ts";
import { retiredRedirects } from "./retiredRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("retired aliases permanently move to account, jobs, pricing, home, security.txt, the web manifest, or /sitemap.xml (308), including /integrations, /procore, /careers, /team, /partners, /customers, /company, /product, /sitemap, /site-map, /pricing-plans, /team-plans, /enterprise-plan, /quote, /get-quote, /estimate, /investors, /jobs-board, /hiring, /about-gc-field-log, /our-story, /mission, /values, /leadership, /founders, /aboutus, /company-info, /who-we-are, /our-team, /meet-the-team, /our-company, /plans-pricing, /cost, /costs, /procore-integration, and /contact/sales", () => {
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
      source: "/account-settings",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/team-members",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/my-account",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/your-account",
      destination: "/account",
      permanent: true,
    },

    {
      source: "/account-page",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/my-profile",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/user-profile",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/manage-account",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/account.html",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/profile.html",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/settings.html",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/myaccount",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/user-account",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/account/profile",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/acount",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/my_account",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/setings",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/my-account.html",
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
      source: "/product",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/products",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/solutions",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/use-cases",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/why",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/compare",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/alternatives",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricing-plans",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/team-plans",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/enterprise-plan",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/quote",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/get-quote",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/estimate",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/plans-pricing",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/cost",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/costs",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/procore-integration",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/contact/sales",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/price",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/prices",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/rates",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/packages",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/business",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pro",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/product-tour",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/walkthrough",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/product-overview",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/overview",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/integrations-list",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/apps-marketplace",
      destination: "/pricing",
      permanent: true,
    },

    {
      source: "/request-pricing",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricing-page",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/compare-plans",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/enterprise-pricing",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/plan-comparison",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricing-overview",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/plans-and-pricing",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricing-and-plans",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/get-a-quote",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricelist",
      destination: "/pricing",
      permanent: true,
    },

    {
      source: "/price-list",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/our-plans",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/plans-page",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricing.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/plans.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/price.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricings",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/prcing",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/our-pricing",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/features.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/integrations.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/product.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/solutions.html",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/feautures",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/pricng",
      destination: "/pricing",
      permanent: true,
    },
    {
      source: "/priceing",
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
      source: "/company",
      destination: "/",
      permanent: true,
    },
    {
      source: "/investors",
      destination: "/",
      permanent: true,
    },
    {
      source: "/jobs-board",
      destination: "/",
      permanent: true,
    },
    {
      source: "/hiring",
      destination: "/",
      permanent: true,
    },
    {
      source: "/about-gc-field-log",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-story",
      destination: "/",
      permanent: true,
    },
    {
      source: "/mission",
      destination: "/",
      permanent: true,
    },
    {
      source: "/values",
      destination: "/",
      permanent: true,
    },
    {
      source: "/leadership",
      destination: "/",
      permanent: true,
    },
    {
      source: "/founders",
      destination: "/",
      permanent: true,
    },
    {
      source: "/aboutus",
      destination: "/",
      permanent: true,
    },
    {
      source: "/company-info",
      destination: "/",
      permanent: true,
    },
    {
      source: "/who-we-are",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/meet-the-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-company",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-mission",
      destination: "/",
      permanent: true,
    },
    {
      source: "/vision",
      destination: "/",
      permanent: true,
    },
    {
      source: "/culture",
      destination: "/",
      permanent: true,
    },
    {
      source: "/leadership-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/about-company",
      destination: "/",
      permanent: true,
    },
    {
      source: "/partners-program",
      destination: "/",
      permanent: true,
    },
    {
      source: "/affiliate",
      destination: "/",
      permanent: true,
    },
    {
      source: "/resellers",
      destination: "/",
      permanent: true,
    },
    {
      source: "/home-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/landing",
      destination: "/",
      permanent: true,
    },
    {
      source: "/landing-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/welcome-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/front",
      destination: "/",
      permanent: true,
    },

    {
      source: "/about-us-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/company-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/careers-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/jobs-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/join-our-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/we-are-hiring",
      destination: "/",
      permanent: true,
    },
    {
      source: "/open-roles",
      destination: "/",
      permanent: true,
    },
    {
      source: "/work-with-us",
      destination: "/",
      permanent: true,
    },
    {
      source: "/homepage",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-values",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-vision",
      destination: "/",
      permanent: true,
    },
    {
      source: "/meet-our-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/now-hiring",
      destination: "/",
      permanent: true,
    },

    {
      source: "/about-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/the-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/our-founders",
      destination: "/",
      permanent: true,
    },
    {
      source: "/join-the-team",
      destination: "/",
      permanent: true,
    },
    {
      source: "/front-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/the-company",
      destination: "/",
      permanent: true,
    },
    {
      source: "/mission-page",
      destination: "/",
      permanent: true,
    },
    {
      source: "/about.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/about-us.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/company.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/home.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/default.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/whoweare",
      destination: "/",
      permanent: true,
    },
    {
      source: "/career",
      destination: "/",
      permanent: true,
    },
    {
      source: "/careers.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/aboutus.html",
      destination: "/",
      permanent: true,
    },
    {
      source: "/compnay",
      destination: "/",
      permanent: true,
    },
    {
      source: "/index.htm",
      destination: "/",
      permanent: true,
    },
    {
      source: "/ourstory",
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
    {
      source: "/sitemap",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/site-map",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap-xml",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/xml-sitemap",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/map",
      destination: "/sitemap.xml",
      permanent: true,
    },

    {
      source: "/html-sitemap",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/xml-map",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap-html",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/site_map",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap-index",
      destination: "/sitemap.xml",
      permanent: true,
    },

    {
      source: "/sitemaps",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap.txt",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap-index.xml",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap.html",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/site-map.html",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/site-map.xml",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap_index.xml",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap.xml.gz",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/google-sitemap",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemap.htm",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/sitemapxml",
      destination: "/sitemap.xml",
      permanent: true,
    },
    {
      source: "/site_map.html",
      destination: "/sitemap.xml",
      permanent: true,
    },
  ]);
  for (const redirect of retiredRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.equal(redirect.permanent ? 308 : 307, 308);
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
  assert.equal(bySource.get("/company"), "/");
  assert.equal(bySource.get("/company"), bySource.get("/about"));
  assert.equal(bySource.get("/product"), "/pricing");
  assert.equal(bySource.get("/products"), "/pricing");
  assert.equal(bySource.get("/solutions"), "/pricing");
  assert.equal(bySource.get("/use-cases"), "/pricing");
  assert.equal(bySource.get("/why"), "/pricing");
  assert.equal(bySource.get("/compare"), "/pricing");
  assert.equal(bySource.get("/alternatives"), "/pricing");
  assert.equal(bySource.get("/product"), bySource.get("/plans"));
  assert.equal(bySource.get("/products"), bySource.get("/plans"));
  assert.equal(bySource.get("/solutions"), bySource.get("/plans"));
  assert.equal(bySource.get("/use-cases"), bySource.get("/plans"));
  assert.equal(bySource.get("/why"), bySource.get("/plans"));
  assert.equal(bySource.get("/compare"), bySource.get("/plans"));
  assert.equal(bySource.get("/alternatives"), bySource.get("/plans"));
  for (const source of [
    "/pricing-plans",
    "/team-plans",
    "/enterprise-plan",
    "/quote",
    "/get-quote",
    "/estimate",
    "/plans-pricing",
    "/cost",
    "/costs",
    "/procore-integration",
    "/contact/sales",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/pricing", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/pricing", source);
    assert.equal(bySource.get(source), bySource.get("/plans"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
  }
  for (const source of [
    "/investors",
    "/jobs-board",
    "/hiring",
    "/about-gc-field-log",
    "/our-story",
    "/mission",
    "/values",
    "/leadership",
    "/founders",
    "/aboutus",
    "/company-info",
    "/who-we-are",
    "/our-team",
    "/meet-the-team",
    "/our-company",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/", source);
    assert.equal(bySource.get(source), bySource.get("/about"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
  }
  assert.equal(bySource.get("/pricing-plans"), "/pricing");
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/team-plans"), "/pricing");
  assert.equal(bySource.get("/team"), "/");
  assert.equal(bySource.get("/enterprise-plan"), "/pricing");
  assert.equal(bySource.has("/enterprise"), false);
  assert.equal(bySource.get("/jobs-board"), "/");
  assert.equal(bySource.has("/jobs"), false);
  assert.equal(bySource.get("/about-gc-field-log"), "/");
  assert.equal(bySource.get("/about-gc-field-log"), bySource.get("/about"));
  assert.equal(bySource.has("/about/gc-field-log"), false);
  assert.equal(bySource.has("/about-gc-field-log/extra"), false);
  assert.equal(bySource.get("/plans-pricing"), "/pricing");
  assert.equal(bySource.get("/plans-pricing"), bySource.get("/pricing-plans"));
  assert.equal(bySource.get("/plans-pricing"), bySource.get("/plans"));
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.has("/plans"), true);
  assert.equal(bySource.get("/cost"), "/pricing");
  assert.equal(bySource.get("/costs"), "/pricing");
  assert.equal(bySource.get("/cost"), bySource.get("/costs"));
  assert.equal(bySource.has("/cost/extra"), false);
  assert.equal(bySource.has("/costs/extra"), false);
  assert.equal(bySource.has("/cost/s"), false);
  assert.equal(bySource.get("/procore-integration"), bySource.get("/procore"));
  assert.equal(bySource.get("/procore-integration"), bySource.get("/integrations"));
  assert.equal(bySource.has("/procore/extra"), false);
  assert.equal(bySource.has("/procore-integration/extra"), false);
  assert.equal(bySource.get("/contact/sales"), "/pricing");
  assert.equal(bySource.has("/contact/sales/extra"), false);
  assert.equal(bySource.has("/contact"), false);
  assert.equal(bySource.has("/sales"), false);
  assert.equal(bySource.has("/contact-sales"), false);
  assert.equal(bySource.get("/aboutus"), bySource.get("/about"));
  assert.equal(bySource.get("/aboutus"), bySource.get("/about-us"));
  assert.equal(bySource.has("/about"), true);
  assert.equal(bySource.has("/about-us"), true);
  assert.equal(bySource.get("/company-info"), bySource.get("/company"));
  assert.equal(bySource.get("/our-company"), bySource.get("/company"));
  assert.equal(bySource.get("/our-team"), bySource.get("/team"));
  assert.equal(bySource.get("/meet-the-team"), bySource.get("/team"));
  assert.equal(bySource.get("/who-we-are"), bySource.get("/about"));
  assert.equal(bySource.has("/aboutus/extra"), false);
  assert.equal(bySource.has("/our-team/extra"), false);
  assert.equal(bySource.has("/meet-the-team/extra"), false);
  assert.equal(bySource.has("/product/extra"), false);
  assert.equal(bySource.has("/products/extra"), false);
  assert.equal(bySource.has("/company/extra"), false);
  assert.equal(bySource.get("/sitemap"), "/sitemap.xml");
  assert.equal(bySource.get("/site-map"), "/sitemap.xml");
  assert.equal(bySource.get("/site-map"), bySource.get("/sitemap"));
  assert.equal(bySource.has("/sitemap.xml"), false);
  for (const source of [
    "/price",
    "/prices",
    "/rates",
    "/packages",
    "/business",
    "/pro",
    "/product-tour",
    "/walkthrough",
    "/product-overview",
    "/overview",
    "/integrations-list",
    "/apps-marketplace",
    "/request-pricing",
    "/pricing-page",
    "/compare-plans",
    "/enterprise-pricing",
    "/plan-comparison",
    "/pricing-overview"
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/pricing", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/pricing", source);
    assert.equal(bySource.get(source), bySource.get("/plans"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  for (const source of [
    "/our-mission",
    "/vision",
    "/culture",
    "/leadership-team",
    "/about-company",
    "/partners-program",
    "/affiliate",
    "/resellers",
    "/home-page",
    "/landing",
    "/landing-page",
    "/welcome-page",
    "/front",
    "/about-us-page",
    "/company-page",
    "/careers-page",
    "/jobs-page",
    "/join-our-team",
    "/we-are-hiring",
    "/open-roles",
    "/work-with-us"
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/", source);
    assert.equal(bySource.get(source), bySource.get("/about"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  for (const source of ["/sitemap-xml", "/xml-sitemap", "/map", "/html-sitemap", "/xml-map", "/sitemap-html"]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/sitemap.xml", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/sitemap.xml", source);
    assert.equal(bySource.get(source), bySource.get("/sitemap"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/price"), bySource.get("/prices"));
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/pro"), bySource.get("/procore"));
  assert.equal(bySource.has("/procore"), true);
  assert.equal(bySource.get("/product-tour"), bySource.get("/product"));
  assert.equal(bySource.get("/product-overview"), bySource.get("/product"));
  assert.equal(bySource.get("/overview"), bySource.get("/product-overview"));
  assert.equal(bySource.has("/product"), true);
  assert.equal(bySource.get("/integrations-list"), bySource.get("/integrations"));
  assert.equal(bySource.has("/enterprise"), false);
  assert.equal(bySource.get("/business"), "/pricing");
  assert.equal(bySource.get("/our-mission"), bySource.get("/mission"));
  assert.equal(bySource.get("/leadership-team"), bySource.get("/leadership"));
  assert.equal(bySource.get("/about-company"), bySource.get("/about"));
  assert.equal(bySource.get("/partners-program"), bySource.get("/partners"));
  assert.equal(bySource.get("/affiliate"), "/");
  assert.equal(bySource.has("/affiliates"), false);
  assert.equal(bySource.get("/home-page"), bySource.get("/home"));
  assert.equal(bySource.get("/landing-page"), bySource.get("/landing"));
  assert.equal(bySource.get("/welcome-page"), "/");
  assert.equal(signInAliasDestination("/welcome-page"), null);
  assert.equal(signInAliasDestination("/welcome"), "/");
  assert.equal(bySource.has("/schedule"), false);
  assert.equal(demoAliasDestination("/schedule"), "/pack/maple-point");
  assert.notEqual(demoAliasDestination("/schedule"), "/demo");
  assert.equal(signInAliasDestination("/schedule"), null);
  assert.equal(bySource.get("/sitemap-xml"), "/sitemap.xml");
  assert.equal(bySource.has("/sitemap.xml"), false);
  assert.equal(bySource.get("/html-sitemap"), bySource.get("/sitemap"));
  assert.equal(bySource.get("/sitemap-html"), bySource.get("/sitemap"));
  assert.equal(bySource.get("/xml-map"), bySource.get("/map"));
  assert.equal(bySource.has("/xml-sitemap"), true);
  assert.equal(bySource.get("/about-us-page"), bySource.get("/about-us"));
  assert.equal(bySource.has("/about-us"), true);
  assert.equal(bySource.get("/company-page"), bySource.get("/company"));
  assert.equal(bySource.get("/careers-page"), bySource.get("/careers"));
  assert.equal(bySource.get("/jobs-page"), "/");
  assert.equal(bySource.has("/jobs"), false);
  assert.equal(bySource.has("/jobs-board"), true);
  assert.equal(bySource.get("/join-our-team"), "/");
  assert.equal(signInAliasDestination("/join-our-team"), null);
  assert.equal(signInAliasDestination("/join"), "/");
  assert.equal(bySource.get("/we-are-hiring"), bySource.get("/hiring"));
  assert.equal(bySource.get("/open-roles"), bySource.get("/careers"));
  assert.equal(bySource.get("/work-with-us"), "/");
  assert.equal(bySource.get("/request-pricing"), bySource.get("/pricing-plans"));
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/pricing-page"), bySource.get("/plans"));
  assert.equal(bySource.get("/compare-plans"), bySource.get("/compare"));
  assert.equal(bySource.has("/compare"), true);
  assert.equal(bySource.get("/enterprise-pricing"), bySource.get("/enterprise-plan"));
  assert.equal(bySource.has("/enterprise"), false);
  assert.equal(bySource.get("/plan-comparison"), "/pricing");
  assert.equal(bySource.get("/pricing-overview"), bySource.get("/overview"));
  assert.equal(bySource.get("/map"), bySource.get("/sitemap"));
  assert.equal(bySource.has("/sitemap/extra"), false);
  assert.equal(bySource.has("/site-map/extra"), false);
  for (const source of ["/my-account", "/your-account"]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/account", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/account", source);
    assert.equal(bySource.get(source), bySource.get("/settings"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/account"), false);
  assert.equal(bySource.get("/my-account"), bySource.get("/profile"));
  assert.equal(bySource.get("/your-account"), bySource.get("/me"));
  for (const source of ["/plans-and-pricing", "/pricing-and-plans", "/get-a-quote", "/pricelist"]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/pricing", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/pricing", source);
    assert.equal(bySource.get(source), bySource.get("/plans"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(demoAliasDestination(source), null, source);
    assert.equal(signInAliasDestination(source), null, source);
  }
  assert.equal(bySource.get("/plans-and-pricing"), bySource.get("/plans-pricing"));
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/pricing-and-plans"), bySource.get("/pricing-plans"));
  assert.equal(bySource.get("/get-a-quote"), bySource.get("/get-quote"));
  assert.equal(bySource.has("/get-quote"), true);
  assert.equal(bySource.has("/quote"), true);
  assert.equal(demoAliasDestination("/request-quote"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/get-a-quote"), null);
  assert.equal(bySource.get("/pricelist"), bySource.get("/prices"));
  for (const source of ["/homepage", "/our-values", "/our-vision", "/meet-our-team", "/now-hiring"]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/", source);
    assert.equal(bySource.get(source), bySource.get("/about"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/homepage"), bySource.get("/home-page"));
  assert.equal(bySource.has("/home"), true);
  assert.equal(bySource.get("/our-values"), bySource.get("/values"));
  assert.equal(bySource.get("/our-vision"), bySource.get("/vision"));
  assert.equal(bySource.get("/meet-our-team"), bySource.get("/meet-the-team"));
  assert.equal(bySource.has("/our-team"), true);
  assert.equal(bySource.get("/now-hiring"), bySource.get("/hiring"));
  assert.equal(bySource.has("/we-are-hiring"), true);
  for (const source of ["/site_map", "/sitemap-index"]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/sitemap.xml", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/sitemap.xml", source);
    assert.equal(bySource.get(source), bySource.get("/sitemap"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/site_map"), bySource.get("/site-map"));
  assert.equal(bySource.has("/site-map"), true);
  assert.equal(bySource.get("/sitemap-index"), bySource.get("/sitemap"));
  assert.equal(bySource.has("/sitemap.xml"), false);
  assert.equal(bySource.has("/sitemap-index/extra"), false);

  for (const source of [
    "/about-page",
    "/the-team",
    "/our-founders",
    "/join-the-team",
    "/front-page",
    "/the-company",
    "/mission-page"
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/", source);
    assert.equal(bySource.get(source), bySource.get("/about"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.get("/about-page"), bySource.get("/about-us-page"));
  assert.equal(bySource.has("/about"), true);
  assert.equal(bySource.get("/the-team"), bySource.get("/team"));
  assert.equal(bySource.has("/our-team"), true);
  assert.equal(bySource.get("/our-founders"), bySource.get("/founders"));
  assert.equal(bySource.get("/join-the-team"), bySource.get("/join-our-team"));
  assert.equal(signInAliasDestination("/join-the-team"), null);
  assert.equal(signInAliasDestination("/join"), "/");
  assert.equal(bySource.get("/front-page"), bySource.get("/front"));
  assert.equal(bySource.has("/home-page"), true);
  assert.equal(bySource.get("/the-company"), bySource.get("/company"));
  assert.equal(bySource.get("/mission-page"), bySource.get("/mission"));
  for (const source of [
    "/price-list",
    "/our-plans",
    "/plans-page"
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/pricing", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/pricing", source);
    assert.equal(bySource.get(source), bySource.get("/plans"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(demoAliasDestination(source), null, source);
    assert.equal(signInAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/price-list"), bySource.get("/pricelist"));
  assert.equal(bySource.has("/price"), true);
  assert.equal(bySource.get("/our-plans"), bySource.get("/plans"));
  assert.equal(bySource.get("/plans-page"), bySource.get("/pricing-page"));
  for (const source of [
    "/account-page",
    "/my-profile",
    "/user-profile",
    "/manage-account"
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/account", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/account", source);
    assert.equal(bySource.get(source), bySource.get("/settings"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/account"), false);
  assert.equal(bySource.get("/account-page"), bySource.get("/my-account"));
  assert.equal(bySource.get("/my-profile"), bySource.get("/profile"));
  assert.equal(bySource.get("/user-profile"), bySource.get("/profile"));
  assert.equal(bySource.get("/manage-account"), bySource.get("/account-settings"));
  for (const source of [
    "/sitemaps",
    "/sitemap.txt",
    "/sitemap-index.xml"
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/sitemap.xml", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/sitemap.xml", source);
    assert.equal(bySource.get(source), bySource.get("/sitemap"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.has("/sitemap.xml"), false);
  assert.equal(bySource.get("/sitemaps"), bySource.get("/sitemap"));
  assert.equal(bySource.get("/sitemap.txt"), bySource.get("/sitemap"));
  assert.equal(bySource.get("/sitemap-index.xml"), bySource.get("/sitemap-index"));
  assert.equal(bySource.has("/sitemap-index"), true);
  assert.equal(bySource.has("/sitemaps/extra"), false);
  assert.equal(bySource.has("/sitemap-index.xml/extra"), false);
  for (const source of [
    "/about.html",
    "/about-us.html",
    "/company.html",
    "/home.html",
    "/default.html",
    "/whoweare",
    "/career",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/", source);
    assert.equal(bySource.get(source), bySource.get("/about"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.get("/about.html"), bySource.get("/about"));
  assert.equal(bySource.has("/about"), true);
  assert.equal(bySource.get("/about-us.html"), bySource.get("/about-us"));
  assert.equal(bySource.get("/company.html"), bySource.get("/company"));
  assert.equal(bySource.get("/home.html"), bySource.get("/home"));
  assert.equal(bySource.has("/index.html"), true);
  assert.equal(bySource.get("/whoweare"), bySource.get("/who-we-are"));
  assert.equal(bySource.get("/career"), bySource.get("/careers"));
  assert.equal(bySource.has("/careers"), true);
  for (const source of [
    "/pricing.html",
    "/plans.html",
    "/price.html",
    "/pricings",
    "/prcing",
    "/our-pricing",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/pricing", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/pricing", source);
    assert.equal(bySource.get(source), bySource.get("/plans"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/pricing.html"), bySource.get("/plans"));
  assert.equal(bySource.get("/plans.html"), bySource.get("/plans"));
  assert.equal(bySource.get("/price.html"), bySource.get("/price"));
  assert.equal(bySource.has("/prices"), true);
  assert.equal(bySource.get("/pricings"), bySource.get("/prices"));
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/our-pricing"), bySource.get("/pricing-page"));
  for (const source of [
    "/account.html",
    "/profile.html",
    "/settings.html",
    "/myaccount",
    "/user-account",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/account", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/account", source);
    assert.equal(bySource.get(source), bySource.get("/settings"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/account"), false);
  assert.equal(bySource.get("/account.html"), bySource.get("/my-account"));
  assert.equal(bySource.get("/profile.html"), bySource.get("/profile"));
  assert.equal(bySource.get("/settings.html"), bySource.get("/settings"));
  assert.equal(bySource.get("/myaccount"), bySource.get("/my-account"));
  assert.equal(bySource.get("/user-account"), bySource.get("/account-page"));
  assert.equal(bySource.get("/account/profile"), "/account");
  assert.equal(bySource.get("/account/settings"), "/account");
  assert.equal(bySource.has("/account/profile/extra"), false);
  assert.equal(bySource.has("/profile"), true);
  assert.equal(signInAliasDestination("/account/profile"), null);
  assert.equal(demoAliasDestination("/account/profile"), null);
  for (const source of [
    "/sitemap.html",
    "/site-map.html",
    "/site-map.xml",
    "/sitemap_index.xml",
    "/sitemap.xml.gz",
    "/google-sitemap",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/sitemap.xml", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/sitemap.xml", source);
    assert.equal(bySource.get(source), bySource.get("/sitemap"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/sitemap.xml"), false);
  assert.equal(bySource.get("/sitemap.html"), bySource.get("/sitemap"));
  assert.equal(bySource.get("/site-map.html"), bySource.get("/site-map"));
  assert.equal(bySource.get("/site-map.xml"), bySource.get("/site-map"));
  assert.equal(bySource.get("/sitemap_index.xml"), bySource.get("/sitemap-index.xml"));
  assert.equal(bySource.has("/sitemap-index"), true);
  assert.equal(bySource.get("/sitemap.xml.gz"), bySource.get("/sitemap"));
  assert.equal(bySource.get("/google-sitemap"), bySource.get("/sitemap"));
  for (const source of [
    "/features.html",
    "/integrations.html",
    "/product.html",
    "/solutions.html",
    "/feautures",
    "/pricng",
    "/priceing",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/pricing", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/pricing", source);
    assert.equal(bySource.get(source), bySource.get("/plans"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/pricing"), false);
  assert.equal(bySource.get("/features.html"), bySource.get("/features"));
  assert.equal(bySource.has("/features"), true);
  assert.equal(bySource.get("/integrations.html"), bySource.get("/integrations"));
  assert.equal(bySource.get("/product.html"), bySource.get("/product"));
  assert.equal(bySource.has("/products"), true);
  assert.equal(bySource.get("/solutions.html"), bySource.get("/solutions"));
  assert.equal(bySource.get("/feautures"), bySource.get("/features"));
  assert.equal(bySource.get("/pricng"), bySource.get("/prcing"));
  assert.equal(bySource.has("/prcing"), true);
  assert.equal(bySource.get("/priceing"), bySource.get("/plans"));
  assert.equal(bySource.has("/price"), true);
  for (const source of [
    "/careers.html",
    "/aboutus.html",
    "/compnay",
    "/index.htm",
    "/ourstory",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/", source);
    assert.equal(bySource.get(source), bySource.get("/about"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.get("/careers.html"), bySource.get("/careers"));
  assert.equal(bySource.has("/careers"), true);
  assert.equal(bySource.get("/aboutus.html"), bySource.get("/aboutus"));
  assert.equal(bySource.has("/about-us.html"), true);
  assert.equal(bySource.get("/compnay"), bySource.get("/company"));
  assert.equal(bySource.has("/company"), true);
  assert.equal(bySource.get("/index.htm"), bySource.get("/index.html"));
  assert.equal(bySource.has("/index.html"), true);
  assert.equal(bySource.has("/index"), false);
  assert.equal(bySource.get("/ourstory"), bySource.get("/our-story"));
  assert.equal(bySource.has("/our-story"), true);
  for (const source of [
    "/acount",
    "/my_account",
    "/setings",
    "/my-account.html",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/account", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/account", source);
    assert.equal(bySource.get(source), bySource.get("/settings"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/account"), false);
  assert.equal(bySource.get("/acount"), "/account");
  assert.equal(bySource.get("/my_account"), bySource.get("/my-account"));
  assert.equal(bySource.has("/myaccount"), true);
  assert.equal(bySource.get("/setings"), bySource.get("/settings"));
  assert.equal(bySource.has("/settings"), true);
  assert.equal(bySource.get("/my-account.html"), bySource.get("/my-account"));
  assert.equal(bySource.has("/account.html"), true);
  for (const source of [
    "/sitemap.htm",
    "/sitemapxml",
    "/site_map.html",
  ]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/sitemap.xml", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/sitemap.xml", source);
    assert.equal(bySource.get(source), bySource.get("/sitemap"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.has("/sitemap.xml"), false);
  assert.equal(bySource.get("/sitemap.htm"), bySource.get("/sitemap"));
  assert.equal(bySource.has("/sitemap.html"), true);
  assert.equal(bySource.get("/sitemapxml"), bySource.get("/sitemap-xml"));
  assert.equal(bySource.has("/sitemap-xml"), true);
  assert.equal(bySource.get("/site_map.html"), bySource.get("/site_map"));
  assert.equal(bySource.has("/site-map.html"), true);
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
  for (const source of ["/account-settings", "/team-members"]) {
    const redirect = retiredRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/account", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/account", source);
    assert.equal(bySource.get(source), bySource.get("/settings"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
    assert.equal(signInAliasDestination(source), null, source);
    assert.equal(demoAliasDestination(source), null, source);
  }
  assert.equal(bySource.get("/account-settings"), "/account");
  assert.equal(bySource.get("/account/settings"), "/account");
  assert.equal(bySource.has("/account"), false);
  assert.equal(bySource.get("/team-members"), "/account");
  assert.equal(bySource.get("/team"), "/");
  assert.equal(bySource.has("/account-settings/extra"), false);
  assert.equal(bySource.has("/team-members/extra"), false);
  assert.equal(signInAliasDestination("/account-settings"), null);
  assert.equal(signInAliasDestination("/open-account"), "/");
  assert.equal(signInAliasDestination("/team-members"), null);
  const sources = new Set(retiredRedirects().map((redirect) => redirect.source));
  for (const redirect of retiredRedirects()) {
    assert.equal(sources.has(redirect.destination), false, redirect.source);
    assert.doesNotMatch(redirect.source, /[:*]/, redirect.source);
    assert.equal(redirect.source.endsWith("/"), false, redirect.source);
    assert.equal(redirect.source.startsWith("/api"), false, redirect.source);
  }
  for (const source of [
    "/careers",
    "/team",
    "/partners",
    "/customers",
    "/integrations",
    "/procore",
    "/company",
    "/product",
    "/products",
    "/solutions",
    "/use-cases",
    "/why",
    "/compare",
    "/alternatives",
    "/sitemap",
    "/site-map",
    "/pricing-plans",
    "/team-plans",
    "/enterprise-plan",
    "/quote",
    "/get-quote",
    "/estimate",
    "/investors",
    "/jobs-board",
    "/hiring",
    "/about-gc-field-log",
    "/our-story",
    "/mission",
    "/values",
    "/leadership",
    "/founders",
    "/aboutus",
    "/company-info",
    "/who-we-are",
    "/our-team",
    "/meet-the-team",
    "/our-company",
    "/plans-pricing",
    "/cost",
    "/costs",
    "/procore-integration",
  ]) {
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal("/contact/sales".slice(1).includes("/"), true);
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
    "/subscription",
    "/upgrade",
    "/checkout",
    "/api/docs",
    "/.well-known/apple-app-site-association",
    "/search",
    "/unsubscribe",
    "/preferences",
    "/affiliates",
    "/referral",
    "/llms.txt",
    "/ads.txt",
    "/safety",
    "/punch-list",
    "/daily-reports",
    "/field-notes",
    "/export",
    "/pdf",
    "/industries",
    "/construction",
    "/contractors",
    "/twitter",
    "/x",
    "/facebook",
    "/instagram",
    "/linkedin",
    "/youtube",
    "/discord",
    "/slack",
    "/mac",
    "/windows",
    "/android-app",
    "/play-store",
    "/google-play",
    "/testflight",
    "/desktop",
    "/soc2",
    "/hipaa",
    "/compliance",
    "/webhooks",
    "/pay",
    "/payment",
    "/payments",
    "/invoice",
    "/invoices",
    "/field-service",
    "/general-contractors",
    "/iso27001",
    "/trust-center",
    "/webhook",
    "/wp-admin",
    "/debug",
    "/metrics",
    "/robots",
    "/humans",
    "/security-policy-page",
    "/gdpr.html",
    "/data-privacy",
  ]) {
    assert.equal(sources.has(path), false, path);
  }

  const everyRedirect = [
    ...contactRedirects(),
    ...legalRedirects(),
    ...retiredRedirects(),
    ...signInAliasRedirects(),
    ...demoAliasRedirects(),
    { source: "/demo", destination: "/pack/maple-point", permanent: false },
  ];
  const everySource = new Set(everyRedirect.map((redirect) => redirect.source));
  for (const redirect of everyRedirect) {
    assert.equal(everySource.has(redirect.destination), false, redirect.source);
    assert.equal(redirect.source === "/api" || redirect.source.startsWith("/api/"), false, redirect.source);
  }
  assert.equal(everySource.size, everyRedirect.length);
  assert.equal(everySource.has("/api-docs"), true);
  assert.equal(everySource.has("/api/docs"), false);
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
    "/calendar",
    "/invite",
    "/notifications",
    "/billing",
    "/subscribe",
    "/subscription",
    "/upgrade",
    "/checkout",
    "/api/docs",
    "/.well-known/apple-app-site-association",
    "/zz-nope",
    "/search",
    "/unsubscribe",
    "/preferences",
    "/affiliates",
    "/referral",
    "/llms.txt",
    "/ads.txt",
    "/admin",
    "/safety",
    "/punch-list",
    "/daily-reports",
    "/field-notes",
    "/export",
    "/pdf",
    "/industries",
    "/construction",
    "/contractors",
    "/twitter",
    "/x",
    "/facebook",
    "/instagram",
    "/linkedin",
    "/youtube",
    "/discord",
    "/slack",
    "/mac",
    "/windows",
    "/android-app",
    "/play-store",
    "/google-play",
    "/testflight",
    "/desktop",
    "/soc2",
    "/hipaa",
    "/compliance",
    "/webhooks",
    "/pay",
    "/payment",
    "/payments",
    "/invoice",
    "/invoices",
    "/field-service",
    "/general-contractors",
    "/iso27001",
    "/trust-center",
    "/webhook",
    "/wp-admin",
    "/debug",
    "/metrics",
    "/robots",
    "/humans",
    "/security-policy-page",
    "/why-us",
    "/comparison",
    "/product-page",
    "/use-case",
    "/capabilities",
    "/feature-list",
    "/platform",
    "/products-page",
    "/integrations-page",
    "/rate-card",
    "/investor-relations",
    "/become-a-partner",
    "/start-trial",
    "/download-the-app",
    "/iphone-download",
    "/ipad-app",
    "/gdpr.html",
    "/data-privacy",
    "/gdpr-notice",
    "/cpra",
    "/report-vulnerability",
    "/statuspage",
    "/index",
  ];
  for (const path of stay404) {
    assert.equal(everySource.has(path), false, path);
    assert.equal(signInAliasDestination(path), null, path);
    assert.equal(demoAliasDestination(path), null, path);
  }
  for (const path of [
    "/apps",
    "/mobile-app",
    "/iphone",
    "/ipad",
    "/app-store-link",
    "/free",
    "/sign-up-free",
    "/free-account",
    "/signup-free",
    "/welcome",
    "/web-app",
    "/beta",
    "/waitlist",
    "/early-access",
    "/register-now",
    "/join-now",
    "/login-page",
    "/signin-page",
    "/download-app",
    "/get-the-app",
    "/ios-app",
    "/getting-started",
    "/start-here",
    "/sign-in-page",
    "/log-in-page",
    "/create-an-account",
    "/register-account",
    "/open-account",
    "/new-account",
    "/start-free",
    "/ios-download",
    "/get-app",
    "/mobile-download",
    "/appstore",
    "/login-help",
    "/recover",
    "/account-recovery",
    "/sign-up-page",
    "/signup-page",
    "/create-account-page",
    "/download-ios",
    "/app-download",
    "/logon",
    "/signon",
    "/install",
    "/install-app",
    "/iphone-app",
    "/onboard",
    "/welcome-back",
    "/thank-you",
    "/thanks",
    "/success",
    "/cancel",
    "/registration",
    "/create-your-account",
    "/login-form",
    "/sign-up-form",
    "/login.html",
    "/signin.html",
    "/signup.html",
    "/singin",
    "/sign_in",
    "/sign-up-now",
    "/gettingstarted",
  ]) {
    assert.equal(everySource.has(path), false, path);
    assert.equal(signInAliasDestination(path), "/");
    assert.equal(demoAliasDestination(path), null, path);
  }
  for (const path of [
    "/book-demo",
    "/request-demo",
    "/schedule-demo",
    "/get-demo",
    "/demo-video",
    "/book-a-demo",
    "/try",
    "/try-free",
    "/freetrial",
    "/request-quote",
    "/try-it",
    "/try-it-free",
    "/demo-now",
    "/schedule",
    "/book-demo-now",
    "/see-demo",
    "/schedule-a-demo",
    "/see-it-in-action",
    "/product-demo",
    "/live-demo",
    "/interactive-demo",
    "/try-demo",
    "/book-your-demo",
    "/free-demo",
    "/try-now",
    "/demo-request",
    "/demo.html",
    "/demos",
    "/bookdemo",
    "/watch-a-demo",
    "/maple-point-demo",
  ]) {
    assert.equal(everySource.has(path), false, path);
    assert.equal(signInAliasDestination(path), null, path);
    assert.equal(demoAliasDestination(path), "/pack/maple-point");
    assert.notEqual(demoAliasDestination(path), "/demo");
  }
  for (const redirect of demoAliasRedirects()) {
    assert.equal(redirect.permanent, false);
    assert.equal(redirect.permanent ? 308 : 307, 307);
    assert.equal(redirect.destination, "/pack/maple-point");
  }
  for (const redirect of signInAliasRedirects()) {
    assert.equal(redirect.permanent, false);
    assert.equal(redirect.permanent ? 308 : 307, 307);
    assert.equal(redirect.destination, "/");
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
    "app/subscription/page.tsx",
    "app/subscription/route.ts",
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
    /\/settings|\/dashboard|\/forgot-password|\/reset-password|\/about|\/account|\/jobs|\/home|\/index\.html|\/profile|\/plans|\/pricing|\/projects|\/project|\/forgot|\/password-reset|\/reset|\/about-us|\/me|\/app|\/features|\/integrations|\/procore|\/careers|\/team|\/partners|\/customers|\/security\.txt|\/manifest\.json|\/site\.webmanifest|\/manifest\.webmanifest|\.well-known\/security\.txt|\/company|\/product|\/products|\/solutions|\/use-cases|\/why|\/compare|\/alternatives|\/sitemap|\/site-map|\/pricing-plans|\/team-plans|\/enterprise-plan|\/get-quote|\/quote|\/estimate|\/investors|\/jobs-board|\/hiring|\/about-gc-field-log|\/our-story|\/mission|\/values|\/leadership|\/founders|\/aboutus|\/company-info|\/who-we-are|\/our-team|\/meet-the-team|\/our-company|\/plans-pricing|\/cost|\/costs|\/procore-integration|\/contact\/sales|\/price(?!s)|\/prices|\/rates|\/packages|\/business|\/pro(?![A-Za-z0-9_-])|\/product-tour|\/walkthrough|\/product-overview|\/overview|\/integrations-list|\/apps-marketplace|\/our-mission|\/vision|\/culture|\/leadership-team|\/about-company|\/partners-program|\/affiliate(?!s)|\/resellers|\/home-page|\/landing-page|\/landing|\/welcome-page|\/front|\/sitemap-xml|\/xml-sitemap|\/map(?![A-Za-z0-9_.-])|\/about-us-page|\/company-page|\/careers-page|\/jobs-page|\/join-our-team|\/we-are-hiring|\/open-roles|\/work-with-us|\/request-pricing|\/pricing-page|\/compare-plans|\/enterprise-pricing|\/plan-comparison|\/pricing-overview|\/html-sitemap|\/xml-map|\/sitemap-html|\/account-settings|\/team-members|\/my-account|\/your-account|\/plans-and-pricing|\/pricing-and-plans|\/get-a-quote|\/pricelist|\/homepage|\/our-values|\/our-vision|\/meet-our-team|\/now-hiring|\/site_map|\/sitemap-index|\/about-page|\/the-team|\/our-founders|\/join-the-team|\/front-page|\/the-company|\/mission-page|\/price-list|\/our-plans|\/plans-page|\/account-page|\/my-profile|\/user-profile|\/manage-account|\/sitemaps|\/sitemap\.txt|\/sitemap-index\.xml|\/about\.html|\/about-us\.html|\/company\.html|\/home\.html|\/default\.html|\/whoweare|\/career(?!s)|\/pricing\.html|\/plans\.html|\/price\.html|\/pricings|\/prcing|\/our-pricing|\/account\.html|\/profile\.html|\/settings\.html|\/myaccount|\/user-account|\/account\/profile|\/sitemap\.html|\/site-map\.html|\/site-map\.xml|\/sitemap_index\.xml|\/sitemap\.xml\.gz|\/google-sitemap|\/features\.html|\/integrations\.html|\/product\.html|\/solutions\.html|\/feautures|\/pricng|\/priceing|\/careers\.html|\/aboutus\.html|\/compnay|\/index\.htm|\/ourstory|\/acount|\/my_account|\/setings|\/my-account\.html|\/sitemap\.htm|\/sitemapxml|\/site_map\.html/,
  );

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(
    proxy,
    /\/settings|\/dashboard|\/forgot-password|\/reset-password|\/about|\/home|\/index\.html|\/profile|\/plans|\/projects|\/forgot|\/password-reset|\/about-us|\/features|\/integrations|\/procore|\/careers|\/team|\/partners|\/customers|\/security\.txt|\/manifest\.json|\/site\.webmanifest|\/manifest\.webmanifest|\.well-known\/security\.txt|\/company|\/product|\/products|\/solutions|\/use-cases|\/why|\/compare|\/alternatives|\/sitemap|\/site-map|\/pricing-plans|\/team-plans|\/enterprise-plan|\/get-quote|\/quote|\/estimate|\/investors|\/jobs-board|\/hiring|\/about-gc-field-log|\/our-story|\/mission|\/values|\/leadership|\/founders|\/aboutus|\/company-info|\/who-we-are|\/our-team|\/meet-the-team|\/our-company|\/plans-pricing|\/cost|\/costs|\/procore-integration|\/contact\/sales|\/price(?!s)|\/prices|\/rates|\/packages|\/business|\/pro(?![A-Za-z0-9_-])|\/product-tour|\/walkthrough|\/product-overview|\/overview|\/integrations-list|\/apps-marketplace|\/our-mission|\/vision|\/culture|\/leadership-team|\/about-company|\/partners-program|\/affiliate(?!s)|\/resellers|\/home-page|\/landing-page|\/landing|\/welcome-page|\/front|\/sitemap-xml|\/xml-sitemap|\/map(?![A-Za-z0-9_.-])|\/about-us-page|\/company-page|\/careers-page|\/jobs-page|\/join-our-team|\/we-are-hiring|\/open-roles|\/work-with-us|\/request-pricing|\/pricing-page|\/compare-plans|\/enterprise-pricing|\/plan-comparison|\/pricing-overview|\/html-sitemap|\/xml-map|\/sitemap-html|\/account-settings|\/team-members|\/my-account|\/your-account|\/plans-and-pricing|\/pricing-and-plans|\/get-a-quote|\/pricelist|\/homepage|\/our-values|\/our-vision|\/meet-our-team|\/now-hiring|\/site_map|\/sitemap-index|\/about-page|\/the-team|\/our-founders|\/join-the-team|\/front-page|\/the-company|\/mission-page|\/price-list|\/our-plans|\/plans-page|\/account-page|\/my-profile|\/user-profile|\/manage-account|\/sitemaps|\/sitemap\.txt|\/sitemap-index\.xml|\/about\.html|\/about-us\.html|\/company\.html|\/home\.html|\/default\.html|\/whoweare|\/career(?!s)|\/pricing\.html|\/plans\.html|\/price\.html|\/pricings|\/prcing|\/our-pricing|\/account\.html|\/profile\.html|\/settings\.html|\/myaccount|\/user-account|\/account\/profile|\/sitemap\.html|\/site-map\.html|\/site-map\.xml|\/sitemap_index\.xml|\/sitemap\.xml\.gz|\/google-sitemap|\/features\.html|\/integrations\.html|\/product\.html|\/solutions\.html|\/feautures|\/pricng|\/priceing|\/careers\.html|\/aboutus\.html|\/compnay|\/index\.htm|\/ourstory|\/acount|\/my_account|\/setings|\/my-account\.html|\/sitemap\.htm|\/sitemapxml|\/site_map\.html/,
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
  assert.equal(existsSync(new URL("../app/sitemap.ts", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/sitemap/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/sitemap/route.ts", import.meta.url)), false);
  assert.equal(existsSync(new URL("../public/sitemap.xml", import.meta.url)), false);
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
    "app/company/page.tsx",
    "app/company/route.ts",
    "app/product/page.tsx",
    "app/product/route.ts",
    "app/products/page.tsx",
    "app/products/route.ts",
    "app/solutions/page.tsx",
    "app/solutions/route.ts",
    "app/use-cases/page.tsx",
    "app/use-cases/route.ts",
    "app/why/page.tsx",
    "app/why/route.ts",
    "app/compare/page.tsx",
    "app/compare/route.ts",
    "app/alternatives/page.tsx",
    "app/alternatives/route.ts",
    "app/sitemap/page.tsx",
    "app/sitemap/route.ts",
    "app/site-map/page.tsx",
    "app/site-map/route.ts",
    "public/company",
    "public/company.html",
    "public/product",
    "public/product.html",
    "public/products",
    "public/products.html",
    "public/solutions",
    "public/solutions.html",
    "public/use-cases",
    "public/use-cases.html",
    "public/why",
    "public/why.html",
    "public/compare",
    "public/compare.html",
    "public/alternatives",
    "public/alternatives.html",
    "public/sitemap",
    "public/sitemap.html",
    "public/site-map",
    "public/site-map.html",
    "public/sitemap.xml",
    "app/search/page.tsx",
    "app/search/route.ts",
    "app/unsubscribe/page.tsx",
    "app/unsubscribe/route.ts",
    "app/preferences/page.tsx",
    "app/preferences/route.ts",
    "app/affiliates/page.tsx",
    "app/affiliates/route.ts",
    "app/referral/page.tsx",
    "app/referral/route.ts",
    "app/llms.txt/page.tsx",
    "app/llms.txt/route.ts",
    "app/ads.txt/page.tsx",
    "app/ads.txt/route.ts",
    "public/search",
    "public/search.html",
    "public/unsubscribe",
    "public/unsubscribe.html",
    "public/preferences",
    "public/preferences.html",
    "public/affiliates",
    "public/affiliates.html",
    "public/referral",
    "public/referral.html",
    "public/llms.txt",
    "public/ads.txt",
    "app/pricing-plans/page.tsx",
    "app/pricing-plans/route.ts",
    "app/team-plans/page.tsx",
    "app/team-plans/route.ts",
    "app/enterprise-plan/page.tsx",
    "app/enterprise-plan/route.ts",
    "app/quote/page.tsx",
    "app/quote/route.ts",
    "app/get-quote/page.tsx",
    "app/get-quote/route.ts",
    "app/estimate/page.tsx",
    "app/estimate/route.ts",
    "app/investors/page.tsx",
    "app/investors/route.ts",
    "app/jobs-board/page.tsx",
    "app/jobs-board/route.ts",
    "app/hiring/page.tsx",
    "app/hiring/route.ts",
    "app/admin/page.tsx",
    "app/admin/route.ts",
    "public/pricing-plans",
    "public/pricing-plans.html",
    "public/team-plans",
    "public/team-plans.html",
    "public/enterprise-plan",
    "public/enterprise-plan.html",
    "public/quote",
    "public/quote.html",
    "public/get-quote",
    "public/get-quote.html",
    "public/estimate",
    "public/estimate.html",
    "public/investors",
    "public/investors.html",
    "public/jobs-board",
    "public/jobs-board.html",
    "public/hiring",
    "public/hiring.html",
    "public/admin",
    "public/admin.html",
    "app/about-gc-field-log/page.tsx",
    "app/about-gc-field-log/route.ts",
    "app/our-story/page.tsx",
    "app/our-story/route.ts",
    "app/mission/page.tsx",
    "app/mission/route.ts",
    "app/values/page.tsx",
    "app/values/route.ts",
    "app/leadership/page.tsx",
    "app/leadership/route.ts",
    "app/founders/page.tsx",
    "app/founders/route.ts",
    "public/about-gc-field-log",
    "public/about-gc-field-log.html",
    "public/our-story",
    "public/our-story.html",
    "public/mission",
    "public/mission.html",
    "public/values",
    "public/values.html",
    "public/leadership",
    "public/leadership.html",
    "public/founders",
    "public/founders.html",
    "app/aboutus/page.tsx",
    "app/aboutus/route.ts",
    "app/company-info/page.tsx",
    "app/company-info/route.ts",
    "app/who-we-are/page.tsx",
    "app/who-we-are/route.ts",
    "app/our-team/page.tsx",
    "app/our-team/route.ts",
    "app/meet-the-team/page.tsx",
    "app/meet-the-team/route.ts",
    "app/our-company/page.tsx",
    "app/our-company/route.ts",
    "app/plans-pricing/page.tsx",
    "app/plans-pricing/route.ts",
    "app/cost/page.tsx",
    "app/cost/route.ts",
    "app/costs/page.tsx",
    "app/costs/route.ts",
    "app/procore-integration/page.tsx",
    "app/procore-integration/route.ts",
    "app/contact/sales/page.tsx",
    "app/contact/sales/route.ts",
    "public/aboutus",
    "public/aboutus.html",
    "public/company-info",
    "public/company-info.html",
    "public/who-we-are",
    "public/who-we-are.html",
    "public/our-team",
    "public/our-team.html",
    "public/meet-the-team",
    "public/meet-the-team.html",
    "public/our-company",
    "public/our-company.html",
    "public/plans-pricing",
    "public/plans-pricing.html",
    "public/cost",
    "public/cost.html",
    "public/costs",
    "public/costs.html",
    "public/procore-integration",
    "public/procore-integration.html",
    "public/contact/sales",
    "public/contact/sales.html",
    "public/subscription",
    "public/subscription.html",
    "app/safety/page.tsx",
    "app/safety/route.ts",
    "app/punch-list/page.tsx",
    "app/punch-list/route.ts",
    "app/daily-reports/page.tsx",
    "app/daily-reports/route.ts",
    "app/field-notes/page.tsx",
    "app/field-notes/route.ts",
    "app/export/page.tsx",
    "app/export/route.ts",
    "app/pdf/page.tsx",
    "app/pdf/route.ts",
    "app/industries/page.tsx",
    "app/industries/route.ts",
    "app/construction/page.tsx",
    "app/construction/route.ts",
    "app/contractors/page.tsx",
    "app/contractors/route.ts",
    "app/twitter/page.tsx",
    "app/twitter/route.ts",
    "app/x/page.tsx",
    "app/x/route.ts",
    "app/facebook/page.tsx",
    "app/facebook/route.ts",
    "app/instagram/page.tsx",
    "app/instagram/route.ts",
    "app/linkedin/page.tsx",
    "app/linkedin/route.ts",
    "app/youtube/page.tsx",
    "app/youtube/route.ts",
    "app/discord/page.tsx",
    "app/discord/route.ts",
    "app/slack/page.tsx",
    "app/slack/route.ts",
    "app/mac/page.tsx",
    "app/mac/route.ts",
    "app/windows/page.tsx",
    "app/windows/route.ts",
    "app/android-app/page.tsx",
    "app/android-app/route.ts",
    "app/play-store/page.tsx",
    "app/play-store/route.ts",
    "app/google-play/page.tsx",
    "app/google-play/route.ts",
    "app/testflight/page.tsx",
    "app/testflight/route.ts",
    "app/desktop/page.tsx",
    "app/desktop/route.ts",
    "app/soc2/page.tsx",
    "app/soc2/route.ts",
    "app/hipaa/page.tsx",
    "app/hipaa/route.ts",
    "app/compliance/page.tsx",
    "app/compliance/route.ts",
    "app/webhooks/page.tsx",
    "app/webhooks/route.ts",
    "public/safety",
    "public/safety.html",
    "public/punch-list",
    "public/punch-list.html",
    "public/daily-reports",
    "public/daily-reports.html",
    "public/field-notes",
    "public/field-notes.html",
    "public/export",
    "public/export.html",
    "public/pdf",
    "public/pdf.html",
    "public/industries",
    "public/industries.html",
    "public/construction",
    "public/construction.html",
    "public/contractors",
    "public/contractors.html",
    "public/twitter",
    "public/twitter.html",
    "public/x",
    "public/x.html",
    "public/facebook",
    "public/facebook.html",
    "public/instagram",
    "public/instagram.html",
    "public/linkedin",
    "public/linkedin.html",
    "public/youtube",
    "public/youtube.html",
    "public/discord",
    "public/discord.html",
    "public/slack",
    "public/slack.html",
    "public/mac",
    "public/mac.html",
    "public/windows",
    "public/windows.html",
    "public/android-app",
    "public/android-app.html",
    "public/play-store",
    "public/play-store.html",
    "public/google-play",
    "public/google-play.html",
    "public/testflight",
    "public/testflight.html",
    "public/desktop",
    "public/desktop.html",
    "public/soc2",
    "public/soc2.html",
    "public/hipaa",
    "public/hipaa.html",
    "public/compliance",
    "public/compliance.html",
    "public/webhooks",
    "public/webhooks.html",
    "app/price/page.tsx",
    "app/price/route.ts",
    "app/prices/page.tsx",
    "app/prices/route.ts",
    "app/rates/page.tsx",
    "app/rates/route.ts",
    "app/packages/page.tsx",
    "app/packages/route.ts",
    "app/business/page.tsx",
    "app/business/route.ts",
    "app/pro/page.tsx",
    "app/pro/route.ts",
    "app/product-tour/page.tsx",
    "app/product-tour/route.ts",
    "app/walkthrough/page.tsx",
    "app/walkthrough/route.ts",
    "app/product-overview/page.tsx",
    "app/product-overview/route.ts",
    "app/overview/page.tsx",
    "app/overview/route.ts",
    "app/integrations-list/page.tsx",
    "app/integrations-list/route.ts",
    "app/apps-marketplace/page.tsx",
    "app/apps-marketplace/route.ts",
    "app/our-mission/page.tsx",
    "app/our-mission/route.ts",
    "app/vision/page.tsx",
    "app/vision/route.ts",
    "app/culture/page.tsx",
    "app/culture/route.ts",
    "app/leadership-team/page.tsx",
    "app/leadership-team/route.ts",
    "app/about-company/page.tsx",
    "app/about-company/route.ts",
    "app/partners-program/page.tsx",
    "app/partners-program/route.ts",
    "app/affiliate/page.tsx",
    "app/affiliate/route.ts",
    "app/resellers/page.tsx",
    "app/resellers/route.ts",
    "app/home-page/page.tsx",
    "app/home-page/route.ts",
    "app/landing/page.tsx",
    "app/landing/route.ts",
    "app/landing-page/page.tsx",
    "app/landing-page/route.ts",
    "app/welcome-page/page.tsx",
    "app/welcome-page/route.ts",
    "app/front/page.tsx",
    "app/front/route.ts",
    "app/sitemap-xml/page.tsx",
    "app/sitemap-xml/route.ts",
    "app/xml-sitemap/page.tsx",
    "app/xml-sitemap/route.ts",
    "app/map/page.tsx",
    "app/map/route.ts",
    "public/price",
    "public/price.html",
    "public/prices",
    "public/prices.html",
    "public/rates",
    "public/rates.html",
    "public/packages",
    "public/packages.html",
    "public/business",
    "public/business.html",
    "public/pro",
    "public/pro.html",
    "public/product-tour",
    "public/product-tour.html",
    "public/walkthrough",
    "public/walkthrough.html",
    "public/product-overview",
    "public/product-overview.html",
    "public/overview",
    "public/overview.html",
    "public/integrations-list",
    "public/integrations-list.html",
    "public/apps-marketplace",
    "public/apps-marketplace.html",
    "public/our-mission",
    "public/our-mission.html",
    "public/vision",
    "public/vision.html",
    "public/culture",
    "public/culture.html",
    "public/leadership-team",
    "public/leadership-team.html",
    "public/about-company",
    "public/about-company.html",
    "public/partners-program",
    "public/partners-program.html",
    "public/affiliate",
    "public/affiliate.html",
    "public/resellers",
    "public/resellers.html",
    "public/home-page",
    "public/home-page.html",
    "public/landing",
    "public/landing.html",
    "public/landing-page",
    "public/landing-page.html",
    "public/welcome-page",
    "public/welcome-page.html",
    "public/front",
    "public/front.html",
    "public/sitemap-xml",
    "public/sitemap-xml.html",
    "public/xml-sitemap",
    "public/xml-sitemap.html",
    "public/map",
    "public/map.html",
    "app/pay/page.tsx",
    "app/pay/route.ts",
    "app/payment/page.tsx",
    "app/payment/route.ts",
    "app/payments/page.tsx",
    "app/payments/route.ts",
    "app/invoice/page.tsx",
    "app/invoice/route.ts",
    "app/invoices/page.tsx",
    "app/invoices/route.ts",
    "app/field-service/page.tsx",
    "app/field-service/route.ts",
    "app/general-contractors/page.tsx",
    "app/general-contractors/route.ts",
    "app/iso27001/page.tsx",
    "app/iso27001/route.ts",
    "app/trust-center/page.tsx",
    "app/trust-center/route.ts",
    "app/webhook/page.tsx",
    "app/webhook/route.ts",
    "app/wp-admin/page.tsx",
    "app/wp-admin/route.ts",
    "app/debug/page.tsx",
    "app/debug/route.ts",
    "app/metrics/page.tsx",
    "app/metrics/route.ts",
    "app/robots/page.tsx",
    "app/robots/route.ts",
    "app/humans/page.tsx",
    "app/humans/route.ts",
    "app/security-policy-page/page.tsx",
    "app/security-policy-page/route.ts",
    "public/pay",
    "public/pay.html",
    "public/payment",
    "public/payment.html",
    "public/payments",
    "public/payments.html",
    "public/invoice",
    "public/invoice.html",
    "public/invoices",
    "public/invoices.html",
    "public/field-service",
    "public/field-service.html",
    "public/general-contractors",
    "public/general-contractors.html",
    "public/iso27001",
    "public/iso27001.html",
    "public/trust-center",
    "public/trust-center.html",
    "public/webhook",
    "public/webhook.html",
    "public/wp-admin",
    "public/wp-admin.html",
    "public/debug",
    "public/debug.html",
    "public/metrics",
    "public/metrics.html",
    "public/robots",
    "public/robots.html",
    "public/humans",
    "public/humans.html",
    "public/security-policy-page",
    "public/security-policy-page.html",
    "app/affiliates/page.tsx",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
  for (const name of [
    "about-us-page",
    "company-page",
    "careers-page",
    "jobs-page",
    "join-our-team",
    "we-are-hiring",
    "open-roles",
    "work-with-us",
    "request-pricing",
    "pricing-page",
    "compare-plans",
    "enterprise-pricing",
    "plan-comparison",
    "pricing-overview",
    "html-sitemap",
    "xml-map",
    "sitemap-html",
    "account-settings",
    "team-members",
    "my-account",
    "your-account",
    "plans-and-pricing",
    "pricing-and-plans",
    "get-a-quote",
    "pricelist",
    "homepage",
    "our-values",
    "our-vision",
    "meet-our-team",
    "now-hiring",
    "site_map",
    "sitemap-index",
    "about-page",
    "the-team",
    "our-founders",
    "join-the-team",
    "front-page",
    "the-company",
    "mission-page",
    "price-list",
    "our-plans",
    "plans-page",
    "account-page",
    "my-profile",
    "user-profile",
    "manage-account",
    "sitemaps",
    "sitemap.txt",
    "sitemap-index.xml",
    "about.html",
    "about-us.html",
    "company.html",
    "home.html",
    "default.html",
    "whoweare",
    "career",
    "pricing.html",
    "plans.html",
    "price.html",
    "pricings",
    "prcing",
    "our-pricing",
    "account.html",
    "profile.html",
    "settings.html",
    "myaccount",
    "user-account",
    "account/profile",
    "sitemap.html",
    "site-map.html",
    "site-map.xml",
    "sitemap_index.xml",
    "sitemap.xml.gz",
    "google-sitemap",
    "features.html",
    "integrations.html",
    "product.html",
    "solutions.html",
    "feautures",
    "pricng",
    "priceing",
    "careers.html",
    "aboutus.html",
    "compnay",
    "index.htm",
    "ourstory",
    "acount",
    "my_account",
    "setings",
    "my-account.html",
    "sitemap.htm",
    "sitemapxml",
    "site_map.html",
  ]) {
    for (const page of [
      `app/${name}/page.tsx`,
      `app/${name}/route.ts`,
      `public/${name}`,
      `public/${name}.html`,
    ]) {
      assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
    }
  }
  assert.equal(existsSync(new URL("../app/jobs/page.tsx", import.meta.url)), true);
  assert.equal(existsSync(new URL("../app/sitemap.ts", import.meta.url)), true);
});
