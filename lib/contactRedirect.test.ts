import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { contactRedirects } from "./contactRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("/contact, /help, /faq, /contact-us, /support-center, /docs, /status, /blog, /changelog, /news, /press, /roadmap, /guides, /resources, /case-studies, /testimonials, /webinar, /events, /contact-sales, /sales, /enterprise, /community, /forum, /developers, /api-docs, /help-center, /knowledge-base, /kb, /tutorials, /academy, /training, /webinars, /video, /videos, /newsletter, /podcast, /media, /media-kit, /press-kit, /brand, /talk-to-sales, /sales-contact, /helpdesk, /ticket, /submit-ticket, /feedback, /report-bug, /bug-report, /feature-request, /ideas, /community-forum, /contact/support, /support/contact, /developer, /api-reference, /status-page, /uptime, /system-status, /contactus, /get-in-touch, /reach-us, /customer-support, /customer-service, /knowledgebase, /faqs, /how-to, /documentation, /manual, /billing-help, and /whats-new permanently move to /support (308)", () => {
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
    {
      source: "/contact-sales",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/sales",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/enterprise",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/community",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/forum",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/developers",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/api-docs",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/help-center",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/knowledge-base",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/kb",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/tutorials",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/academy",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/training",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/webinars",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/video",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/videos",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/newsletter",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/podcast",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/media",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/media-kit",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/press-kit",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/brand",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/talk-to-sales",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/sales-contact",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/helpdesk",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/ticket",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/submit-ticket",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/feedback",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/report-bug",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/bug-report",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/feature-request",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/ideas",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/community-forum",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/contact/support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/support/contact",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/developer",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/api-reference",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/status-page",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/uptime",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/system-status",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/contactus",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/get-in-touch",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/reach-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/customer-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/customer-service",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/knowledgebase",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/faqs",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/how-to",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/documentation",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/manual",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/billing-help",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/whats-new",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/contact-form",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/contact-us-form",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/support-ticket",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/help-desk",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/helpdesk-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/customer-care",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/care-center",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/ask",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/ask-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/talk-to-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/message-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/write-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/email-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/call-us",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/knowledge",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/service-desk",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/faq-page",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/common-questions",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/troubleshooting",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/fix-it",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/howto",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/blog-posts",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/press-release",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/newsroom",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/updates",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/api-status",
      destination: "/support",
      permanent: true,
    },

    {
      source: "/contact-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/get-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/tech-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/technical-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/sales-team",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/sales-inquiry",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/support-home",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/client-support",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/api-docs-page",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/developer-docs",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/help-center-home",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/brand-assets",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/kb-home",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/knowledge-base-home",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/faq-center",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/brand-guidelines",
      destination: "/support",
      permanent: true,
    },
    {
      source: "/media-assets",
      destination: "/support",
      permanent: true,
    },
  ]);
  const sources = new Set(contactRedirects().map((redirect) => redirect.source));
  for (const redirect of contactRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.equal(redirect.permanent ? 308 : 307, 308);
    assert.equal(redirect.destination, "/support");
    assert.equal(sources.has(redirect.destination), false, redirect.source);
    const nested = redirect.source.slice(1).includes("/");
    if (nested) {
      assert.ok(
        redirect.source === "/contact/support" || redirect.source === "/support/contact",
        redirect.source,
      );
    }
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
  assert.equal(bySource.get("/contact-sales"), "/support");
  assert.equal(bySource.get("/sales"), bySource.get("/contact"));
  assert.equal(bySource.get("/enterprise"), bySource.get("/contact"));
  assert.equal(bySource.get("/community"), bySource.get("/contact"));
  assert.equal(bySource.get("/forum"), bySource.get("/contact"));
  assert.equal(bySource.get("/developers"), bySource.get("/contact"));
  assert.equal(bySource.get("/api-docs"), "/support");
  assert.equal(bySource.get("/api-docs"), bySource.get("/contact"));
  for (const source of [
    "/help-center",
    "/knowledge-base",
    "/kb",
    "/tutorials",
    "/academy",
    "/training",
    "/webinars",
    "/video",
    "/videos",
    "/newsletter",
    "/podcast",
    "/media",
    "/media-kit",
    "/press-kit",
    "/brand",
  ]) {
    const redirect = contactRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/support", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/support", source);
    assert.equal(bySource.get(source), bySource.get("/contact"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
  }
  assert.equal(bySource.get("/webinars"), bySource.get("/webinar"));
  assert.notEqual(bySource.has("/webinars"), false);
  assert.equal(bySource.get("/videos"), bySource.get("/video"));
  assert.equal(bySource.get("/media-kit"), bySource.get("/media"));
  assert.equal(bySource.get("/press-kit"), bySource.get("/press"));
  assert.equal(bySource.get("/help-center"), bySource.get("/help"));
  assert.equal(bySource.get("/knowledge-base"), bySource.get("/kb"));
  assert.equal(bySource.has("/webinar/extra"), false);
  assert.equal(bySource.has("/contact-sales/extra"), false);
  assert.equal(bySource.has("/sales/extra"), false);
  assert.equal(bySource.has("/api-docs/extra"), false);
  assert.equal(bySource.has("/api/docs"), false);
  assert.equal(bySource.has("/developers/docs"), false);
  assert.equal(bySource.has("/guides/post"), false);
  assert.equal(bySource.has("/web"), false);
  for (const source of [
    "/talk-to-sales",
    "/sales-contact",
    "/helpdesk",
    "/ticket",
    "/submit-ticket",
    "/feedback",
    "/report-bug",
    "/bug-report",
    "/feature-request",
    "/ideas",
    "/community-forum",
    "/contact/support",
    "/support/contact",
    "/developer",
    "/api-reference",
    "/status-page",
    "/uptime",
    "/system-status",
  ]) {
    const redirect = contactRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/support", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/support", source);
    assert.equal(bySource.get(source), bySource.get("/contact"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
  }
  assert.equal(bySource.get("/developer"), bySource.get("/developers"));
  assert.equal(bySource.has("/developer/extra"), false);
  assert.equal(bySource.get("/community-forum"), bySource.get("/community"));
  assert.equal(bySource.has("/community/forum"), false);
  assert.equal(bySource.get("/status-page"), bySource.get("/status"));
  assert.equal(bySource.get("/system-status"), bySource.get("/status"));
  assert.equal(bySource.has("/status/page"), false);
  assert.equal(bySource.get("/sales-contact"), bySource.get("/sales"));
  assert.equal(bySource.has("/sales/contact"), false);
  assert.equal(bySource.get("/talk-to-sales"), bySource.get("/contact-sales"));
  assert.equal(bySource.get("/api-reference"), bySource.get("/api-docs"));
  assert.equal(bySource.has("/api/reference"), false);
  assert.equal(bySource.get("/bug-report"), bySource.get("/report-bug"));
  assert.equal(bySource.get("/submit-ticket"), bySource.get("/ticket"));
  assert.equal(bySource.get("/contact/support"), bySource.get("/contact"));
  assert.equal(bySource.get("/support/contact"), bySource.get("/contact"));
  assert.equal(bySource.has("/contact"), true);
  assert.equal(bySource.has("/support"), false);
  assert.equal(bySource.has("/contact/extra"), false);
  assert.equal(bySource.has("/support/extra"), false);
  for (const source of [
    "/contactus",
    "/get-in-touch",
    "/reach-us",
    "/customer-support",
    "/customer-service",
    "/knowledgebase",
    "/faqs",
    "/how-to",
    "/documentation",
    "/manual",
    "/billing-help",
    "/whats-new",
  ]) {
    const redirect = contactRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/support", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/support", source);
    assert.equal(bySource.get(source), bySource.get("/contact"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/contactus"), bySource.get("/contact-us"));
  assert.equal(bySource.has("/contact"), true);
  assert.equal(bySource.has("/contact-us"), true);
  assert.equal(bySource.get("/faqs"), bySource.get("/faq"));
  assert.equal(bySource.has("/faq"), true);
  assert.equal(bySource.get("/knowledgebase"), bySource.get("/knowledge-base"));
  assert.equal(bySource.get("/knowledgebase"), bySource.get("/kb"));
  assert.equal(bySource.get("/customer-support"), bySource.get("/customer-service"));
  assert.equal(bySource.has("/customer-support/extra"), false);
  assert.equal(bySource.get("/documentation"), bySource.get("/docs"));
  assert.equal(bySource.get("/whats-new"), bySource.get("/news"));
  assert.equal(bySource.get("/how-to"), bySource.get("/help"));
  assert.equal(bySource.has("/how-it-works"), false);
  assert.equal(bySource.get("/billing-help"), "/support");
  assert.equal(bySource.has("/billing"), false);
  assert.equal(bySource.has("/subscribe"), false);
  assert.equal(bySource.has("/subscription"), false);
  assert.equal(bySource.get("/get-in-touch"), bySource.get("/contact"));
  assert.equal(bySource.get("/reach-us"), bySource.get("/contact-us"));
  for (const source of [
    "/contact-form",
    "/contact-us-form",
    "/support-ticket",
    "/help-desk",
    "/helpdesk-support",
    "/customer-care",
    "/care-center",
    "/ask",
    "/ask-us",
    "/talk-to-us",
    "/message-us",
    "/write-us",
    "/email-us",
    "/call-us",
    "/knowledge",
    "/service-desk",
    "/faq-page",
    "/common-questions",
    "/troubleshooting",
    "/fix-it",
    "/howto",
    "/blog-posts",
    "/press-release",
    "/newsroom",
    "/updates",
    "/api-status",
  ]) {
    const redirect = contactRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/support", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/support", source);
    assert.equal(bySource.get(source), bySource.get("/contact"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/contact-form"), bySource.get("/contact"));
  assert.equal(bySource.has("/contact"), true);
  assert.equal(bySource.get("/contact-us-form"), bySource.get("/contact-us"));
  assert.equal(bySource.get("/support-ticket"), bySource.get("/ticket"));
  assert.equal(bySource.get("/help-desk"), bySource.get("/help"));
  assert.equal(bySource.has("/helpdesk"), true);
  assert.equal(bySource.get("/helpdesk-support"), bySource.get("/helpdesk"));
  assert.equal(bySource.get("/customer-care"), bySource.get("/customer-service"));
  assert.equal(bySource.get("/ask"), bySource.get("/ask-us"));
  assert.equal(bySource.get("/knowledge"), bySource.get("/knowledge-base"));
  assert.equal(bySource.get("/knowledge"), bySource.get("/kb"));
  assert.equal(bySource.get("/faq-page"), bySource.get("/faq"));
  assert.equal(bySource.get("/howto"), bySource.get("/how-to"));
  assert.equal(bySource.get("/blog-posts"), bySource.get("/blog"));
  assert.equal(bySource.get("/press-release"), bySource.get("/press"));
  assert.equal(bySource.get("/newsroom"), bySource.get("/news"));
  assert.equal(bySource.get("/updates"), bySource.get("/whats-new"));
  assert.equal(bySource.get("/api-status"), bySource.get("/status"));
  assert.equal(bySource.has("/api"), false);
  assert.equal(bySource.has("/api/docs"), false);
  assert.equal(bySource.has("/api-docs"), true);
  for (const source of [
    "/contact-support",
    "/get-support",
    "/tech-support",
    "/technical-support",
    "/sales-team",
    "/sales-inquiry",
    "/support-home",
    "/client-support",
    "/api-docs-page",
    "/developer-docs",
    "/help-center-home",
    "/brand-assets",
    "/kb-home",
    "/knowledge-base-home",
    "/faq-center",
    "/brand-guidelines",
    "/media-assets"
  ]) {
    const redirect = contactRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/support", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/support", source);
    assert.equal(bySource.get(source), bySource.get("/contact"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/contact-support"), bySource.get("/contact"));
  assert.equal(bySource.has("/support"), false);
  assert.equal(bySource.get("/get-support"), bySource.get("/support-home"));
  assert.equal(bySource.get("/tech-support"), bySource.get("/technical-support"));
  assert.equal(bySource.get("/sales-team"), bySource.get("/sales"));
  assert.equal(bySource.get("/sales-inquiry"), bySource.get("/sales-contact"));
  assert.equal(bySource.get("/client-support"), bySource.get("/customer-support"));
  assert.equal(bySource.get("/api-docs-page"), bySource.get("/api-docs"));
  assert.equal(bySource.has("/api/docs"), false);
  assert.equal(bySource.get("/developer-docs"), bySource.get("/developer"));
  assert.equal(bySource.has("/developers"), true);
  assert.equal(bySource.get("/help-center-home"), bySource.get("/help-center"));
  assert.equal(bySource.get("/brand-assets"), bySource.get("/brand"));
  assert.equal(bySource.get("/brand-guidelines"), bySource.get("/brand"));
  assert.equal(bySource.get("/kb-home"), bySource.get("/kb"));
  assert.equal(bySource.get("/knowledge-base-home"), bySource.get("/knowledge-base"));
  assert.equal(bySource.get("/faq-center"), bySource.get("/faq"));
  assert.equal(bySource.get("/media-assets"), bySource.get("/media"));
  assert.equal(bySource.has("/contact-support/extra"), false);
  assert.equal(bySource.has("/api-docs-page/extra"), false);
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
    "/subscription",
    "/upgrade",
    "/checkout",
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
    "/affiliates",
  ]) {
    assert.equal(sources.has(path), false, path);
  }
  assert.equal(sources.has("/schedule"), false);
  assert.equal(sources.has("/affiliate"), false);

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.contactRedirects\(\)/);
  assert.doesNotMatch(config, /\/privacy|\/terms|\/support|\/help|\/faq|\/docs|\/status|\/blog|\/changelog|\/news|\/press|\/roadmap|\/guides|\/resources|\/case-studies|\/testimonials|\/webinar|\/events|\/contact-sales|\/sales|\/enterprise|\/community|\/forum|\/developers|\/api-docs|\/help-center|\/knowledge-base|\/kb|\/tutorials|\/academy|\/training|\/webinars|\/videos|\/video|\/newsletter|\/podcast|\/media-kit|\/media|\/press-kit|\/brand|\/talk-to-sales|\/sales-contact|\/helpdesk|\/submit-ticket|\/ticket|\/feedback|\/report-bug|\/bug-report|\/feature-request|\/ideas|\/community-forum|\/contact\/support|\/support\/contact|\/developer|\/api-reference|\/status-page|\/system-status|\/uptime|\/contactus|\/get-in-touch|\/reach-us|\/customer-support|\/customer-service|\/knowledgebase|\/faqs|\/how-to|\/documentation|\/manual|\/billing-help|\/whats-new|\/contact-form|\/contact-us-form|\/support-ticket|\/help-desk|\/helpdesk-support|\/customer-care|\/care-center|\/ask-us|\/ask(?![A-Za-z0-9_-])|\/talk-to-us|\/message-us|\/write-us|\/email-us|\/call-us|\/knowledge(?!-|b)|\/service-desk|\/faq-page|\/common-questions|\/troubleshooting|\/fix-it|\/howto|\/blog-posts|\/press-release|\/newsroom|\/updates|\/api-status|\/contact-support|\/get-support|\/tech-support|\/technical-support|\/sales-team|\/sales-inquiry|\/support-home|\/client-support|\/api-docs-page|\/developer-docs|\/help-center-home|\/brand-assets|\/kb-home|\/knowledge-base-home|\/faq-center|\/brand-guidelines|\/media-assets/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/contact|\/help|\/faq|\/contact-us|\/support-center|\/docs|\/status|\/blog|\/changelog|\/news|\/press|\/roadmap|\/guides|\/resources|\/case-studies|\/testimonials|\/webinar|\/events|\/contact-sales|\/sales|\/enterprise|\/community|\/forum|\/developers|\/api-docs|\/help-center|\/knowledge-base|\/kb|\/tutorials|\/academy|\/training|\/webinars|\/videos|\/video|\/newsletter|\/podcast|\/media-kit|\/media|\/press-kit|\/brand|\/talk-to-sales|\/sales-contact|\/helpdesk|\/submit-ticket|\/ticket|\/feedback|\/report-bug|\/bug-report|\/feature-request|\/ideas|\/community-forum|\/contact\/support|\/support\/contact|\/developer|\/api-reference|\/status-page|\/system-status|\/uptime|\/contactus|\/get-in-touch|\/reach-us|\/customer-support|\/customer-service|\/knowledgebase|\/faqs|\/how-to|\/documentation|\/manual|\/billing-help|\/whats-new|\/contact-form|\/contact-us-form|\/support-ticket|\/help-desk|\/helpdesk-support|\/customer-care|\/care-center|\/ask-us|\/ask(?![A-Za-z0-9_-])|\/talk-to-us|\/message-us|\/write-us|\/email-us|\/call-us|\/knowledge(?!-|b)|\/service-desk|\/faq-page|\/common-questions|\/troubleshooting|\/fix-it|\/howto|\/blog-posts|\/press-release|\/newsroom|\/updates|\/api-status|\/contact-support|\/get-support|\/tech-support|\/technical-support|\/sales-team|\/sales-inquiry|\/support-home|\/client-support|\/api-docs-page|\/developer-docs|\/help-center-home|\/brand-assets|\/kb-home|\/knowledge-base-home|\/faq-center|\/brand-guidelines|\/media-assets/);
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
    "app/contact-sales/page.tsx",
    "app/contact-sales/route.ts",
    "app/sales/page.tsx",
    "app/sales/route.ts",
    "app/enterprise/page.tsx",
    "app/enterprise/route.ts",
    "app/community/page.tsx",
    "app/community/route.ts",
    "app/forum/page.tsx",
    "app/forum/route.ts",
    "app/developers/page.tsx",
    "app/developers/route.ts",
    "app/api-docs/page.tsx",
    "app/api-docs/route.ts",
    "public/contact-sales",
    "public/contact-sales.html",
    "public/sales",
    "public/sales.html",
    "public/enterprise",
    "public/enterprise.html",
    "public/community",
    "public/community.html",
    "public/forum",
    "public/forum.html",
    "public/developers",
    "public/developers.html",
    "public/api-docs",
    "public/api-docs.html",
    "app/help-center/page.tsx",
    "app/help-center/route.ts",
    "app/knowledge-base/page.tsx",
    "app/knowledge-base/route.ts",
    "app/kb/page.tsx",
    "app/kb/route.ts",
    "app/tutorials/page.tsx",
    "app/tutorials/route.ts",
    "app/academy/page.tsx",
    "app/academy/route.ts",
    "app/training/page.tsx",
    "app/training/route.ts",
    "app/webinars/page.tsx",
    "app/webinars/route.ts",
    "app/video/page.tsx",
    "app/video/route.ts",
    "app/videos/page.tsx",
    "app/videos/route.ts",
    "app/newsletter/page.tsx",
    "app/newsletter/route.ts",
    "app/podcast/page.tsx",
    "app/podcast/route.ts",
    "app/media/page.tsx",
    "app/media/route.ts",
    "app/media-kit/page.tsx",
    "app/media-kit/route.ts",
    "app/press-kit/page.tsx",
    "app/press-kit/route.ts",
    "app/brand/page.tsx",
    "app/brand/route.ts",
    "public/help-center",
    "public/help-center.html",
    "public/knowledge-base",
    "public/knowledge-base.html",
    "public/kb",
    "public/kb.html",
    "public/tutorials",
    "public/tutorials.html",
    "public/academy",
    "public/academy.html",
    "public/training",
    "public/training.html",
    "public/webinars",
    "public/webinars.html",
    "public/video",
    "public/video.html",
    "public/videos",
    "public/videos.html",
    "public/newsletter",
    "public/newsletter.html",
    "public/podcast",
    "public/podcast.html",
    "public/media",
    "public/media.html",
    "public/media-kit",
    "public/media-kit.html",
    "public/press-kit",
    "public/press-kit.html",
    "public/brand",
    "public/brand.html",
    "app/talk-to-sales/page.tsx",
    "app/talk-to-sales/route.ts",
    "app/sales-contact/page.tsx",
    "app/sales-contact/route.ts",
    "app/helpdesk/page.tsx",
    "app/helpdesk/route.ts",
    "app/ticket/page.tsx",
    "app/ticket/route.ts",
    "app/submit-ticket/page.tsx",
    "app/submit-ticket/route.ts",
    "app/feedback/page.tsx",
    "app/feedback/route.ts",
    "app/report-bug/page.tsx",
    "app/report-bug/route.ts",
    "app/bug-report/page.tsx",
    "app/bug-report/route.ts",
    "app/feature-request/page.tsx",
    "app/feature-request/route.ts",
    "app/ideas/page.tsx",
    "app/ideas/route.ts",
    "app/community-forum/page.tsx",
    "app/community-forum/route.ts",
    "app/contact/support/page.tsx",
    "app/contact/support/route.ts",
    "app/support/contact/page.tsx",
    "app/support/contact/route.ts",
    "app/developer/page.tsx",
    "app/developer/route.ts",
    "app/api-reference/page.tsx",
    "app/api-reference/route.ts",
    "app/status-page/page.tsx",
    "app/status-page/route.ts",
    "app/uptime/page.tsx",
    "app/uptime/route.ts",
    "app/system-status/page.tsx",
    "app/system-status/route.ts",
    "public/talk-to-sales",
    "public/talk-to-sales.html",
    "public/sales-contact",
    "public/sales-contact.html",
    "public/helpdesk",
    "public/helpdesk.html",
    "public/ticket",
    "public/ticket.html",
    "public/submit-ticket",
    "public/submit-ticket.html",
    "public/feedback",
    "public/feedback.html",
    "public/report-bug",
    "public/report-bug.html",
    "public/bug-report",
    "public/bug-report.html",
    "public/feature-request",
    "public/feature-request.html",
    "public/ideas",
    "public/ideas.html",
    "public/community-forum",
    "public/community-forum.html",
    "public/contact/support",
    "public/contact/support.html",
    "public/support/contact",
    "public/support/contact.html",
    "public/developer",
    "public/developer.html",
    "public/api-reference",
    "public/api-reference.html",
    "public/status-page",
    "public/status-page.html",
    "public/uptime",
    "public/uptime.html",
    "public/system-status",
    "public/system-status.html",
    "app/contactus/page.tsx",
    "app/contactus/route.ts",
    "app/get-in-touch/page.tsx",
    "app/get-in-touch/route.ts",
    "app/reach-us/page.tsx",
    "app/reach-us/route.ts",
    "app/customer-support/page.tsx",
    "app/customer-support/route.ts",
    "app/customer-service/page.tsx",
    "app/customer-service/route.ts",
    "app/knowledgebase/page.tsx",
    "app/knowledgebase/route.ts",
    "app/faqs/page.tsx",
    "app/faqs/route.ts",
    "app/how-to/page.tsx",
    "app/how-to/route.ts",
    "app/documentation/page.tsx",
    "app/documentation/route.ts",
    "app/manual/page.tsx",
    "app/manual/route.ts",
    "app/billing-help/page.tsx",
    "app/billing-help/route.ts",
    "app/whats-new/page.tsx",
    "app/whats-new/route.ts",
    "public/contactus",
    "public/contactus.html",
    "public/get-in-touch",
    "public/get-in-touch.html",
    "public/reach-us",
    "public/reach-us.html",
    "public/customer-support",
    "public/customer-support.html",
    "public/customer-service",
    "public/customer-service.html",
    "public/knowledgebase",
    "public/knowledgebase.html",
    "public/faqs",
    "public/faqs.html",
    "public/how-to",
    "public/how-to.html",
    "public/documentation",
    "public/documentation.html",
    "public/manual",
    "public/manual.html",
    "public/billing-help",
    "public/billing-help.html",
    "public/whats-new",
    "public/whats-new.html",
    "app/contact-form/page.tsx",
    "app/contact-form/route.ts",
    "app/contact-us-form/page.tsx",
    "app/contact-us-form/route.ts",
    "app/support-ticket/page.tsx",
    "app/support-ticket/route.ts",
    "app/help-desk/page.tsx",
    "app/help-desk/route.ts",
    "app/helpdesk-support/page.tsx",
    "app/helpdesk-support/route.ts",
    "app/customer-care/page.tsx",
    "app/customer-care/route.ts",
    "app/care-center/page.tsx",
    "app/care-center/route.ts",
    "app/ask/page.tsx",
    "app/ask/route.ts",
    "app/ask-us/page.tsx",
    "app/ask-us/route.ts",
    "app/talk-to-us/page.tsx",
    "app/talk-to-us/route.ts",
    "app/message-us/page.tsx",
    "app/message-us/route.ts",
    "app/write-us/page.tsx",
    "app/write-us/route.ts",
    "app/email-us/page.tsx",
    "app/email-us/route.ts",
    "app/call-us/page.tsx",
    "app/call-us/route.ts",
    "app/knowledge/page.tsx",
    "app/knowledge/route.ts",
    "app/service-desk/page.tsx",
    "app/service-desk/route.ts",
    "app/faq-page/page.tsx",
    "app/faq-page/route.ts",
    "app/common-questions/page.tsx",
    "app/common-questions/route.ts",
    "app/troubleshooting/page.tsx",
    "app/troubleshooting/route.ts",
    "app/fix-it/page.tsx",
    "app/fix-it/route.ts",
    "app/howto/page.tsx",
    "app/howto/route.ts",
    "app/blog-posts/page.tsx",
    "app/blog-posts/route.ts",
    "app/press-release/page.tsx",
    "app/press-release/route.ts",
    "app/newsroom/page.tsx",
    "app/newsroom/route.ts",
    "app/updates/page.tsx",
    "app/updates/route.ts",
    "app/api-status/page.tsx",
    "app/api-status/route.ts",
    "public/contact-form",
    "public/contact-form.html",
    "public/contact-us-form",
    "public/contact-us-form.html",
    "public/support-ticket",
    "public/support-ticket.html",
    "public/help-desk",
    "public/help-desk.html",
    "public/helpdesk-support",
    "public/helpdesk-support.html",
    "public/customer-care",
    "public/customer-care.html",
    "public/care-center",
    "public/care-center.html",
    "public/ask",
    "public/ask.html",
    "public/ask-us",
    "public/ask-us.html",
    "public/talk-to-us",
    "public/talk-to-us.html",
    "public/message-us",
    "public/message-us.html",
    "public/write-us",
    "public/write-us.html",
    "public/email-us",
    "public/email-us.html",
    "public/call-us",
    "public/call-us.html",
    "public/knowledge",
    "public/knowledge.html",
    "public/service-desk",
    "public/service-desk.html",
    "public/faq-page",
    "public/faq-page.html",
    "public/common-questions",
    "public/common-questions.html",
    "public/troubleshooting",
    "public/troubleshooting.html",
    "public/fix-it",
    "public/fix-it.html",
    "public/howto",
    "public/howto.html",
    "public/blog-posts",
    "public/blog-posts.html",
    "public/press-release",
    "public/press-release.html",
    "public/newsroom",
    "public/newsroom.html",
    "public/updates",
    "public/updates.html",
    "public/api-status",
    "public/api-status.html",
    "app/pay/page.tsx",
    "app/pay/route.ts",
    "app/webhook/page.tsx",
    "app/webhook/route.ts",
    "app/wp-admin/page.tsx",
    "app/wp-admin/route.ts",
    "public/pay",
    "public/pay.html",
    "public/webhook",
    "public/webhook.html",
    "app/subscription/page.tsx",
    "app/subscription/route.ts",
    "public/subscription",
    "public/subscription.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
  for (const name of [
    "contact-support",
    "get-support",
    "tech-support",
    "technical-support",
    "sales-team",
    "sales-inquiry",
    "support-home",
    "client-support",
    "api-docs-page",
    "developer-docs",
    "help-center-home",
    "brand-assets",
    "kb-home",
    "knowledge-base-home",
    "faq-center",
    "brand-guidelines",
    "media-assets"
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
});
