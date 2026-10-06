/**
 * Social cards for public pages.
 * Absolute URLs use SITE_ORIGIN (https://www.gcfieldlog.com).
 * A room pack uses privatePackMetadata so the card does not
 * present that pack as a public page.
 */

import type { Metadata, MetadataRoute } from "next";
import { privacyCopy, supportCopy, termsCopy } from "./legalCopy.ts";
import {
  PUBLIC_PAGE_PATHS,
  ROBOTS_ALLOW,
  ROBOTS_DISALLOW,
  SITE_NAME,
  SITE_ORIGIN,
} from "./siteInfo.ts";

export const OG_IMAGE_PATH = "/opengraph-image";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_ALT =
  "GC Field Log. Punch in, open a job, pull a room pack.";
export const OG_TAGLINE_LINES = [
  "Punch in. Open a job.",
  "Pull a room pack.",
] as const;
export const OG_TAGLINE = OG_TAGLINE_LINES.join(" ");
export const OG_SAMPLE_JOBS = ["Maple Point", "Cedar Ridge"] as const;

/** Kept as the fallback description for signed-in routes. */
export const ROOT_DESCRIPTION =
  "Crew dashboard for gcfieldlog.com — job selection, room packs, zoomable sheets, and RFIs.";

export type PublicPagePath = (typeof PUBLIC_PAGE_PATHS)[number];

const PAGE_COPY: Record<PublicPagePath, { title: string; description: string }> =
  {
    "/": {
      title: SITE_NAME,
      description:
        "Punch in, open a job, and pull a room pack. Sample jobs are Maple Point and Cedar Ridge.",
    },
    "/pricing": {
      title: `Pricing — ${SITE_NAME}`,
      description: "Crew plan for GC Field Log. A free trial, then a monthly price.",
    },
    "/privacy": {
      title: `${privacyCopy().title} — ${SITE_NAME}`,
      description: privacyCopy().description,
    },
    "/terms": {
      title: `${termsCopy().title} — ${SITE_NAME}`,
      description: termsCopy().description,
    },
    "/support": {
      title: `${supportCopy().title} — ${SITE_NAME}`,
      description: supportCopy().description,
    },
  };

export function absolutePublicUrl(path: string): string {
  if (path === "/") return SITE_ORIGIN;
  return `${SITE_ORIGIN}${path}`;
}

export function ogImageUrl(): string {
  return `${SITE_ORIGIN}${OG_IMAGE_PATH}`;
}

function ogImage() {
  return {
    url: ogImageUrl(),
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    alt: OG_IMAGE_ALT,
  };
}

function socialMetadata(
  title: string,
  description: string,
  url?: string,
): Metadata {
  const image = ogImage();
  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      ...(url ? { url } : {}),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

/** Product card. No page URL, so a private route does not inherit a public canonical. */
export function rootMetadata(): Metadata {
  return {
    ...socialMetadata(SITE_NAME, ROOT_DESCRIPTION),
    metadataBase: new URL(SITE_ORIGIN),
    applicationName: SITE_NAME,
  };
}

export function publicPageMetadata(path: PublicPagePath): Metadata {
  const copy = PAGE_COPY[path];
  return socialMetadata(copy.title, copy.description, absolutePublicUrl(path));
}

/**
 * Room packs stay off the public card. No canonical URL and no sample-job pitch.
 */
export function privatePackMetadata(): Metadata {
  const title = SITE_NAME;
  const description = "Sign in to open a room pack.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export function publicSitemap(): MetadataRoute.Sitemap {
  return ROBOTS_ALLOW.map((path) => ({
    url: absolutePublicUrl(path),
  }));
}

export function sitemapPathnames(): string[] {
  return publicSitemap().map((entry) => new URL(entry.url).pathname);
}

export function isRobotsDisallowedPath(pathname: string): boolean {
  return ROBOTS_DISALLOW.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
