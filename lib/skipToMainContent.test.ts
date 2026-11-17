import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SKIP_TO_MAIN_HREF,
  SKIP_TO_MAIN_ID,
  SKIP_TO_MAIN_TEXT,
} from "./skipToMainContent.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function indexes(source: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  while (from < source.length) {
    const at = source.indexOf(needle, from);
    if (at < 0) break;
    found.push(at);
    from = at + needle.length;
  }
  return found;
}

test("the skip link text and target are the public-page contract", () => {
  assert.equal(SKIP_TO_MAIN_TEXT, "Skip to main content");
  assert.equal(SKIP_TO_MAIN_HREF, "#main-content");
  assert.equal(SKIP_TO_MAIN_ID, "main-content");
  assert.equal(SKIP_TO_MAIN_HREF, `#${SKIP_TO_MAIN_ID}`);

  const component = readRepo("components/SkipToMainContent.tsx");
  assert.match(component, /href=\{SKIP_TO_MAIN_HREF\}/);
  assert.match(component, /\{SKIP_TO_MAIN_TEXT\}/);
  assert.match(component, /className="skip-to-main"/);
  assert.match(component, /<a\b/);
  assert.doesNotMatch(component, /next\/link/);
  assert.doesNotMatch(component, /"use client"/);
});

test("the skip link is hidden until focus and then shows an outline", () => {
  const css = readRepo("app/globals.css");
  assert.match(css, /\.skip-to-main\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.skip-to-main\s*\{[^}]*clip-path:\s*inset\(50%\)/s);
  assert.match(css, /\.skip-to-main:focus\s*\{[^}]*clip-path:\s*none/s);
  assert.match(css, /\.skip-to-main:focus\s*\{[^}]*position:\s*fixed/s);
  assert.match(
    css,
    /\.skip-to-main:focus\s*\{[^}]*outline:\s*2px solid var\(--gline-cta\)/s,
  );
  assert.match(css, /\.skip-to-main:focus\s*\{[^}]*outline-offset:\s*2px/s);
  assert.doesNotMatch(css, /\.skip-to-main\s*\{[^}]*display:\s*none/s);
});

test("signed-out shells render one skip link before the header and one main target", () => {
  const shells = [
    "app/page.tsx",
    "app/pricing/page.tsx",
    "components/LegalDocument.tsx",
  ];
  for (const file of shells) {
    const source = readRepo(file);
    const skips = indexes(source, "<SkipToMainContent");
    const headers = indexes(source, "<AppHeader");
    const mains = indexes(source, "<main");
    assert.deepEqual(skips.length, 1, file);
    assert.deepEqual(headers.length, 1, file);
    assert.deepEqual(mains.length, 1, file);
    assert.ok(skips[0] < headers[0], file);
    assert.ok(headers[0] < mains[0], file);
    assert.match(source, /id=\{SKIP_TO_MAIN_ID\}/);
    assert.match(source, /tabIndex=\{-1\}/);
  }
});

test("support, terms, and privacy share the legal shell and do not add a second main", () => {
  for (const path of ["/support", "/terms", "/privacy"]) {
    const source = readRepo(`app${path}/page.tsx`);
    assert.match(source, /<LegalDocument/);
    assert.doesNotMatch(source, /<main\b/);
    assert.doesNotMatch(source, /<SkipToMainContent/);
  }
});

test("not-found pages share one card with the skip link and one main target", () => {
  for (const file of [
    "app/not-found.tsx",
    "app/pack/[requestId]/not-found.tsx",
    "app/invite/[token]/not-found.tsx",
  ]) {
    const source = readRepo(file);
    assert.match(source, /FieldNotFoundPage/);
    assert.doesNotMatch(source, /<main\b/);
    assert.doesNotMatch(source, /<SkipToMainContent/);
  }

  const card = readRepo("components/FieldNotFound.tsx");
  const rendered = card.slice(card.indexOf("return ("));
  assert.equal((card.match(/<main\b/g) ?? []).length, 1);
  assert.equal(indexes(card, "<SkipToMainContent").length, 1);
  assert.ok(rendered.includes("<SkipToMainContent"));
  assert.ok(rendered.indexOf("<SkipToMainContent") < rendered.indexOf("{header}"));
  assert.ok(rendered.indexOf("{header}") < rendered.indexOf("<main"));
  assert.match(card, /id=\{SKIP_TO_MAIN_ID\}/);
  assert.match(card, /tabIndex=\{-1\}/);
  assert.doesNotMatch(card, /"use client"/);
  assert.doesNotMatch(card, /next\/link/);
});

test("the pack viewer adds the skip link and one main in each render branch", () => {
  const viewer = readRepo("components/RoomPackViewer.tsx");
  const page = readRepo("app/pack/[requestId]/page.tsx");
  assert.match(page, /<RoomPackViewer/);
  assert.doesNotMatch(page, /<main\b/);
  assert.doesNotMatch(page, /<SkipToMainContent/);

  const skips = indexes(viewer, "<SkipToMainContent");
  const headers = indexes(viewer, "<AppHeader");
  assert.deepEqual(skips, indexes(viewer, "<SkipToMainContent />"));
  assert.equal(skips.length, 2);
  assert.equal(headers.length, 2);
  assert.equal((viewer.match(/<PackMain>/g) ?? []).length, 2);
  assert.equal((viewer.match(/<\/PackMain>/g) ?? []).length, 2);
  assert.equal((viewer.match(/<main\b/g) ?? []).length, 1);
  assert.ok(skips[0] < headers[0]);
  assert.ok(headers[0] < skips[1]);
  assert.ok(skips[1] < headers[1]);
  assert.match(viewer, /id=\{SKIP_TO_MAIN_ID\}/);
  assert.match(viewer, /tabIndex=\{-1\}/);
  const empty = viewer.slice(skips[0], skips[1]);
  const filled = viewer.slice(skips[1]);
  assert.equal((empty.match(/<PackMain>/g) ?? []).length, 1);
  assert.equal((filled.match(/<PackMain>/g) ?? []).length, 1);
});

test("the root layout and signed-in headers do not add a second or untargeted skip link", () => {
  assert.doesNotMatch(readRepo("app/layout.tsx"), /SkipToMainContent|skip-to-main/);
  assert.doesNotMatch(readRepo("components/AppHeader.tsx"), /SkipToMainContent|skip-to-main/);
  assert.doesNotMatch(readRepo("components/SignedOutBar.tsx"), /SkipToMainContent|skip-to-main/);
  assert.doesNotMatch(readRepo("app/jobs/page.tsx"), /SkipToMainContent|main-content/);
  assert.doesNotMatch(
    readRepo("app/jobs/[projectSlug]/page.tsx"),
    /SkipToMainContent|main-content/,
  );
});
