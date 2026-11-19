import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import { loadLiveRoomPack } from "./livePack.ts";
import { packLiveOpeningLine } from "./packLoadField.ts";
import { layoutSheetId } from "./packNormalize.ts";
import type { RoomPack, Sheet } from "./pack.ts";
import { packPageFound } from "./packPageFound.ts";
import {
  PACK_FLOOR_PLAN_ID,
  PACK_RFIS_ID,
  packDetailSections,
  packSectionHref,
  sheetFileHref,
} from "./packSections.ts";
import { splitPackSheets } from "./sheetOrder.ts";

const previous = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

const UNREACHABLE_SUPABASE_URL = "http://127.0.0.1:9";
const FORBIDDEN = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

afterEach(() => {
  restoreEnv("SUPABASE_URL", previous.SUPABASE_URL);
  restoreEnv("SUPABASE_ANON_KEY", previous.SUPABASE_ANON_KEY);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function clearSupabaseEnv() {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
}

function setUnreachableSupabaseEnv() {
  process.env.SUPABASE_URL = UNREACHABLE_SUPABASE_URL;
  process.env.SUPABASE_ANON_KEY = "anon-key-for-demo-pack-test";
}

function cedarRidgePack(): RoomPack {
  return JSON.parse(
    readFileSync(new URL("../public/packs/cedar-ridge.json", import.meta.url), "utf8"),
  ) as RoomPack;
}

function cedarSheets(): { primary: Sheet; rest: Sheet[] } {
  const pack = cedarRidgePack();
  const split = splitPackSheets(pack.sheets, layoutSheetId(pack.layout));
  assert.ok(split.primary);
  return { primary: split.primary, rest: split.rest };
}

test("Cedar Ridge resolves from the static fixture without a database", async () => {
  clearSupabaseEnv();
  const live = await loadLiveRoomPack({ requestId: "cedar-ridge" });
  assert.ok(live);
  assert.equal(live.source, "local");
  assert.equal(live.demoFallback, true);
  assert.equal(live.supabaseConfigured, false);
  assert.equal(live.pack.request_id, "cedar-ridge");
  assert.equal(live.pack.project.name, "Cedar Ridge Outpatient");
  assert.equal(live.pack.project.slug, "cedar-ridge");
  assert.equal(live.pack.room.name, "Procedure Room 214");
  assert.equal(live.pack.room.number, "214");
  assert.deepEqual(
    live.pack.sheets.map((sheet) => sheet.id),
    ["M-201", "A-201", "E-214"],
  );
  assert.deepEqual(
    live.pack.rfis.map((rfi) => rfi.number),
    ["RFI-014", "RFI-018", "RFI-022"],
  );
  assert.equal(packPageFound({ requestId: "cedar-ridge", live }), true);
  assert.doesNotMatch(JSON.stringify(live.pack), /Maple Point/);
  assert.doesNotMatch(JSON.stringify(live.pack), FORBIDDEN);
  assert.match(
    packLiveOpeningLine({
      supabaseConfigured: false,
      demoFallback: live.demoFallback,
      source: live.source,
      pull: live.pull,
      pack: live.pack,
    }),
    /^Demo pack \(Cedar Ridge Outpatient\)/,
  );
  assert.doesNotMatch(
    packLiveOpeningLine({
      supabaseConfigured: false,
      demoFallback: live.demoFallback,
      source: live.source,
      pull: live.pull,
      pack: live.pack,
    }),
    /Maple Point/,
  );

  const maple = await loadLiveRoomPack({ requestId: "maple-point" });
  assert.equal(maple?.pack.request_id, "maple-point");
  assert.equal(maple?.pack.project.name, "Maple Point Medical Office");
  assert.equal(
    packLiveOpeningLine({
      supabaseConfigured: false,
      demoFallback: true,
      source: "local",
      pack: maple?.pack,
    }),
    "Demo pack (Maple Point). Supabase / Procore path is unset locally.",
  );
});

test("Cedar Ridge still resolves when Supabase is set but unreachable", async () => {
  setUnreachableSupabaseEnv();
  const live = await loadLiveRoomPack({ requestId: "cedar-ridge" });
  assert.ok(live);
  assert.equal(live.supabaseConfigured, true);
  assert.equal(live.source, "local");
  assert.equal(live.demoFallback, true);
  assert.equal(live.pack.request_id, "cedar-ridge");
  assert.equal(live.pack.project.name, "Cedar Ridge Outpatient");
  assert.equal(packPageFound({ requestId: "cedar-ridge", live }), true);
  assert.equal(
    packLiveOpeningLine({
      supabaseConfigured: true,
      demoFallback: live.demoFallback,
      source: live.source,
      pull: live.pull,
      pack: live.pack,
    }),
    "Demo pack (Cedar Ridge Outpatient) · A-201 Rev B · pulled 2026-09-18 00:15:17Z.",
  );
});

test("Cedar Ridge jump hrefs are unique and sheet files exist", () => {
  const { primary, rest } = cedarSheets();
  assert.equal(primary.id, "A-201");
  const details = packDetailSections(rest);
  assert.deepEqual(
    details.map((detail) => detail.sheet.id),
    ["M-201", "E-214"],
  );

  const hrefs = [
    packSectionHref(PACK_FLOOR_PLAN_ID),
    ...details.map((detail) => packSectionHref(detail.targetId)),
    packSectionHref(PACK_RFIS_ID),
  ];
  assert.deepEqual(hrefs, [
    "#floor-plan",
    "#sheet-M-201",
    "#sheet-E-214",
    "#rfis",
  ]);
  const ids = hrefs.map((href) => href.slice(1));
  assert.equal(new Set(ids).size, ids.length);

  const fileHrefs = [primary, ...rest].map((sheet) =>
    sheetFileHref({ requestId: "cedar-ridge", sheet }),
  );
  assert.deepEqual(fileHrefs, [
    "/packs/cedar-ridge-a201.pdf",
    "/packs/cedar-ridge-m201.pdf",
    "/packs/cedar-ridge-e214.pdf",
  ]);
  for (const href of fileHrefs) {
    assert.equal(href.startsWith("/packs/cedar-ridge-"), true);
    const file = new URL(`../public${href}`, import.meta.url);
    assert.equal(existsSync(file), true, href);
    const bytes = readFileSync(file);
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
  }
});

test("unknown pack ids miss with and without Supabase", async () => {
  clearSupabaseEnv();
  const offline = await loadLiveRoomPack({ requestId: "does-not-exist" });
  assert.equal(offline, null);
  assert.equal(
    packPageFound({ requestId: "does-not-exist", live: offline }),
    false,
  );

  setUnreachableSupabaseEnv();
  const online = await loadLiveRoomPack({ requestId: "does-not-exist" });
  assert.equal(online, null);
  assert.equal(
    packPageFound({ requestId: "does-not-exist", live: online }),
    false,
  );

  clearSupabaseEnv();
  const harbor = await loadLiveRoomPack({ requestId: "harbor-view" });
  assert.equal(harbor?.demoFallback, true);
  assert.equal(harbor?.pack.request_id, "maple-point");
  assert.equal(packPageFound({ requestId: "harbor-view", live: harbor }), true);
});
