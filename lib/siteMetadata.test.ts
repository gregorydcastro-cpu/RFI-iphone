import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Metadata } from "next";
import { DEFAULT_APP_ORIGIN } from "./stripe.ts";
import { ACCOUNT_PAGE_TITLE, ACCOUNT_SIGN_IN_COPY } from "./accountGate.ts";
import {
  SHARE_PAGE_DESCRIPTION,
  SHARE_PAGE_TITLE,
  sharePageMetadata,
} from "./sharePage.ts";
import { TIME_CLOCK_SIGN_IN_COPY, TIME_SIGNED_OUT_TITLE } from "./timeGate.ts";
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
  PACK_SIGNED_OUT_TITLE,
  PACK_SIGN_IN_DESCRIPTION,
  packDocumentTitle,
  notFoundDocumentMetadata,
  pageSocialDescription,
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
  assert.equal(PACK_SIGNED_OUT_TITLE, "Room pack — GC Field Log");
  assert.equal(PACK_SIGN_IN_DESCRIPTION, "Sign in to open a room pack.");
  assert.equal(pack.title, PACK_SIGNED_OUT_TITLE);
  assert.equal(pack.description, PACK_SIGN_IN_DESCRIPTION);
  assert.doesNotMatch(String(pack.title), /Maple Point|Cedar Ridge/);
  assert.doesNotMatch(String(pack.description), /Maple Point|Cedar Ridge|public/);
  assert.equal(pack.alternates, undefined);
  const packOg = asRecord(pack.openGraph);
  const packTwitter = asRecord(pack.twitter);
  assert.equal(packOg.title, PACK_SIGNED_OUT_TITLE);
  assert.equal(packOg.description, PACK_SIGN_IN_DESCRIPTION);
  assert.equal(packOg.url, undefined);
  assert.equal(packOg.images, undefined);
  assert.equal(packTwitter.card, "summary");
  assert.equal(packTwitter.title, PACK_SIGNED_OUT_TITLE);
  assert.equal(packTwitter.description, PACK_SIGN_IN_DESCRIPTION);
  assert.equal(packTwitter.images, undefined);
  const robots = asRecord(pack.robots);
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
});

test("a signed-in pack title uses the job name and keeps the private card", () => {
  assert.equal(packDocumentTitle(undefined), PACK_SIGNED_OUT_TITLE);
  assert.equal(packDocumentTitle("  "), PACK_SIGNED_OUT_TITLE);
  assert.equal(packDocumentTitle(SITE_NAME), PACK_SIGNED_OUT_TITLE);
  assert.equal(packDocumentTitle("Room pack"), PACK_SIGNED_OUT_TITLE);
  assert.equal(
    packDocumentTitle("Maple Point Medical Office"),
    "Maple Point Medical Office — GC Field Log",
  );
  assert.equal(
    packDocumentTitle("  Maple Point Medical Office  "),
    "Maple Point Medical Office — GC Field Log",
  );
  assert.equal(
    packDocumentTitle("Maple Point Medical Office — GC Field Log"),
    "Maple Point Medical Office — GC Field Log",
  );

  const titled = privatePackMetadata(packDocumentTitle("Maple Point Medical Office"));
  assert.equal(titled.title, "Maple Point Medical Office — GC Field Log");
  assert.equal(titled.description, PACK_SIGN_IN_DESCRIPTION);
  const robots = asRecord(titled.robots);
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
  assert.equal(asRecord(titled.openGraph).title, titled.title);
  assert.equal(asRecord(titled.twitter).title, titled.title);

  const page = readRepo("app/pack/[requestId]/page.tsx");
  assert.match(page, /export async function generateMetadata/);
  assert.match(page, /if \(!role\.session\) return privatePackMetadata\(\)/);
  assert.match(
    page,
    /packDocumentTitle\(live\.pack\.project\.name \|\| requestedJob\?\.name\)/,
  );
  assert.match(page, /if \(!packPageFound\(\{ requestId, live \}\) \|\| !live\) notFound\(\)/);
  const metadataFn = page.slice(
    page.indexOf("export async function generateMetadata"),
    page.indexOf("export default async function PackPage"),
  );
  assert.doesNotMatch(metadataFn, /notFound\(/);
});

test("a missing page social card uses the page words, not the homepage pitch", () => {
  const title = "Page not found — GC Field Log";
  const description = "This page isn't here. Go home or open the Maple Point demo.";
  const page = notFoundDocumentMetadata(title, description);
  assert.deepEqual(page.title, { absolute: title });
  assert.equal(page.description, description);
  assert.equal(page.alternates, undefined);
  const robots = asRecord(page.robots);
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
  const openGraph = asRecord(page.openGraph);
  const twitter = asRecord(page.twitter);
  assert.equal(openGraph.title, title);
  assert.equal(openGraph.description, description);
  assert.equal(openGraph.url, undefined);
  assert.equal(openGraph.images, undefined);
  assert.equal(twitter.card, "summary");
  assert.equal(twitter.title, title);
  assert.equal(twitter.description, description);
  assert.equal(twitter.images, undefined);
  assert.notEqual(openGraph.title, SITE_NAME);
  assert.notEqual(openGraph.description, ROOT_DESCRIPTION);
  assert.doesNotMatch(String(openGraph.description), /Crew dashboard/);

  const link = notFoundDocumentMetadata(
    "Link not found — GC Field Log",
    "It may be old.",
  );
  assert.equal(asRecord(link.openGraph).title, "Link not found — GC Field Log");
  assert.equal(asRecord(link.openGraph).description, "It may be old.");
  assert.equal(asRecord(link.twitter).title, "Link not found — GC Field Log");
  assert.notEqual(asRecord(link.openGraph).description, ROOT_DESCRIPTION);
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

function socialDescriptions(metadata: Metadata): {
  description: string;
  openGraph: string;
  twitter: string;
} {
  assert.equal(typeof metadata.description, "string");
  const openGraph = asRecord(metadata.openGraph);
  const twitter = asRecord(metadata.twitter);
  assert.equal(typeof openGraph.description, "string");
  assert.equal(typeof twitter.description, "string");
  return {
    description: metadata.description,
    openGraph: openGraph.description,
    twitter: twitter.description,
  };
}

test("time, account, and share descriptions are page-specific", () => {
  const homeDescription = String(publicPageMetadata("/").description);
  assert.equal(
    homeDescription,
    "Punch in, open a job, and pull a room pack. Sample jobs are Maple Point and Cedar Ridge.",
  );

  const routes: Array<{
    path: string;
    file: string;
    description: string;
    expr: string;
    title: string;
    titleExpr: string;
    metadata: Metadata;
  }> = [
    {
      path: "/time",
      file: "app/time/page.tsx",
      description: TIME_CLOCK_SIGN_IN_COPY,
      expr: "TIME_CLOCK_SIGN_IN_COPY",
      title: TIME_SIGNED_OUT_TITLE,
      titleExpr: "TIME_SIGNED_OUT_TITLE",
      metadata: {
        title: TIME_SIGNED_OUT_TITLE,
        description: TIME_CLOCK_SIGN_IN_COPY,
        ...pageSocialDescription(TIME_CLOCK_SIGN_IN_COPY),
        robots: { index: false, follow: false },
      },
    },
    {
      path: "/account",
      file: "app/account/page.tsx",
      description: ACCOUNT_SIGN_IN_COPY,
      expr: "ACCOUNT_SIGN_IN_COPY",
      title: ACCOUNT_PAGE_TITLE,
      titleExpr: "ACCOUNT_PAGE_TITLE",
      metadata: {
        title: ACCOUNT_PAGE_TITLE,
        description: ACCOUNT_SIGN_IN_COPY,
        ...pageSocialDescription(ACCOUNT_SIGN_IN_COPY),
        robots: { index: false, follow: false },
      },
    },
    {
      path: "/share",
      file: "lib/sharePage.ts",
      description: SHARE_PAGE_DESCRIPTION,
      expr: "SHARE_PAGE_DESCRIPTION",
      title: SHARE_PAGE_TITLE,
      titleExpr: "SHARE_PAGE_TITLE",
      metadata: sharePageMetadata(false),
    },
  ];

  const seen = new Set<string>();
  for (const route of routes) {
    const tags = socialDescriptions(route.metadata);
    assert.equal(tags.description, route.description, route.path);
    assert.equal(tags.openGraph, route.description, route.path);
    assert.equal(tags.twitter, route.description, route.path);
    for (const tag of [tags.description, tags.openGraph, tags.twitter]) {
      assert.notEqual(tag, homeDescription, route.path);
      assert.notEqual(tag, ROOT_DESCRIPTION, route.path);
      assert.doesNotMatch(tag, /Punch in, open a job|Crew dashboard/);
      assert.doesNotMatch(tag, /Brown|Rossi/);
    }
    assert.ok(route.description.length < 140, route.description);
    assert.equal(seen.has(route.description), false, route.path);
    seen.add(route.description);

    assert.equal(route.metadata.title, route.title, route.path);
    assert.equal(route.metadata.alternates, undefined, route.path);
    assert.deepEqual(route.metadata.robots, { index: false, follow: false }, route.path);
    const openGraph = asRecord(route.metadata.openGraph);
    const twitter = asRecord(route.metadata.twitter);
    assert.equal(openGraph.title, SITE_NAME, route.path);
    assert.equal(twitter.title, SITE_NAME, route.path);
    assert.equal(openGraph.url, undefined, route.path);

    const source = readRepo(route.file);
    assert.match(source, new RegExp(`title:\\s*${route.titleExpr}`), route.path);
    assert.match(source, new RegExp(`description:\\s*${route.expr}`), route.path);
    assert.match(
      source,
      new RegExp(`pageSocialDescription\\(${route.expr}\\)`),
      route.path,
    );
  }

  const signedIn = sharePageMetadata(true);
  const signedInTags = socialDescriptions(signedIn);
  assert.equal(signedInTags.description, SHARE_PAGE_DESCRIPTION);
  assert.equal(signedInTags.openGraph, SHARE_PAGE_DESCRIPTION);
  assert.equal(signedInTags.twitter, SHARE_PAGE_DESCRIPTION);
  assert.notEqual(signedInTags.description, homeDescription);
  assert.notEqual(signedInTags.openGraph, ROOT_DESCRIPTION);
  assert.equal(signedIn.title, SHARE_PAGE_TITLE);
  assert.equal(signedIn.alternates, undefined);
  assert.equal("robots" in signedIn, false);

  const card = pageSocialDescription(TIME_CLOCK_SIGN_IN_COPY);
  assert.equal("title" in card, false);
  assert.equal("description" in card, false);
  assert.equal("robots" in card, false);
  assert.equal("alternates" in card, false);

  const time = readRepo("app/time/page.tsx");
  const account = readRepo("app/account/page.tsx");
  assert.match(time, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(account, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.doesNotMatch(time, /canonical/);
  assert.doesNotMatch(account, /canonical/);
  assert.doesNotMatch(readRepo("lib/sharePage.ts"), /canonical/);
});
