/**
 * /legal has no page. It is a permanent move to the terms page.
 * Next.js treats permanent as HTTP 308.
 */

const TERMS_HREF = "/terms";

export function legalRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    {
      source: "/legal",
      destination: TERMS_HREF,
      permanent: true,
    },
  ];
}
