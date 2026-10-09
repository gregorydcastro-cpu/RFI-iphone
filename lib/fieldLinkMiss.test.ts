import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fieldLinkIsMissing, fieldLinkTarget } from "./fieldLinkMiss.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("only invite and pack URLs are link targets", () => {
  assert.deepEqual(fieldLinkTarget("/invite/bad"), { kind: "invite", token: "bad" });
  assert.deepEqual(fieldLinkTarget("/invite/bad/"), { kind: "invite", token: "bad" });
  assert.deepEqual(fieldLinkTarget("/invite/a%2Fb"), { kind: "invite", token: "a/b" });
  assert.equal(fieldLinkTarget("/invite"), null);
  assert.equal(fieldLinkTarget("/invite/bad/extra"), null);

  assert.deepEqual(fieldLinkTarget("/pack/bad"), { kind: "pack", requestId: "bad" });
  assert.deepEqual(fieldLinkTarget("/pack/bad/"), { kind: "pack", requestId: "bad" });
  assert.deepEqual(fieldLinkTarget("/pack/bad/sheets"), {
    kind: "pack",
    requestId: "bad",
  });
  assert.deepEqual(fieldLinkTarget("/pack/maple-point/materials"), {
    kind: "pack",
    requestId: "maple-point",
  });
  assert.equal(fieldLinkTarget("/pack"), null);
  assert.equal(fieldLinkTarget("/packing/bad"), null);
  assert.equal(fieldLinkTarget("/nope"), null);
  assert.equal(fieldLinkTarget("/api/x"), null);
  assert.equal(fieldLinkTarget("/api/invites/bad"), null);
  assert.equal(fieldLinkTarget("/"), null);
});

test("a link is missing only when the lookup says so", async () => {
  const lookup = {
    inviteMissing: async (token: string) => token === "bad",
    packMissing: async (requestId: string) => requestId === "bad",
  };
  assert.equal(await fieldLinkIsMissing("/invite/bad", lookup), true);
  assert.equal(await fieldLinkIsMissing("/invite/still-good", lookup), false);
  assert.equal(await fieldLinkIsMissing("/pack/bad", lookup), true);
  assert.equal(await fieldLinkIsMissing("/pack/bad/rfi/new", lookup), true);
  assert.equal(await fieldLinkIsMissing("/pack/maple-point", lookup), false);
  assert.equal(await fieldLinkIsMissing("/pack/maple-point/materials", lookup), false);
  assert.equal(await fieldLinkIsMissing("/nope", lookup), false);
  assert.equal(await fieldLinkIsMissing("/api/x", lookup), false);
  assert.equal(await fieldLinkIsMissing("/api/procore/status", lookup), false);
});

test("the proxy renders a missing link as a finished HTTP 404", () => {
  const proxy = readRepo("proxy.ts");
  const lookup = readRepo("lib/fieldLinkLookup.ts");
  const root = readRepo("app/not-found.tsx");
  const helper = readRepo("lib/fieldLinkResponse.ts");
  assert.match(proxy, /missingFieldLink/);
  assert.match(proxy, /loadLinkMissDocument/);
  assert.match(proxy, /status:\s*document\.status/);
  assert.doesNotMatch(proxy, /NextResponse\.rewrite\(/);
  assert.match(helper, /\/_not-found/);
  assert.match(helper, /LINK_MISS_STATUS = 404/);
  assert.match(lookup, /previewInvite/);
  assert.match(lookup, /status === "not_found"/);
  assert.match(lookup, /packPageFound/);
  assert.match(lookup, /loadLiveRoomPack/);
  assert.match(root, /FIELD_NOT_FOUND_HEADER/);
  assert.match(root, /robots:\s*\{\s*index:\s*false/);
  assert.doesNotMatch(readRepo("app/api/[...slug]/route.ts"), /_not-found|FieldNotFoundPage/);
});
