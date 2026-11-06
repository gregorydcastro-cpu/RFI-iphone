/**
 * /contact, /help, /faq, /contact-us, /support-center, /docs, /status,
 * /blog, /changelog, /news, /press, /roadmap, /guides, /resources,
 * /case-studies, /testimonials, /webinar, /events, /contact-sales, /sales,
 * /enterprise, /community, /forum, /developers, /api-docs, /help-center,
 * /knowledge-base, /kb, /tutorials, /academy, /training, /webinars, /video,
 * /videos, /newsletter, /podcast, /media, /media-kit, /press-kit, /brand,
 * /talk-to-sales, /sales-contact, /helpdesk, /ticket, /submit-ticket,
 * /feedback, /report-bug, /bug-report, /feature-request, /ideas,
 * /community-forum, /contact/support, /support/contact, /developer,
 * /api-reference, /status-page, /uptime, /system-status, /contactus,
 * /get-in-touch, /reach-us, /customer-support, /customer-service,
 * /knowledgebase, /faqs, /how-to, /documentation, /manual, /billing-help,
 * and /whats-new have no page.
 * Each is a permanent move straight to the public support page, not to
 * another alias. Next.js treats permanent as HTTP 308.
 * Each source is that exact path. A longer path such as /blog/post is not
 * a match. /api-docs does not match /api or /api/docs.
 * /help-center does not match /help. /knowledge-base does not match /kb.
 * /webinars does not match /webinar. /videos does not match /video.
 * /media-kit does not match /media. /press-kit does not match /press.
 * /contact/support and /support/contact do not match /contact or /support.
 * /developer does not match /developers. /community-forum does not match
 * /community. /status-page and /system-status do not match /status.
 * /sales-contact does not match /sales. /talk-to-sales does not match
 * /contact-sales. /api-reference does not match /api-docs, /api, or
 * /api/docs. /bug-report does not match /report-bug. /submit-ticket does
 * not match /ticket.
 * /contactus does not match /contact or /contact-us. /faqs does not match
 * /faq. /knowledgebase does not match /knowledge-base or /kb.
 * /customer-support does not match /customer-service or /support.
 * /how-to does not match /how-it-works. /documentation does not match
 * /docs. /billing-help does not match /billing. /whats-new does not match
 * /news. /get-in-touch and /reach-us do not match /contact.
 * /contact-form, /contact-us-form, /support-ticket, /help-desk,
 * /helpdesk-support, /customer-care, /care-center, /ask, /ask-us,
 * /talk-to-us, /message-us, /write-us, /email-us, /call-us, /knowledge,
 * /service-desk, /faq-page, /common-questions, /troubleshooting, /fix-it,
 * /howto, /blog-posts, /press-release, /newsroom, /updates, and
 * /api-status use that same hop. /contact-form does not match /contact.
 * /contact-us-form does not match /contact-us. /support-ticket does not
 * match /ticket or /submit-ticket. /help-desk does not match /help,
 * /help-center, or /helpdesk. /helpdesk-support does not match /helpdesk.
 * /customer-care does not match /customer-service or /customer-support.
 * /ask does not match /ask-us. /knowledge does not match /knowledge-base,
 * /knowledgebase, or /kb. /faq-page does not match /faq or /faqs.
 * /howto does not match /how-to. /blog-posts does not match /blog.
 * /press-release does not match /press. /newsroom does not match /news.
 * /updates does not match /whats-new. /api-status does not match /status,
 * /api, /api-docs, or /api/docs.
 * /contact-support, /get-support, /tech-support, /technical-support,
 * /sales-team, /sales-inquiry, /support-home, /client-support,
 * /api-docs-page, /developer-docs, /help-center-home, /brand-assets,
 * /kb-home, /knowledge-base-home, /faq-center, /brand-guidelines, and
 * /media-assets use that same hop. /contact-support does not match
 * /contact or /support. /get-support does not match /support.
 * /tech-support and /technical-support do not match each other or
 * /support. /sales-team and /sales-inquiry do not match /sales.
 * /support-home does not match /support. /client-support does not match
 * /customer-support. /api-docs-page does not match /api-docs, /api, or
 * /api/docs. /developer-docs does not match /developer, /developers, or
 * /docs. /help-center-home does not match /help-center or /help.
 * /brand-assets and /brand-guidelines do not match /brand.
 * /kb-home does not match /kb. /knowledge-base-home does not match
 * /knowledge-base. /faq-center does not match /faq. /media-assets does
 * not match /media.
 */

const SUPPORT_HREF = "/support";

export function contactRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    "/contact",
    "/help",
    "/faq",
    "/contact-us",
    "/support-center",
    "/docs",
    "/status",
    "/blog",
    "/changelog",
    "/news",
    "/press",
    "/roadmap",
    "/guides",
    "/resources",
    "/case-studies",
    "/testimonials",
    "/webinar",
    "/events",
    "/contact-sales",
    "/sales",
    "/enterprise",
    "/community",
    "/forum",
    "/developers",
    "/api-docs",
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
    "/media-assets",
  ].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
