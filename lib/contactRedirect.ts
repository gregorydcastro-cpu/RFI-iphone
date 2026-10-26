/**
 * /contact used to 404. It is a permanent move to the public support page.
 * Next.js treats permanent as HTTP 308.
 */

export function contactRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    {
      source: "/contact",
      destination: "/support",
      permanent: true,
    },
  ];
}
