/**
 * Legal aliases have no page. /legal, /tos, /terms-of-service, /eula,
 * /refund, /refunds, /dmca, /imprint, /accessibility, /legal/terms, /sla,
 * /terms-and-conditions, /acceptable-use, /aup, /copyright, /trademarks,
 * /legal-notice, /disclaimer, /accessibility-statement, /terms-of-use,
 * /termsandconditions, /tos-page, /eula-page, /dmca-policy, /refund-policy,
 * /a11y, and /wcag
 * move to the terms page. /privacy-policy, /cookies, /cookie-policy,
 * /security, /trust, /gdpr, /ccpa, /legal/privacy, /privacy-notice,
 * /legal/cookies, /subprocessors, /dpa, /cookie-settings, /do-not-sell,
 * /privacy-choices, /your-privacy-choices, /security-policy,
 * /responsible-disclosure, /bug-bounty, /vulnerability-disclosure,
 * /data-policy, /data-processing, /privacypolicy, /cookie,
 * /cookies-settings, /manage-cookies, /consent, and /privacy-center move
 * to the privacy page.
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
 * /termsandconditions does not match /terms or /terms-and-conditions.
 * /tos-page does not match /tos. /eula-page does not match /eula.
 * /dmca-policy does not match /dmca. /refund-policy does not match
 * /refund or /refunds. /a11y and /wcag do not match /accessibility.
 * /privacypolicy does not match /privacy or /privacy-policy. /cookie does
 * not match /cookies. /cookies-settings does not match /cookie-settings
 * or /cookies. /manage-cookies does not match /cookies. /consent does not
 * match /cookies. /privacy-center does not match /privacy.
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
      "/termsandconditions",
      "/tos-page",
      "/eula-page",
      "/dmca-policy",
      "/refund-policy",
      "/a11y",
      "/wcag",
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
      "/privacypolicy",
      "/cookie",
      "/cookies-settings",
      "/manage-cookies",
      "/consent",
      "/privacy-center",
    ].map((source) => ({
      source,
      destination: PRIVACY_HREF,
      permanent: true,
    })),
  ];
}
