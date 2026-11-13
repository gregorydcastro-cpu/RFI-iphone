import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

/**
 * Home (`/`) is the page that renders the sign-in form.
 * `/login` and `/signin` only 307 there, so the header link is `/`.
 */
const LOGIN_ANCHOR =
  /<Link\b[^>]*\bhref="\/"[^>]*\bfocus-visible:outline-2[^>]*>\s*Login\s*<\/Link>/;

function signedOutBranch(source: string): string {
  const marker = ") : (";
  const at = source.lastIndexOf(marker);
  assert.ok(at >= 0);
  return source.slice(at);
}

test("signed-out header Login is an anchor to the home sign-in form", () => {
  const header = signedOutBranch(readRepo("components/AppHeader.tsx"));
  assert.match(header, LOGIN_ANCHOR);
  assert.doesNotMatch(header, /<span[^>]*>\s*Login\s*<\/span>/);
  assert.match(header, /focus-visible:outline-secondary/);

  const bar = readRepo("components/SignedOutBar.tsx");
  assert.match(bar, LOGIN_ANCHOR);
  assert.doesNotMatch(bar, /<span[^>]*>\s*Login\s*<\/span>/);
  assert.match(bar, /from "next\/link"/);

  assert.match(readRepo("app/page.tsx"), /<AppHeader/);
  assert.match(readRepo("app/pricing/page.tsx"), /<AppHeader/);
  assert.match(readRepo("components/LegalDocument.tsx"), /<AppHeader/);
  assert.match(readRepo("components/RoomPackViewer.tsx"), /<AppHeader/);
  assert.match(readRepo("components/FieldNotFound.tsx"), /<SignedOutBar \/>/);
  assert.match(readRepo("app/not-found.tsx"), /<FieldNotFoundPage/);
});
