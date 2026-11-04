/**
 * /contact, /help, /faq, /contact-us, /support-center, /docs, /status,
 * /blog, /changelog, /news, /press, /roadmap, /guides, /resources,
 * /case-studies, /testimonials, /webinar, /events, /contact-sales, /sales,
 * /enterprise, /community, /forum, /developers, /api-docs, /help-center,
 * /knowledge-base, /kb, /tutorials, /academy, /training, /webinars, /video,
 * /videos, /newsletter, /podcast, /media, /media-kit, /press-kit, and /brand
 * have no page.
 * Each is a permanent move straight to the public support page, not to
 * another alias. Next.js treats permanent as HTTP 308.
 * Each source is that exact path. A longer path such as /blog/post is not
 * a match. /api-docs does not match /api or /api/docs.
 * /help-center does not match /help. /knowledge-base does not match /kb.
 * /webinars does not match /webinar. /videos does not match /video.
 * /media-kit does not match /media. /press-kit does not match /press.
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
  ].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
