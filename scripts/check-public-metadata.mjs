/**
 * After `next build`, render the public pages and check social tags,
 * security headers, /icon-512.png, /opengraph-image, and /sitemap.xml.
 *
 * Social crawlers get blocking metadata. This uses Twitterbot so the
 * tags are in the HTML head the way a share preview reads them.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS } from "../lib/securityHeaders.ts";
import { PUBLIC_PAGE_PATHS, ROBOTS_DISALLOW, SITE_ORIGIN, webManifest } from "../lib/siteInfo.ts";
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

function assertSecurityHeaders(pathName, response) {
  for (const header of SECURITY_HEADERS) {
    const actual = response.headers.get(header.key);
    if (actual !== header.value) {
      fail(`${pathName} ${header.key}=${actual ?? "(missing)"}`);
    }
  }
  const csp = response.headers.get("content-security-policy") ?? "";
  if (/\b(script-src|default-src|connect-src|style-src|frame-src)\b/.test(csp)) {
    fail(`${pathName} CSP is broader than frame-ancestors: ${csp}`);
  }
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
    assertSecurityHeaders(pathName, response);
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

  const manifestResponse = await fetch(`${base}/manifest.webmanifest`, {
    signal: AbortSignal.timeout(20000),
  });
  if (manifestResponse.status !== 200) {
    fail(`/manifest.webmanifest returned ${manifestResponse.status}`);
  } else {
    const manifest = await manifestResponse.json();
    const expectedIcon = webManifest().icons.find((icon) => icon.src === "/icon-512.png");
    const listed = (manifest.icons ?? []).find((icon) => icon.src === "/icon-512.png");
    if (!listed || listed.sizes !== "512x512" || listed.type !== "image/png") {
      fail(`manifest missing 512 icon ${JSON.stringify(manifest.icons)}`);
    }
    if (!expectedIcon || listed.sizes !== expectedIcon.sizes) {
      fail("manifest 512 entry does not match webManifest()");
    }
  }

  const icon = await fetch(`${base}/icon-512.png`, {
    signal: AbortSignal.timeout(20000),
  });
  if (icon.status !== 200) fail(`/icon-512.png returned ${icon.status}`);
  const iconType = icon.headers.get("content-type") ?? "";
  if (!iconType.includes("image/png")) fail(`/icon-512.png content-type ${iconType}`);
  const iconBytes = Buffer.from(await icon.arrayBuffer());
  const iconSize = pngSize(iconBytes);
  if (!iconSize || iconSize.width !== 512 || iconSize.height !== 512) {
    fail(`/icon-512.png size ${JSON.stringify(iconSize)}`);
  }
  assertSecurityHeaders("/icon-512.png", icon);

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
