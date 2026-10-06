/**
 * FOR GREG'S REVIEW — draft, not legal advice.
 *
 * Fill the three placeholders in SITE_INFO. That is the only place
 * a business name, support contact, or effective date should be set.
 * Do not invent a legal entity, street address, phone, or email.
 */

export const REVIEW_NOTICE = "FOR GREG'S REVIEW — draft, not legal advice";

export const SITE_INFO = {
  businessName: "[FOR GREG'S REVIEW: business name]",
  supportEmail: "[FOR GREG'S REVIEW: support email]",
  effectiveDate: "[FOR GREG'S REVIEW: effective date]",
} as const;

/** Header / browser chrome. Matches --gline-primary in app/globals.css. */
export const SITE_THEME_COLOR = "#191616";

/** Page background. Matches --gline-gray-900 in app/globals.css. */
export const SITE_BACKGROUND_COLOR = "#111827";

export const SITE_NAME = "GC Field Log";

/** Production site. Same host as DEFAULT_APP_ORIGIN in lib/stripe.ts. */
export const SITE_ORIGIN = "https://www.gcfieldlog.com";

export const SITE_FOOTER_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
] as const;

/** Pages a signed-out visitor can open. Not a sign-in wall. */
export const PUBLIC_PAGE_PATHS = [
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/support",
] as const;

/**
 * robots.txt. Allow the public pages. Block the API and the
 * signed-in app areas. /pack stays disallowed so sheet packs are
 * not invited into a crawler. Humans can still open the demo.
 */
export const ROBOTS_ALLOW = [
  "/",
  "/pricing",
  "/privacy",
  "/terms",
  "/support",
] as const;

export const ROBOTS_DISALLOW = [
  "/api",
  "/account",
  "/jobs",
  "/time",
  "/share",
  "/invite",
  "/auth",
  "/pack",
] as const;

export function robotsRules(): {
  userAgent: string;
  allow: string[];
  disallow: string[];
} {
  return {
    userAgent: "*",
    allow: [...ROBOTS_ALLOW],
    disallow: [...ROBOTS_DISALLOW],
  };
}

export type WebManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: "any" | "maskable" | "monochrome";
};

export type WebManifest = {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  display: "standalone";
  background_color: string;
  theme_color: string;
  icons: WebManifestIcon[];
};

export function webManifest(): WebManifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "Crew dashboard for job selection, room packs, sheets, and RFIs.",
    start_url: "/",
    display: "standalone",
    background_color: SITE_BACKGROUND_COLOR,
    theme_color: SITE_THEME_COLOR,
    icons: [
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { src: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { src: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
