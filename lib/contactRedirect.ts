/**
 * /contact, /help, and /faq used to 404. Each is a permanent move to the
 * public support page. Next.js treats permanent as HTTP 308.
 */

const SUPPORT_HREF = "/support";

export function contactRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return ["/contact", "/help", "/faq"].map((source) => ({
    source,
    destination: SUPPORT_HREF,
    permanent: true,
  }));
}
