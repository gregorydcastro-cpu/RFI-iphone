/**
 * Retired paths have no page. Each is a permanent move.
 * Next.js treats permanent as HTTP 308.
 * Password-reset aliases share the destination /forgot-password already
 * uses. /about-us and /company share the destination /about already uses.
 * Both are /.
 * /features shares the destination /plans already uses. That is /pricing.
 * /integrations, /procore, /product, /products, /solutions, /use-cases,
 * /why, /compare, /alternatives, /pricing-plans, /team-plans,
 * /enterprise-plan, /quote, /get-quote, and /estimate share that same
 * destination.
 * /procore is only the exact path, so /api/procore and anything under it
 * stay on their routes. /product does not match /products.
 * /careers, /team, /partners, /customers, /investors, /jobs-board,
 * /hiring, /about-gc-field-log, /our-story, /mission, /values,
 * /leadership, /founders, /aboutus, /company-info, /who-we-are,
 * /our-team, /meet-the-team, and /our-company share the destination /
 * already uses.
 * /jobs-board does not match /jobs. /about-gc-field-log does not match
 * /about. /pricing-plans does not match /pricing.
 * /team-plans does not match /team. /enterprise-plan does not match
 * /enterprise.
 * /aboutus does not match /about or /about-us. /our-team and
 * /meet-the-team do not match /team. /our-company and /company-info do
 * not match /company.
 * /plans-pricing, /cost, /costs, /procore-integration, and /contact/sales
 * share the destination /pricing already uses.
 * /plans-pricing does not match /pricing, /plans, or /pricing-plans.
 * /cost does not match /costs. /procore-integration does not match
 * /procore, /integrations, or /api/procore. /contact/sales is only that
 * exact path, so it does not match /contact, /sales, or /contact-sales.
 * /price, /prices, /rates, /packages, /business, /pro, /product-tour,
 * /walkthrough, /product-overview, /overview, /integrations-list, and
 * /apps-marketplace share the destination /pricing already uses.
 * /price does not match /prices or /pricing. /pro does not match
 * /procore, /product, or /products. /product-tour and /product-overview
 * do not match /product. /overview does not match /product-overview.
 * /integrations-list does not match /integrations. /business does not
 * match /enterprise.
 * /our-mission, /vision, /culture, /leadership-team, /about-company,
 * /partners-program, /affiliate, /resellers, /home-page, /landing,
 * /landing-page, /welcome-page, and /front share the destination /
 * already uses. /our-mission does not match /mission. /leadership-team
 * does not match /leadership. /about-company does not match /about or
 * /company. /partners-program does not match /partners. /affiliate does
 * not match /affiliates. /home-page does not match /home. /landing-page
 * does not match /landing. /welcome-page does not match /welcome.
 * /about-us-page, /company-page, /careers-page, /jobs-page,
 * /join-our-team, /we-are-hiring, /open-roles, and /work-with-us share
 * the destination / already uses. /about-us-page does not match /about-us
 * or /about. /company-page does not match /company. /careers-page does
 * not match /careers. /jobs-page does not match /jobs or /jobs-board.
 * /join-our-team does not match /join. /we-are-hiring does not match
 * /hiring. /open-roles and /work-with-us do not match /careers.
 * /request-pricing, /pricing-page, /compare-plans, /enterprise-pricing,
 * /plan-comparison, and /pricing-overview share the destination /pricing
 * already uses. /request-pricing does not match /pricing. /pricing-page
 * does not match /pricing or /pricing-plans. /compare-plans does not
 * match /compare. /enterprise-pricing does not match /enterprise-plan
 * or /enterprise. /plan-comparison does not match /compare.
 * /pricing-overview does not match /overview or /pricing.
 * /security.txt moves straight to /.well-known/security.txt.
 * /manifest.json and /site.webmanifest move straight to /manifest.webmanifest.
 * /sitemap, /site-map, /sitemap-xml, /xml-sitemap, /map, /html-sitemap,
 * /xml-map, and /sitemap-html move straight to /sitemap.xml.
 * app/sitemap.ts serves that path. /sitemap.xml itself is not a source.
 * /sitemap-xml does not match /sitemap. /map does not match /sitemap or
 * /site-map. /html-sitemap and /sitemap-html do not match /sitemap.
 * /xml-map does not match /map or /xml-sitemap.
 */

const HOME_HREF = "/";
const ACCOUNT_HREF = "/account";
const JOBS_HREF = "/jobs";
const PRICING_HREF = "/pricing";
const SECURITY_TXT_HREF = "/.well-known/security.txt";
const MANIFEST_HREF = "/manifest.webmanifest";
const SITEMAP_HREF = "/sitemap.xml";

export function retiredRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    ...["/settings", "/profile", "/me", "/account/settings", "/settings/profile"].map((source) => ({
      source,
      destination: ACCOUNT_HREF,
      permanent: true,
    })),
    ...["/dashboard", "/projects", "/project", "/app"].map((source) => ({
      source,
      destination: JOBS_HREF,
      permanent: true,
    })),
    ...[
      "/plans",
      "/features",
      "/integrations",
      "/procore",
      "/product",
      "/products",
      "/solutions",
      "/use-cases",
      "/why",
      "/compare",
      "/alternatives",
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
      "/pricing-overview",
    ].map((source) => ({
      source,
      destination: PRICING_HREF,
      permanent: true,
    })),
    ...[
      "/forgot-password",
      "/reset-password",
      "/about",
      "/home",
      "/index.html",
      "/forgot",
      "/password-reset",
      "/reset",
      "/about-us",
      "/careers",
      "/team",
      "/partners",
      "/customers",
      "/company",
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
      "/work-with-us",
    ].map((source) => ({
      source,
      destination: HOME_HREF,
      permanent: true,
    })),
    {
      source: "/security.txt",
      destination: SECURITY_TXT_HREF,
      permanent: true,
    },
    ...["/manifest.json", "/site.webmanifest"].map((source) => ({
      source,
      destination: MANIFEST_HREF,
      permanent: true,
    })),
    ...["/sitemap", "/site-map", "/sitemap-xml", "/xml-sitemap", "/map", "/html-sitemap", "/xml-map", "/sitemap-html"].map((source) => ({
      source,
      destination: SITEMAP_HREF,
      permanent: true,
    })),
  ];
}
