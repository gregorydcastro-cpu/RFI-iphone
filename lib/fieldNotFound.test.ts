import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  FIELD_NOT_FOUND_MESSAGE,
  FIELD_NOT_FOUND_TITLE,
  HOME_HREF,
  HOME_LABEL,
  MAPLE_POINT_DEMO_HREF,
  MAPLE_POINT_DEMO_LABEL,
  SHEETS_SECTION,
  fieldNotFoundSpeak,
  opensSheetsSection,
  packSubpathDecision,
  packSubpathHref,
} from "./fieldNotFound.ts";
import { logFieldNotFoundDevHint } from "./fieldNotFoundDev.ts";

const FORBIDDEN = [/public\//, /\.json/, /requestId/];

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("/demo and /pack/maple-point/sheets redirect to the live pack", () => {
  assert.equal(MAPLE_POINT_DEMO_HREF, "/pack/maple-point");
  assert.equal(
    packSubpathHref("maple-point", ["sheets"]),
    "/pack/maple-point?section=sheets",
  );
  assert.equal(
    packSubpathHref("maple-point", ["Sheets"]),
    "/pack/maple-point?section=sheets",
  );
  assert.equal(packSubpathHref("maple-point", ["old-link"]), "/pack/maple-point");
  assert.equal(
    packSubpathHref("cedar-ridge", ["extra", "path"]),
    "/pack/cedar-ridge",
  );

  const kept = new URLSearchParams("job=maple-point&room=101&section=old");
  assert.equal(
    packSubpathHref("maple-point", ["sheets"], kept),
    "/pack/maple-point?job=maple-point&room=101&section=sheets",
  );
  assert.equal(kept.get("section"), "old");

  assert.deepEqual(
    packSubpathDecision({
      packId: "maple-point",
      slug: ["sheets"],
      packFound: true,
    }),
    { type: "redirect", href: "/pack/maple-point?section=sheets" },
  );
  assert.deepEqual(
    packSubpathDecision({
      packId: "missing-pack",
      slug: ["sheets"],
      packFound: false,
    }),
    { type: "not-found" },
  );
  assert.deepEqual(
    packSubpathDecision({
      packId: "missing-pack",
      slug: ["anywhere"],
      packFound: false,
    }),
    { type: "not-found" },
  );
  assert.equal(opensSheetsSection("sheets"), true);
  assert.equal(opensSheetsSection(["sheets"]), true);
  assert.equal(opensSheetsSection("floor"), false);
  assert.equal(SHEETS_SECTION, "sheets");
});

test("next config sends /demo to the Maple Point pack", () => {
  const config = readRepo("next.config.ts");
  assert.match(config, /source:\s*"\/demo"/);
  assert.match(config, /destination:\s*"\/pack\/maple-point"/);
  assert.match(config, /permanent:\s*false/);
});

test("unknown pack subpaths redirect only when the pack resolves", () => {
  const page = readRepo("app/pack/[requestId]/[...slug]/page.tsx");
  assert.match(page, /packSubpathDecision/);
  assert.match(page, /loadLiveRoomPack/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /redirect\(decision\.href\)/);
  const packPage = readRepo("app/pack/[requestId]/page.tsx");
  assert.match(packPage, /opensSheetsSection/);
  const viewer = readRepo("components/RoomPackViewer.tsx");
  assert.match(viewer, /id="sheets"/);
  assert.match(viewer, /openSheets/);
  assert.match(viewer, /getElementById\("sheets"\)/);
});

test("not-found copy has no developer paths", () => {
  const speak = fieldNotFoundSpeak();
  assert.equal(FIELD_NOT_FOUND_TITLE, "Pack not found");
  assert.equal(
    FIELD_NOT_FOUND_MESSAGE,
    "This link may be old. Open the Maple Point demo or go home.",
  );
  assert.equal(MAPLE_POINT_DEMO_LABEL, "Open Maple Point demo");
  assert.equal(HOME_LABEL, "Home");
  assert.equal(HOME_HREF, "/");
  assert.equal(
    speak,
    "Pack not found. This link may be old. Open the Maple Point demo or go home.",
  );

  const copy = [
    FIELD_NOT_FOUND_TITLE,
    FIELD_NOT_FOUND_MESSAGE,
    MAPLE_POINT_DEMO_LABEL,
    HOME_LABEL,
    speak,
  ].join("\n");
  for (const pattern of FORBIDDEN) {
    assert.doesNotMatch(copy, pattern);
  }

  const uiFiles = [
    "app/not-found.tsx",
    "app/pack/[requestId]/not-found.tsx",
    "components/FieldNotFound.tsx",
    "lib/fieldNotFound.ts",
  ];
  for (const file of uiFiles) {
    const text = readRepo(file);
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(text, pattern, `${file} matches ${pattern}`);
    }
  }

  const card = readRepo("components/FieldNotFound.tsx");
  assert.match(card, /Hear this/);
  assert.match(card, /ReadAloudButton/);
  assert.match(card, /w-full/);
  assert.doesNotMatch(card, /"use client"/);
});

test("missing-page hint is console-only and development-only", () => {
  const prev = process.env.NODE_ENV;
  const logs: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  try {
    process.env.NODE_ENV = "production";
    logFieldNotFoundDevHint();
    assert.equal(logs.length, 0);
    process.env.NODE_ENV = "test";
    logFieldNotFoundDevHint();
    assert.equal(logs.length, 0);
    process.env.NODE_ENV = "development";
    logFieldNotFoundDevHint();
    assert.equal(logs.length, 1);
    assert.match(logs[0] ?? "", /public\/packs/);
    assert.match(logs[0] ?? "", /requestId/);
  } finally {
    process.env.NODE_ENV = prev;
    console.info = original;
  }
});
