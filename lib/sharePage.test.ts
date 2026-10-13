import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  SHARE_PAGE_DESCRIPTION,
  SHARE_PAGE_TITLE,
  sharePageMetadata,
} from "./sharePage.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("signed-out share is noindex and signed-in metadata stays the same", () => {
  assert.equal(SHARE_PAGE_TITLE, "Share — GC Field Log");
  assert.equal(
    SHARE_PAGE_DESCRIPTION,
    "Create share folders, pin Maple Point disciplines or room packs, and refresh pinned sheets.",
  );

  const signedOut = sharePageMetadata(false);
  assert.equal(signedOut.title, SHARE_PAGE_TITLE);
  assert.equal(signedOut.description, SHARE_PAGE_DESCRIPTION);
  assert.deepEqual(signedOut.robots, { index: false, follow: false });

  const signedIn = sharePageMetadata(true);
  assert.equal(signedIn.title, SHARE_PAGE_TITLE);
  assert.equal(signedIn.description, SHARE_PAGE_DESCRIPTION);
  assert.equal("robots" in signedIn, false);

  const page = readRepo("app/share/page.tsx");
  const portal = readRepo("components/SharePortal.tsx");
  assert.match(page, /sharePageMetadata\(Boolean\(session\)\)/);
  assert.match(page, /SharePortal/);
  assert.match(page, /sessionEnded/);
  assert.match(portal, /signedOutGate/);
  assert.doesNotMatch(page, /AccountSignInShell|TimeSignInShell/);
});
