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
 * /account-settings and /team-members share the destination /account
 * already uses. /account-settings does not match /account,
 * /account/settings, or /settings. /team-members does not match /team.
 * /security.txt moves straight to /.well-known/security.txt.
 * /manifest.json and /site.webmanifest move straight to /manifest.webmanifest.
 * /sitemap, /site-map, /sitemap-xml, /xml-sitemap, /map, /html-sitemap,
 * /xml-map, and /sitemap-html move straight to /sitemap.xml.
 * app/sitemap.ts serves that path. /sitemap.xml itself is not a source.
 * /sitemap-xml does not match /sitemap. /map does not match /sitemap or
 * /site-map. /html-sitemap and /sitemap-html do not match /sitemap.
 * /xml-map does not match /map or /xml-sitemap.
 * /my-account and /your-account share the destination /account already
 * uses. /my-account and /your-account do not match /account.
 * /plans-and-pricing, /pricing-and-plans, /get-a-quote, and /pricelist
 * share the destination /pricing already uses. /plans-and-pricing does
 * not match /plans-pricing or /pricing. /pricing-and-plans does not match
 * /pricing-plans or /pricing. /get-a-quote does not match /get-quote,
 * /quote, or /request-quote. /pricelist does not match /prices or /price.
 * /homepage, /our-values, /our-vision, /meet-our-team, and /now-hiring
 * share the destination / already uses. /homepage does not match /home
 * or /home-page. /our-values does not match /values. /our-vision does not
 * match /vision. /meet-our-team does not match /meet-the-team or /our-team.
 * /now-hiring does not match /hiring or /we-are-hiring.
 * /site_map and /sitemap-index move straight to /sitemap.xml.
 * /site_map does not match /site-map or /sitemap. /sitemap-index does not
 * match /sitemap. /sitemap.xml itself is not a source.
 * /about-page, /the-team, /our-founders, /join-the-team, /front-page,
 * /the-company, and /mission-page share the destination / already uses.
 * /about-page does not match /about or /about-us-page. /the-team does not
 * match /team or /our-team. /our-founders does not match /founders.
 * /join-the-team does not match /join-our-team or /join. /front-page does
 * not match /front or /home-page. /the-company does not match /company.
 * /mission-page does not match /mission.
 * /price-list, /our-plans, and /plans-page share the destination /pricing
 * already uses. /price-list does not match /pricelist, /price, or /prices.
 * /our-plans does not match /plans. /plans-page does not match /plans,
 * /pricing-page, or /pricing.
 * /account-page, /my-profile, /user-profile, and /manage-account share the
 * destination /account already uses. /account-page does not match
 * /account. /my-profile and /user-profile do not match /profile.
 * /manage-account does not match /account or /account-settings.
 * /sitemaps, /sitemap.txt, and /sitemap-index.xml move straight to
 * /sitemap.xml. /sitemaps does not match /sitemap. /sitemap.txt does not
 * match /sitemap. /sitemap-index.xml does not match /sitemap-index.
 * /sitemap.xml itself is not a source.
 * /about.html, /about-us.html, /company.html, /home.html, /default.html,
 * /whoweare, and /career share the destination / already uses.
 * /about.html does not match /about. /about-us.html does not match
 * /about-us. /company.html does not match /company. /home.html does not
 * match /home or /index.html. /default.html does not match /home.
 * /whoweare does not match /who-we-are. /career does not match /careers.
 * /pricing.html, /plans.html, /price.html, /pricings, /prcing, and
 * /our-pricing share the destination /pricing already uses.
 * /pricing.html does not match /pricing. /plans.html does not match
 * /plans. /price.html does not match /price or /prices. /pricings does
 * not match /prices or /pricing. /prcing does not match /pricing.
 * /our-pricing does not match /pricing.
 * /account.html, /profile.html, /settings.html, /myaccount,
 * /user-account, and /account/profile share the destination /account
 * already uses. /account.html does not match /account. /profile.html
 * does not match /profile. /settings.html does not match /settings.
 * /myaccount does not match /my-account. /user-account does not match
 * /account. /account/profile is only that exact path, so it does not
 * match /account, /profile, or /account/settings.
 * /sitemap.html, /site-map.html, /site-map.xml, /sitemap_index.xml,
 * /sitemap.xml.gz, and /google-sitemap move straight to /sitemap.xml.
 * /sitemap.html does not match /sitemap. /site-map.html and /site-map.xml
 * do not match /site-map. /sitemap_index.xml does not match
 * /sitemap-index.xml or /sitemap-index. /sitemap.xml.gz does not match
 * /sitemap.xml. /google-sitemap does not match /sitemap.
 * /sitemap.xml itself is not a source.
 * /features.html, /product.html, /solutions.html, /feautures, /pricng, and
 * /priceing share the destination /pricing already uses. /features.html
 * does not match /features. /integrations.html stays off this list.
 * /product.html does not match /product or /products. /solutions.html
 * does not match /solutions. /feautures does not match /features.
 * /pricng does not match /pricing or /prcing.
 * /priceing does not match /pricing or /price.
 * /careers.html, /aboutus.html, /compnay, /index.htm, and /ourstory share
 * the destination / already uses. /careers.html does not match /careers.
 * /aboutus.html does not match /aboutus or /about-us.html. /compnay does
 * not match /company. /index.htm does not match /index.html. /index stays
 * off this list. /ourstory does not match /our-story.
 * /acount, /my_account, /setings, and /my-account.html share the
 * destination /account already uses. /acount does not match /account.
 * /my_account does not match /my-account or /myaccount. /setings does not
 * match /settings. /my-account.html does not match /my-account or
 * /account.html.
 * /sitemap.htm, /sitemapxml, and /site_map.html move straight to
 * /sitemap.xml. /sitemap.htm does not match /sitemap or /sitemap.html.
 * /sitemapxml does not match /sitemap-xml or /sitemap.xml. /site_map.html
 * does not match /site_map or /site-map.html. /sitemap.xml itself is not
 * a source.
 * /our-pricing.html, /pricing-plans.html, /pricig, /featrues,
 * /products.html, and /prodcut share the destination /pricing already
 * uses. /our-pricing.html does not match /our-pricing or /pricing.html.
 * /pricing-plans.html does not match /pricing-plans or /pricing.html.
 * /pricig does not match /pricing, /prcing, or /pricng. /featrues does
 * not match /features or /feautures. /products.html does not match
 * /products or /product.html. /prodcut does not match /product or
 * /products.
 * /abotu, /abuot, /comapny, /carreers, and /homepage.html share the
 * destination / already uses. /abotu and /abuot do not match /about or
 * each other. /comapny does not match /company or /compnay. /carreers
 * does not match /careers. /homepage.html does not match /homepage or
 * /home.html.
 * /acccount, /accout, /accountsettings, and /settigns share the
 * destination /account already uses. /acccount and /accout do not match
 * /account or /acount. /accountsettings does not match /account-settings
 * or /account/settings. /settigns does not match /settings or /setings.
 * /sitemaps.html, /sitemap_xml, and /xmlsitemap move straight to
 * /sitemap.xml. /sitemaps.html does not match /sitemaps or /sitemap.html.
 * /sitemap_xml does not match /sitemap-xml or /sitemap.xml. /xmlsitemap
 * does not match /xml-sitemap. /sitemap.xml itself is not a source.
 * /featues, /feautres, /prodcuts, /solutons, /soulutions, and /pricng.html
 * share the destination /pricing already uses. /featues does not match
 * /features, /feautures, or /featrues. /feautres does not match /features
 * or /feautures. /prodcuts does not match /products, /product, or /prodcut.
 * /solutons and /soulutions do not match /solutions or each other.
 * /pricng.html does not match /pricng or /pricing.html.
 * /carrers, /home-page.html, /who-we-are.html, /whoweare.html, and
 * /our-story.html share the destination / already uses. /carrers does
 * not match /careers, /carreers, or /career. /home-page.html does not
 * match /home-page or /home.html. /who-we-are.html does not match
 * /who-we-are. /whoweare.html does not match /whoweare.
 * /our-story.html does not match /our-story or /ourstory.
 * /myprofile, /userprofile, /proflie, /user-account.html,
 * /manage-account.html, and /acount.html share the destination /account
 * already uses. /myprofile does not match /my-profile. /userprofile does
 * not match /user-profile. /proflie does not match /profile.
 * /user-account.html does not match /user-account or /account.html.
 * /manage-account.html does not match /manage-account.
 * /acount.html does not match /acount or /account.html.
 * /googlesitemap moves straight to /sitemap.xml. /googlesitemap does not
 * match /google-sitemap or /sitemap. /sitemap.xml itself is not a source.
 * /pricing/plans shares the destination /pricing already uses.
 * /pricing/plans does not match /pricing, /plans, or /pricing-plans.
 * /crew-plan stays off this list. /old-home shares the destination /
 * already uses. /old-home does not match /home or /home-page.
 * /people, /join-us, /forgotpassword, and /resetpassword stay off this
 * list. /people does not match /team. /join-us does not match /join.
 * /forgotpassword does not match /forgot-password. /resetpassword does
 * not match /reset-password.
 * /edit-profile shares the destination /account already uses.
 * /edit-profile does not match /profile or /my-profile.
 * /wp-sitemap.xml, /page-sitemap.xml, and /post-sitemap.xml move straight
 * to /sitemap.xml. /wp-sitemap.xml does not match /sitemap or
 * /sitemap.xml. /page-sitemap.xml and /post-sitemap.xml do not match
 * /sitemap.xml or each other. /sitemap.xml itself is not a source.
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
    ...["/settings", "/profile", "/me", "/account/settings", "/settings/profile", "/account-settings", "/team-members", "/my-account", "/your-account", "/account-page", "/my-profile", "/user-profile", "/manage-account", "/account.html", "/profile.html", "/settings.html", "/myaccount", "/user-account", "/account/profile", "/acount", "/my_account", "/setings", "/my-account.html", "/acccount", "/accout", "/accountsettings", "/settigns", "/myprofile", "/userprofile", "/proflie", "/user-account.html", "/manage-account.html", "/acount.html", "/edit-profile"].map((source) => ({
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
      "/plans-and-pricing",
      "/pricing-and-plans",
      "/get-a-quote",
      "/pricelist",
      "/price-list",
      "/our-plans",
      "/plans-page",
      "/pricing.html",
      "/plans.html",
      "/price.html",
      "/pricings",
      "/prcing",
      "/our-pricing",
      "/features.html",
      "/product.html",
      "/solutions.html",
      "/feautures",
      "/pricng",
      "/priceing",
      "/our-pricing.html",
      "/pricing-plans.html",
      "/pricig",
      "/featrues",
      "/products.html",
      "/prodcut",
      "/featues",
      "/feautres",
      "/prodcuts",
      "/solutons",
      "/soulutions",
      "/pricng.html",
      "/pricing/plans",
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
      "/homepage",
      "/our-values",
      "/our-vision",
      "/meet-our-team",
      "/now-hiring",
      "/about-page",
      "/the-team",
      "/our-founders",
      "/join-the-team",
      "/front-page",
      "/the-company",
      "/mission-page",
      "/about.html",
      "/about-us.html",
      "/company.html",
      "/home.html",
      "/default.html",
      "/whoweare",
      "/career",
      "/careers.html",
      "/aboutus.html",
      "/compnay",
      "/index.htm",
      "/ourstory",
      "/abotu",
      "/abuot",
      "/comapny",
      "/carreers",
      "/homepage.html",
      "/carrers",
      "/home-page.html",
      "/who-we-are.html",
      "/whoweare.html",
      "/our-story.html",
      "/old-home",
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
    ...["/sitemap", "/site-map", "/sitemap-xml", "/xml-sitemap", "/map", "/html-sitemap", "/xml-map", "/sitemap-html", "/site_map", "/sitemap-index", "/sitemaps", "/sitemap.txt", "/sitemap-index.xml", "/sitemap.html", "/site-map.html", "/site-map.xml", "/sitemap_index.xml", "/sitemap.xml.gz", "/google-sitemap", "/sitemap.htm", "/sitemapxml", "/site_map.html", "/sitemaps.html", "/sitemap_xml", "/xmlsitemap", "/googlesitemap", "/wp-sitemap.xml", "/page-sitemap.xml", "/post-sitemap.xml"].map((source) => ({
      source,
      destination: SITEMAP_HREF,
      permanent: true,
    })),
  ];
}
