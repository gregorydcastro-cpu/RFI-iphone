/**
 * /settings, /dashboard, /forgot-password, /reset-password, and /about
 * have no page. Each is a permanent move. Next.js treats permanent as HTTP 308.
 */

const HOME_HREF = "/";

export function retiredRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    {
      source: "/settings",
      destination: "/account",
      permanent: true,
    },
    {
      source: "/dashboard",
      destination: "/jobs",
      permanent: true,
    },
    ...["/forgot-password", "/reset-password", "/about"].map((source) => ({
      source,
      destination: HOME_HREF,
      permanent: true,
    })),
  ];
}
