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
 * /security.txt moves straight to /.well-known/security.txt.
 * /manifest.json and /site.webmanifest move straight to /manifest.webmanifest.
 * /sitemap and /site-map move straight to /sitemap.xml. app/sitemap.ts
 * serves that path. /sitemap.xml itself is not a source.
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
    ...["/sitemap", "/site-map"].map((source) => ({
      source,
      destination: SITEMAP_HREF,
      permanent: true,
    })),
  ];
}
