import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Metadata } from "next";
import { DEFAULT_APP_ORIGIN } from "./stripe.ts";
import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_SAMPLE_JOBS,
  OG_TAGLINE,
  OG_TAGLINE_LINES,
  ROOT_DESCRIPTION,
  isRobotsDisallowedPath,
  ogImageUrl,
  privatePackMetadata,
  publicPageMetadata,
  publicSitemap,
  rootMetadata,
  sitemapPathnames,
  type PublicPagePath,
} from "./siteMetadata.ts";
import {
  PUBLIC_PAGE_PATHS,
  ROBOTS_ALLOW,
  ROBOTS_DISALLOW,
  SITE_NAME,
  SITE_ORIGIN,
} from "./siteInfo.ts";

const BLOCKED = [
  "/api",
  "/account",
  "/jobs",
  "/time",
  "/share",
  "/invite",
  "/auth",
  "/pack",
] as const;

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.equal(typeof value, "object");
  assert.ok(value);
  assert.equal(Array.isArray(value), false);
  return value as Record<string, unknown>;
}

function card(metadata: Metadata) {
  const openGraph = asRecord(metadata.openGraph);
  const twitter = asRecord(metadata.twitter);
  const images = openGraph.images;
  assert.ok(Array.isArray(images));
  assert.equal(images.length, 1);
  const image = asRecord(images[0]);
  const twitterImages = twitter.images;
  assert.ok(Array.isArray(twitterImages));
  return { openGraph, twitter, image, twitterImages };
}

test("production origin matches the canonical app host", () => {
  assert.equal(SITE_ORIGIN, "https://www.gcfieldlog.com");
  assert.equal(SITE_ORIGIN, DEFAULT_APP_ORIGIN);
  assert.equal(SITE_ORIGIN.endsWith("/"), false);
});

test("public social cards use absolute title, description, url, and image", () => {
  assert.deepEqual(PUBLIC_PAGE_PATHS, ROBOTS_ALLOW);
  for (const path of PUBLIC_PAGE_PATHS) {
    const metadata = publicPageMetadata(path);
    const description = metadata.description;
    assert.equal(typeof metadata.title, "string");
    assert.equal(typeof description, "string");
    assert.ok(description);
    assert.ok(description.length < 140, description);
    assert.ok(String(metadata.title).length < 70);
    assert.equal(description.includes("@"), false);
    assert.doesNotMatch(description, /FOR GREG'S REVIEW|Brown|Rossi/);

    const social = card(metadata);
    assert.equal(social.openGraph.title, metadata.title);
    assert.equal(social.openGraph.description, description);
    assert.equal(social.openGraph.siteName, SITE_NAME);
    assert.equal(social.openGraph.type, "website");
    assert.equal(social.openGraph.url, path === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${path}`);
    assert.equal(social.image.url, ogImageUrl());
    assert.equal(social.image.width, 1200);
    assert.equal(social.image.height, 630);
    assert.equal(social.image.alt, OG_IMAGE_ALT);
    assert.equal(social.twitter.card, "summary_large_image");
    assert.equal(social.twitter.title, metadata.title);
    assert.equal(social.twitter.description, description);
    assert.deepEqual(social.twitterImages, [ogImageUrl()]);
    assert.equal(metadata.alternates?.canonical, social.openGraph.url);
  }
});

test("page copy stays short and names the right job", () => {
  const home = publicPageMetadata("/");
  const pricing = publicPageMetadata("/pricing");
  const privacy = publicPageMetadata("/privacy");
  const terms = publicPageMetadata("/terms");
  const support = publicPageMetadata("/support");

  assert.equal(home.title, "GC Field Log");
  assert.match(String(home.description), /Punch in, open a job, and pull a room pack/);
  assert.match(String(home.description), /Maple Point/);
  assert.match(String(home.description), /Cedar Ridge/);

  assert.equal(pricing.title, "Pricing — GC Field Log");
  assert.match(String(pricing.description), /free trial/);
  assert.match(String(pricing.description), /monthly/);

  assert.equal(privacy.title, "Privacy policy — GC Field Log");
  assert.match(String(privacy.description), /What GC Field Log collects/);
  assert.equal(terms.title, "Terms of use — GC Field Log");
  assert.match(String(terms.description), /Plain-language terms/);
  assert.equal(support.title, "Support — GC Field Log");
  assert.match(String(support.description), /How to get help/);
});

test("root card is the product, and a pack card is not a public page", () => {
  const root = rootMetadata();
  const social = card(root);
  assert.equal(root.title, SITE_NAME);
  assert.equal(root.description, ROOT_DESCRIPTION);
  assert.equal(social.openGraph.url, undefined);
  assert.equal(root.alternates, undefined);
  assert.equal(String(root.metadataBase), `${SITE_ORIGIN}/`);
  assert.equal(social.twitter.card, "summary_large_image");
  assert.equal(social.image.url, `${SITE_ORIGIN}${OG_IMAGE_PATH}`);

  const pack = privatePackMetadata();
  assert.equal(pack.title, SITE_NAME);
  assert.equal(pack.description, "Sign in to open a room pack.");
  assert.doesNotMatch(String(pack.description), /Maple Point|Cedar Ridge|public/);
  assert.equal(pack.alternates, undefined);
  const packOg = asRecord(pack.openGraph);
  const packTwitter = asRecord(pack.twitter);
  assert.equal(packOg.url, undefined);
  assert.equal(packOg.images, undefined);
  assert.equal(packTwitter.card, "summary");
  assert.equal(packTwitter.images, undefined);
  const robots = asRecord(pack.robots);
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
});

test("sitemap lists only the robots allow list", () => {
  const urls = publicSitemap().map((entry) => entry.url);
  assert.deepEqual(urls, [
    "https://www.gcfieldlog.com",
    "https://www.gcfieldlog.com/pricing",
    "https://www.gcfieldlog.com/privacy",
    "https://www.gcfieldlog.com/terms",
    "https://www.gcfieldlog.com/support",
  ]);
  assert.deepEqual(sitemapPathnames(), [...ROBOTS_ALLOW]);
  assert.deepEqual([...ROBOTS_DISALLOW], [...BLOCKED]);
  for (const path of sitemapPathnames()) {
    assert.equal(isRobotsDisallowedPath(path), false, path);
  }
  for (const path of BLOCKED) {
    assert.equal(isRobotsDisallowedPath(path), true, path);
    assert.equal(urls.some((url) => url.includes(`${SITE_ORIGIN}${path}`)), false);
  }
});

test("routes wire the metadata helpers, image size, and sitemap", () => {
  const pages: PublicPagePath[] = ["/", "/pricing", "/privacy", "/terms", "/support"];
  for (const path of pages) {
    const file = path === "/" ? "app/page.tsx" : `app${path}/page.tsx`;
    assert.match(readRepo(file), new RegExp(`publicPageMetadata\\("${path}"\\)`));
  }
  assert.match(readRepo("app/layout.tsx"), /rootMetadata\(\)/);
  assert.match(readRepo("app/pack/layout.tsx"), /privatePackMetadata\(\)/);
  assert.match(readRepo("app/sitemap.ts"), /publicSitemap\(\)/);
  assert.match(readRepo("app/robots.ts"), /sitemap: `\$\{SITE_ORIGIN\}\/sitemap\.xml`/);

  const image = readRepo("app/opengraph-image.tsx");
  const meta = readRepo("lib/siteMetadata.ts");
  assert.match(image, /ImageResponse/);
  assert.match(image, /SITE_THEME_COLOR/);
  assert.match(image, /OG_SAMPLE_JOBS/);
  assert.match(image, /Sample jobs/);
  assert.match(meta, /Maple Point/);
  assert.match(meta, /Cedar Ridge/);
  assert.doesNotMatch(image, /Brown|Rossi|Harbor View|Pine Hollow/);
  assert.doesNotMatch(meta, /Brown|Rossi|Harbor View|Pine Hollow/);
  assert.equal(OG_IMAGE_WIDTH, 1200);
  assert.equal(OG_IMAGE_HEIGHT, 630);
  assert.deepEqual([...OG_SAMPLE_JOBS], ["Maple Point", "Cedar Ridge"]);
  assert.equal(OG_TAGLINE, "Punch in. Open a job. Pull a room pack.");
  assert.equal(OG_TAGLINE_LINES.join(" "), OG_TAGLINE);
});
