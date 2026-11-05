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
  ].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
