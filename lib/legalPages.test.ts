import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  PRIVACY_FACT_SOURCES,
  legalPlainText,
  legalSpeakText,
  privacyCopy,
  supportCopy,
  termsCopy,
} from "./legalCopy.ts";
import {
  PUBLIC_PAGE_PATHS,
  REVIEW_NOTICE,
  ROBOTS_ALLOW,
  ROBOTS_DISALLOW,
  SITE_BACKGROUND_COLOR,
  SITE_FOOTER_LINKS,
  SITE_INFO,
  SITE_NAME,
  SITE_THEME_COLOR,
  robotsRules,
  webManifest,
} from "./siteInfo.ts";

const PLACEHOLDERS = [
  "[FOR GREG'S REVIEW: business name]",
  "[FOR GREG'S REVIEW: support email]",
  "[FOR GREG'S REVIEW: effective date]",
] as const;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\b\d{3}[-.)\s]\d{3}[-.\s]\d{4}\b/;
const ADDRESS_RE = /\b(?:Street|Avenue|Boulevard|Suite|P\.O\. Box)\b/i;
const CERT_RE = /SOC\s*2|ISO\s*27001|GDPR certified|HIPAA|certified compliant/i;
const RETENTION_RE = /retain(?:ed)? for|retention period|we delete after|kept for \d+/i;

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(buf.subarray(1, 4).toString(), "PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test("placeholders live in one config and stay marked for review", () => {
  assert.equal(REVIEW_NOTICE, "FOR GREG'S REVIEW — draft, not legal advice");
  assert.equal(SITE_INFO.businessName, PLACEHOLDERS[0]);
  assert.equal(SITE_INFO.supportEmail, PLACEHOLDERS[1]);
  assert.equal(SITE_INFO.effectiveDate, PLACEHOLDERS[2]);

  const siteInfo = readRepo("lib/siteInfo.ts");
  assert.match(siteInfo, /FOR GREG'S REVIEW — draft, not legal advice/);
  assert.equal(siteInfo.includes("@"), false);
});

test("privacy, terms, and support drafts show every placeholder and no invented contact", () => {
  const pages = [privacyCopy(), termsCopy(), supportCopy()];
  for (const page of pages) {
    const text = legalPlainText(page);
    assert.match(text, /FOR GREG'S REVIEW — draft, not legal advice/);
    for (const placeholder of PLACEHOLDERS) {
      assert.ok(text.includes(placeholder), `${page.path} missing ${placeholder}`);
    }
    assert.equal(legalSpeakText(page).includes("Hear this"), false);
    assert.match(legalSpeakText(page), /FOR GREG'S REVIEW/);
  }

  const blob = pages.map((page) => legalPlainText(page)).join("\n");
  assert.doesNotMatch(blob, EMAIL_RE);
  assert.doesNotMatch(blob, PHONE_RE);
  assert.doesNotMatch(blob, ADDRESS_RE);
  assert.doesNotMatch(blob, CERT_RE);
  assert.doesNotMatch(blob, RETENTION_RE);
  assert.doesNotMatch(blob, /Brown|Rossi/);
});

test("privacy names the services the app code actually uses", () => {
  const text = legalPlainText(privacyCopy());
  for (const name of [
    "Supabase",
    "Procore",
    "Resend",
    "Gmail",
    "Stripe",
    "Google Drive",
    "xAI",
    "IndexedDB",
    "Vercel",
    "local storage",
  ]) {
    assert.ok(text.includes(name), `privacy missing ${name}`);
  }
  assert.match(text, /does not add a web analytics tool/);
  assert.match(text, /does not store your card number/);
  assert.match(text, /not uploaded to Procore/);
  assert.match(text, /does not send text messages/);
  assert.match(text, /no delete-account button/);
  assert.match(text, /Support page/);

  for (const path of PRIVACY_FACT_SOURCES) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, path);
  }
});

test("legal routes are public pages with Hear this and the draft comment", () => {
  for (const path of ["/privacy", "/terms", "/support"] as const) {
    const src = readRepo(`app${path}/page.tsx`);
    assert.match(src, /FOR GREG'S REVIEW — draft, not legal advice/);
    assert.match(src, /LegalDocument/);
    assert.doesNotMatch(src, /redirect\(/);
    assert.doesNotMatch(src, /signInContinuePath/);
    assert.equal(PUBLIC_PAGE_PATHS.includes(path), true);
  }

  const document = readRepo("components/LegalDocument.tsx");
  assert.match(document, /FOR GREG'S REVIEW — draft, not legal advice/);
  assert.match(document, /label="Hear this"/);
  assert.match(document, /data-review-notice/);
  assert.match(document, /text-lg leading-relaxed/);
  assert.match(document, /SiteFooter/);
});

test("footer links are on sign-in and pricing, and not on the pack viewer", () => {
  assert.deepEqual(
    SITE_FOOTER_LINKS.map((link) => link.href),
    ["/privacy", "/terms", "/support"],
  );
  assert.match(readRepo("app/page.tsx"), /<SiteFooter/);
  assert.match(readRepo("app/pricing/page.tsx"), /<SiteFooter/);
  assert.doesNotMatch(readRepo("app/pack/[requestId]/page.tsx"), /SiteFooter/);
  assert.doesNotMatch(readRepo("app/layout.tsx"), /SiteFooter/);
  assert.doesNotMatch(readRepo("components/RoomPackViewer.tsx"), /SiteFooter/);
});

test("signed-out visitors are not gated away from the public pages", () => {
  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /redirect/);
  assert.doesNotMatch(proxy, /\/privacy|\/terms|\/support/);

  const config = readRepo("next.config.ts");
  assert.doesNotMatch(config, /\/privacy|\/terms|\/support/);

  const banner = readRepo("components/AppleComingSoonBanner.tsx");
  assert.match(banner, /pathname\.startsWith\("\/pack"\)/);
  assert.doesNotMatch(banner, /\/privacy|\/terms|\/support/);
});

test("robots allow public pages and disallow the API and signed-in areas", () => {
  const rules = robotsRules();
  assert.equal(rules.userAgent, "*");
  for (const path of ["/", "/pricing", "/privacy", "/terms", "/support"]) {
    assert.ok(rules.allow.includes(path), path);
  }
  for (const path of ["/api", "/account", "/jobs", "/time", "/share", "/invite", "/auth", "/pack"]) {
    assert.ok(rules.disallow.includes(path), path);
  }
  assert.deepEqual(ROBOTS_ALLOW, rules.allow);
  assert.deepEqual(ROBOTS_DISALLOW, rules.disallow);
  const src = readRepo("app/robots.ts");
  assert.match(src, /robotsRules/);
});

test("web manifest names GC Field Log and uses the app theme color", () => {
  const manifest = webManifest();
  assert.equal(manifest.name, "GC Field Log");
  assert.equal(manifest.short_name, SITE_NAME);
  assert.equal(manifest.theme_color, "#191616");
  assert.equal(manifest.background_color, SITE_BACKGROUND_COLOR);
  assert.equal(SITE_THEME_COLOR, "#191616");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  const sizes = manifest.icons.map((icon) => icon.sizes);
  assert.ok(sizes.includes("180x180"));
  assert.ok(sizes.includes("32x32"));
  assert.ok(sizes.includes("16x16"));
  assert.ok(sizes.includes("512x512"));
  const icon512 = manifest.icons.find((icon) => icon.sizes === "512x512");
  assert.equal(icon512?.src, "/icon-512.png");
  assert.equal(icon512?.type, "image/png");
  assert.match(readRepo("app/manifest.ts"), /webManifest/);
  assert.match(readRepo("app/layout.tsx"), /themeColor: SITE_THEME_COLOR/);
});

test("apple touch icon and favicon sizes come from the existing icon", () => {
  assert.equal(existsSync(new URL("../app/favicon.ico", import.meta.url)), true);
  assert.deepEqual(pngSize("app/apple-icon.png"), { width: 180, height: 180 });
  assert.deepEqual(pngSize("public/apple-touch-icon.png"), { width: 180, height: 180 });
  assert.deepEqual(pngSize("public/favicon-32.png"), { width: 32, height: 32 });
  assert.deepEqual(pngSize("public/favicon-16.png"), { width: 16, height: 16 });
  assert.deepEqual(pngSize("public/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(pngSize("app/icon.png"), { width: 192, height: 192 });
  assert.deepEqual(pngSize("public/icon-512.png"), { width: 512, height: 512 });
});
