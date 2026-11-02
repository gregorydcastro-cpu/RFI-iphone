/**
 * /contact, /help, /faq, /contact-us, /support-center, /docs, and /status
 * have no page. Each is a permanent move to the public support page.
 * Next.js treats permanent as HTTP 308.
 */

const SUPPORT_HREF = "/support";

export function contactRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return ["/contact", "/help", "/faq", "/contact-us", "/support-center", "/docs", "/status"].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
