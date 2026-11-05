/**
 * Legal aliases have no page. /legal, /tos, /terms-of-service, /eula,
 * /refund, /refunds, /dmca, /imprint, /accessibility, /legal/terms, /sla,
 * /terms-and-conditions, /acceptable-use, /aup, /copyright, /trademarks,
 * /legal-notice, /disclaimer, /accessibility-statement, and /terms-of-use
 * move to the terms page. /privacy-policy, /cookies, /cookie-policy,
 * /security, /trust, /gdpr, /ccpa, /legal/privacy, /privacy-notice,
 * /legal/cookies, /subprocessors, /dpa, /cookie-settings, /do-not-sell,
 * /privacy-choices, /your-privacy-choices, /security-policy,
 * /responsible-disclosure, /bug-bounty, /vulnerability-disclosure,
 * /data-policy, and /data-processing move to the privacy page.
 * Each points at that page, not at another alias.
 * /legal stays a move to /terms. /legal/terms, /legal/privacy, and
 * /legal/cookies are exact paths, so they do not match /legal or anything
 * longer.
 * /legal-notice does not match /legal. /accessibility-statement does not
 * match /accessibility. /cookie-settings does not match /cookies.
 * /security-policy does not match /security or /security.txt.
 * /privacy-choices does not match /your-privacy-choices.
 * /terms-of-use does not match /terms. /data-policy does not match
 * /data-processing. Neither matches /privacy.
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
      "/legal-notice",
      "/disclaimer",
      "/accessibility-statement",
      "/terms-of-use",
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
      "/cookie-settings",
      "/do-not-sell",
      "/privacy-choices",
      "/your-privacy-choices",
      "/security-policy",
      "/responsible-disclosure",
      "/bug-bounty",
      "/vulnerability-disclosure",
      "/data-policy",
      "/data-processing",
    ].map((source) => ({
      source,
      destination: PRIVACY_HREF,
      permanent: true,
    })),
  ];
}
