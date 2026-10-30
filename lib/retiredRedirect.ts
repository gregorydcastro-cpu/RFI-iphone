/**
 * Retired paths have no page. Each is a permanent move.
 * Next.js treats permanent as HTTP 308.
 * Password-reset aliases share the destination /forgot-password already
 * uses. /about-us shares the destination /about already uses. Both are /.
 */

const HOME_HREF = "/";
const ACCOUNT_HREF = "/account";
const JOBS_HREF = "/jobs";
const PRICING_HREF = "/pricing";

export function retiredRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    ...["/settings", "/profile", "/me", "/account/settings", "/settings/profile"].map((source) => ({
      source,
      destination: ACCOUNT_HREF,
      permanent: true,
    })),
    ...["/dashboard", "/projects", "/project", "/app"].map((source) => ({
      source,
      destination: JOBS_HREF,
      permanent: true,
    })),
    {
      source: "/plans",
      destination: PRICING_HREF,
      permanent: true,
    },
    ...[
      "/forgot-password",
      "/reset-password",
      "/about",
      "/home",
      "/index.html",
      "/forgot",
      "/password-reset",
      "/reset",
      "/about-us",
    ].map((source) => ({
      source,
      destination: HOME_HREF,
      permanent: true,
    })),
  ];
}
