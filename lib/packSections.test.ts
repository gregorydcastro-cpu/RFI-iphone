import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { layoutSheetId } from "./packNormalize.ts";
import type { RoomPack, Sheet } from "./pack.ts";
import {
  PACK_FLOOR_PLAN_ID,
  PACK_RFIS_ID,
  packDetailSections,
  packSectionHref,
  sheetFileHref,
} from "./packSections.ts";
import { splitPackSheets } from "./sheetOrder.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function maplePointPack(): RoomPack {
  return JSON.parse(
    readFileSync(new URL("../public/packs/maple-point.json", import.meta.url), "utf8"),
  ) as RoomPack;
}

function mapleSheets(): { primary: Sheet; rest: Sheet[] } {
  const pack = maplePointPack();
  const split = splitPackSheets(pack.sheets, layoutSheetId(pack.layout));
  assert.ok(split.primary);
  return { primary: split.primary, rest: split.rest };
}

test("Maple Point jump hrefs point at unique section ids", () => {
  const { primary, rest } = mapleSheets();
  assert.equal(primary.id, "A-101");
  const details = packDetailSections(rest);
  assert.deepEqual(
    details.map((detail) => detail.sheet.id),
    ["E-101", "E-102"],
  );

  const hrefs = [
    packSectionHref(PACK_FLOOR_PLAN_ID),
    ...details.map((detail) => packSectionHref(detail.targetId)),
    packSectionHref(PACK_RFIS_ID),
  ];
  assert.deepEqual(hrefs, [
    "#floor-plan",
    "#sheet-E-101",
    "#sheet-E-102",
    "#rfis",
  ]);

  const ids = hrefs.map((href) => href.slice(1));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, [
    PACK_FLOOR_PLAN_ID,
    ...details.map((detail) => detail.targetId),
    PACK_RFIS_ID,
  ]);
});

test("detail sheet ids stay unique when drawing numbers sanitize the same way", () => {
  const details = packDetailSections([
    { id: "A/101" },
    { id: "A-101" },
    { id: "E 102" },
    { id: "!!!" },
  ]);
  const ids = details.map((detail) => detail.targetId);
  assert.deepEqual(ids, ["sheet-A-101", "sheet-A-101-2", "sheet-E-102", "sheet----"]);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of [PACK_FLOOR_PLAN_ID, PACK_RFIS_ID, "sheets", "detail-sheets", "main-content"]) {
    assert.equal(ids.includes(id), false);
  }
});

test("Maple Point sheet fallbacks are the existing pack PDF files", () => {
  const { primary, rest } = mapleSheets();
  const sheets = [primary, ...rest];
  const hrefs = sheets.map((sheet) =>
    sheetFileHref({ requestId: "maple-point", sheet }),
  );
  assert.deepEqual(hrefs, [
    "/packs/maple-point-a101.pdf",
    "/packs/maple-point-e101.pdf",
    "/packs/maple-point-e102.pdf",
  ]);
  for (const href of hrefs) {
    assert.equal(href.startsWith("/packs/"), true);
    assert.equal(
      existsSync(new URL(`../public${href}`, import.meta.url)),
      true,
      href,
    );
    assert.equal(
      sheetFileHref({
        requestId: "cedar-ridge",
        sheet: sheets[hrefs.indexOf(href)]!,
      }),
      href,
    );
  }
});

test("remote sheet fallbacks reuse the existing sheet PDF URL and empty files do not invent one", () => {
  const remote = sheetFileHref({
    requestId: "sample-arch-bounds-733",
    sheet: {
      id: "A207_N",
      pdf: "https://drive.google.com/uc?export=download&id=1exampleDriveFileId0001",
      preview: null,
      crop: null,
    },
  });
  assert.equal(
    remote,
    "/api/sheet-pdf?requestId=sample-arch-bounds-733&sheetId=A207_N",
  );
  assert.equal(
    sheetFileHref({
      requestId: "maple-point",
      sheet: { id: "A-257", pdf: "", preview: null, crop: null },
    }),
    "",
  );
});

test("the pack viewer renders jump anchors and a file link for each sheet", () => {
  const viewer = readRepo("components/RoomPackViewer.tsx");
  const jumpStart = viewer.indexOf("function JumpLink");
  const jumpEnd = viewer.indexOf("function SheetSectionHeader");
  assert.ok(jumpStart >= 0 && jumpEnd > jumpStart);
  const jump = viewer.slice(jumpStart, jumpEnd);

  assert.match(jump, /<a\b/);
  assert.match(jump, /href=\{packSectionHref\(targetId\)\}/);
  assert.doesNotMatch(jump, /<button\b/);
  assert.match(viewer, /<JumpLink[\s\S]*?targetId=\{PACK_FLOOR_PLAN_ID\}/);
  assert.match(viewer, /<JumpLink[\s\S]*?targetId=\{targetId\}/);
  assert.match(viewer, /<JumpLink[\s\S]*?targetId=\{PACK_RFIS_ID\}/);
  assert.match(viewer, /<section id=\{PACK_FLOOR_PLAN_ID\}/);
  assert.match(viewer, /<article[\s\S]*id=\{targetId\}/);
  assert.match(viewer, /id=\{PACK_RFIS_ID\}/);
  assert.match(viewer, /id="sheets"/);
  assert.match(viewer, /sheetFileHref\(/);
  assert.match(viewer, /fileHref \? \([\s\S]*<a[\s\S]*href=\{fileHref\}/);
  assert.doesNotMatch(viewer, /\/api\/sheet-pdf/);
  assert.equal((viewer.match(/<main\b/g) ?? []).length, 1);
  assert.equal((viewer.match(/<SkipToMainContent/g) ?? []).length, 2);
});
