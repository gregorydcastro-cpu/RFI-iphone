/**
 * Retired paths have no page. Each is a permanent move.
 * Next.js treats permanent as HTTP 308.
 * Password-reset aliases share the destination /forgot-password already
 * uses. /about-us shares the destination /about already uses. Both are /.
 * /features shares the destination /plans already uses. That is /pricing.
 * /security.txt moves straight to /.well-known/security.txt.
 * /manifest.json and /site.webmanifest move straight to /manifest.webmanifest.
 */

const HOME_HREF = "/";
const ACCOUNT_HREF = "/account";
const JOBS_HREF = "/jobs";
const PRICING_HREF = "/pricing";
const SECURITY_TXT_HREF = "/.well-known/security.txt";
const MANIFEST_HREF = "/manifest.webmanifest";

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
    ...["/plans", "/features"].map((source) => ({
      source,
      destination: PRICING_HREF,
      permanent: true,
    })),
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
    {
      source: "/security.txt",
      destination: SECURITY_TXT_HREF,
      permanent: true,
    },
    ...["/manifest.json", "/site.webmanifest"].map((source) => ({
      source,
      destination: MANIFEST_HREF,
      permanent: true,
    })),
  ];
}
