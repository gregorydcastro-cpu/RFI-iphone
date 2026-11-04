/**
 * Legal aliases have no page. /legal, /tos, /terms-of-service, /eula,
 * /refund, /refunds, /dmca, /imprint, /accessibility, /legal/terms, /sla,
 * /terms-and-conditions, /acceptable-use, /aup, /copyright, and /trademarks
 * move to the terms page. /privacy-policy, /cookies, /cookie-policy,
 * /security, /trust, /gdpr, /ccpa, /legal/privacy, /privacy-notice,
 * /legal/cookies, /subprocessors, and /dpa move to the privacy page.
 * Each points at that page, not at another alias.
 * /legal stays a move to /terms. /legal/terms, /legal/privacy, and
 * /legal/cookies are exact paths, so they do not match /legal or anything
 * longer.
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
    ...[
      "/legal",
      "/tos",
      "/terms-of-service",
      "/eula",
      "/refund",
      "/refunds",
      "/dmca",
      "/imprint",
      "/accessibility",
      "/legal/terms",
      "/sla",
      "/terms-and-conditions",
      "/acceptable-use",
      "/aup",
      "/copyright",
      "/trademarks",
    ].map((source) => ({
      source,
      destination: TERMS_HREF,
      permanent: true,
    })),
    ...[
      "/privacy-policy",
      "/cookies",
      "/cookie-policy",
      "/security",
      "/trust",
      "/gdpr",
      "/ccpa",
      "/legal/privacy",
      "/privacy-notice",
      "/legal/cookies",
      "/subprocessors",
      "/dpa",
    ].map((source) => ({
      source,
      destination: PRIVACY_HREF,
      permanent: true,
    })),
  ];
}
