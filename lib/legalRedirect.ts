/**
 * Legal aliases have no page. /legal, /tos, /terms-of-service, and /eula
 * move to the terms page. /privacy-policy, /cookies, and /cookie-policy
 * move to the privacy page. Each points at that page, not at another alias.
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
    ...["/legal", "/tos", "/terms-of-service", "/eula"].map((source) => ({
      source,
      destination: TERMS_HREF,
      permanent: true,
    })),
    ...["/privacy-policy", "/cookies", "/cookie-policy"].map((source) => ({
      source,
      destination: PRIVACY_HREF,
      permanent: true,
    })),
  ];
}
