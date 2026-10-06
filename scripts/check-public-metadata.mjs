/**
 * After `next build`, render the public pages and check social tags,
 * /opengraph-image, and /sitemap.xml.
 *
 * Social crawlers get blocking metadata. This uses Twitterbot so the
 * tags are in the HTML head the way a share preview reads them.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { PUBLIC_PAGE_PATHS, ROBOTS_DISALLOW, SITE_ORIGIN } from "../lib/siteInfo.ts";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  ogImageUrl,
  publicPageMetadata,
  publicSitemap,
} from "../lib/siteMetadata.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.METADATA_CHECK_PORT ?? 3456);
const base = `http://127.0.0.1:${port}`;
const crawler = "Twitterbot/1.0";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function decode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x2014;", "—")
    .replaceAll("&mdash;", "—");
}

function metaTags(html) {
  const tags = [];
  for (const match of html.matchAll(/<meta\s+([^>]+)>/gi)) {
    const attrs = {};
    for (const attr of match[1].matchAll(/([^\s="']+)\s*=\s*["']([^"']*)["']/g)) {
      attrs[attr[1].toLowerCase()] = decode(attr[2]);
    }
    tags.push(attrs);
  }
  return tags;
}

function contentFor(tags, key) {
  const found = tags.filter((tag) => tag.property === key || tag.name === key);
  return found.map((tag) => tag.content);
}

async function fetchText(urlPath, userAgent = crawler) {
  const response = await fetch(`${base}${urlPath}`, {
    headers: { "user-agent": userAgent },
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.text();
  return { response, body };
}

function assertPage(pathName, html, status) {
  if (status !== 200) {
    fail(`${pathName} returned ${status}`);
    return;
  }
  const metadata = publicPageMetadata(pathName);
  const tags = metaTags(html);
  const title = String(metadata.title);
  const description = String(metadata.description);
  const image = ogImageUrl();
  const checks = [
    ["og:title", title],
    ["og:description", description],
    ["og:url", pathName === "/" ? SITE_ORIGIN : `${SITE_ORIGIN}${pathName}`],
    ["og:image", image],
    ["twitter:card", "summary_large_image"],
    ["twitter:title", title],
    ["twitter:description", description],
    ["twitter:image", image],
  ];
  for (const [key, expected] of checks) {
    const values = contentFor(tags, key);
    if (!values.includes(expected)) {
      fail(`${pathName} missing ${key}=${expected}\nfound: ${values.join(" | ") || "(none)"}`);
    }
  }
}

function pngSize(buffer) {
  if (buffer.subarray(1, 4).toString() !== "PNG") return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)],
  {
    cwd: root,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  },
);

let logs = "";
child.stdout?.on("data", (chunk) => {
  logs += chunk.toString();
});
child.stderr?.on("data", (chunk) => {
  logs += chunk.toString();
});

function stop() {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

process.on("exit", stop);

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const probe = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) });
      if (probe.status < 500) {
        ready = true;
        break;
      }
    } catch {
      // server still booting
    }
    await delay(250);
  }
  if (!ready) {
    console.error(logs);
    throw new Error("next start did not become ready");
  }

  for (const pathName of PUBLIC_PAGE_PATHS) {
    const { response, body } = await fetchText(pathName);
    assertPage(pathName, body, response.status);
  }

  const image = await fetch(`${base}/opengraph-image`, {
    headers: { "user-agent": crawler },
    signal: AbortSignal.timeout(20000),
  });
  if (image.status !== 200) fail(`/opengraph-image returned ${image.status}`);
  const type = image.headers.get("content-type") ?? "";
  if (!type.includes("image/png")) fail(`/opengraph-image content-type ${type}`);
  const bytes = Buffer.from(await image.arrayBuffer());
  const size = pngSize(bytes);
  if (!size || size.width !== OG_IMAGE_WIDTH || size.height !== OG_IMAGE_HEIGHT) {
    fail(`/opengraph-image size ${JSON.stringify(size)}`);
  }

  const sitemap = await fetchText("/sitemap.xml");
  if (sitemap.response.status !== 200) fail(`/sitemap.xml returned ${sitemap.response.status}`);
  const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = publicSitemap().map((entry) => entry.url);
  if (locs.join("\n") !== expected.join("\n")) {
    fail(`sitemap locs:\n${locs.join("\n")}\nexpected:\n${expected.join("\n")}`);
  }
  for (const blocked of ROBOTS_DISALLOW) {
    const hit = locs.find((loc) => loc === `${SITE_ORIGIN}${blocked}` || loc.startsWith(`${SITE_ORIGIN}${blocked}/`));
    if (hit) fail(`sitemap includes blocked ${hit}`);
  }

  const pack = await fetchText("/pack/maple-point");
  if (pack.response.status !== 200) {
    fail(`/pack/maple-point returned ${pack.response.status}`);
  } else {
    const tags = metaTags(pack.body);
    const descriptions = contentFor(tags, "og:description");
    if (!descriptions.includes("Sign in to open a room pack.")) {
      fail(`pack og:description ${descriptions.join(" | ") || "(none)"}`);
    }
    if (contentFor(tags, "og:url").length > 0) {
      fail(`pack should not publish og:url ${contentFor(tags, "og:url").join(" | ")}`);
    }
    const cards = contentFor(tags, "twitter:card");
    if (cards.includes("summary_large_image")) {
      fail("pack twitter card uses the public large image");
    }
  }

  if (process.exitCode) {
    console.error("Public metadata check failed.");
    process.exit(process.exitCode);
  }
  console.log("Public metadata check passed.");
} catch (error) {
  console.error(logs);
  console.error(error);
  process.exit(1);
} finally {
  stop();
  if (child.stdout) child.stdout.destroy();
  if (child.stderr) child.stderr.destroy();
  await once(child, "exit").catch(() => undefined);
}
