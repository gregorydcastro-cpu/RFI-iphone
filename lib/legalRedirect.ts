/**
 * Legal aliases have no page. /legal, /tos, and /terms-of-service move
 * to the terms page. /privacy-policy moves to the privacy page.
 * Next.js treats permanent as HTTP 308.
 */

const TERMS_HREF = "/terms";
const PRIVACY_HREF = "/privacy";

export function legalRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    ...["/legal", "/tos", "/terms-of-service"].map((source) => ({
      source,
      destination: TERMS_HREF,
      permanent: true,
    })),
    {
      source: "/privacy-policy",
      destination: PRIVACY_HREF,
      permanent: true,
    },
  ];
}
