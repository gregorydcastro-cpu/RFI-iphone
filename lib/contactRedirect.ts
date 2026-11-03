/**
 * /contact, /help, /faq, /contact-us, /support-center, /docs, /status,
 * /blog, /changelog, /news, /press, /roadmap, /guides, /resources,
 * /case-studies, /testimonials, /webinar, and /events have no page. Each
 * is a permanent move straight to the public support page, not to another
 * alias. Next.js treats permanent as HTTP 308.
 * Each source is that exact path. A longer path such as /blog/post is not a match.
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
  ].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
