import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyShareDiscipline,
  expandDisciplinePins,
  expandRoomPackPins,
  SHARE_CATALOG,
  sheetsForDiscipline,
} from "./shareCatalog.ts";
import { bumpsFromPlan, planShareRefresh } from "./shareRefresh.ts";
import type { PinnedSheetRow, SheetRevisionCacheRow } from "./schema.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("share catalog is Maple Point / fictional only", () => {
  const blob = JSON.stringify(SHARE_CATALOG);
  assert.equal(forbidden.test(blob), false);
  assert.match(blob, /Maple Point/);
  assert.deepEqual(SHARE_CATALOG.disciplines, [
    "electrical",
    "lighting",
    "architectural",
  ]);
});

test("classifyShareDiscipline splits lighting off electrical pack JSON", () => {
  assert.equal(
    classifyShareDiscipline({
      id: "E-102",
      title: "Level 1 Lighting Plan",
      discipline: "electrical",
    }),
    "lighting",
  );
  assert.equal(
    classifyShareDiscipline({
      id: "E-101",
      title: "Level 1 Power Plan",
      discipline: "electrical",
    }),
    "electrical",
  );
  assert.equal(
    classifyShareDiscipline({
      id: "A-101",
      title: "Level 1 Floor Plan",
      discipline: "architectural",
    }),
    "architectural",
  );
});

test("pin full discipline expands Maple Point sheets", () => {
  const arch = expandDisciplinePins("architectural");
  assert.equal(arch.length, 1);
  assert.equal(arch[0]?.sheet_id, "A-101");
  assert.equal(arch[0]?.discipline, "architectural");

  const electrical = expandDisciplinePins("electrical");
  assert.deepEqual(
    electrical.map((pin) => pin.sheet_id),
    ["E-101"],
  );

  const lighting = expandDisciplinePins("lighting");
  assert.deepEqual(
    lighting.map((pin) => pin.sheet_id),
    ["E-102"],
  );
  assert.equal(sheetsForDiscipline("lighting").length, 1);
});

test("pin room pack uses room label as discipline", () => {
  const pins = expandRoomPackPins("maple-point");
  assert.ok(pins);
  assert.equal(pins?.length, 3);
  assert.ok(pins?.every((pin) => pin.discipline === "101"));
  assert.deepEqual(
    pins?.map((pin) => pin.sheet_id).sort(),
    ["A-101", "E-101", "E-102"],
  );
  assert.equal(expandRoomPackPins("unknown-pack"), null);
});

test("planShareRefresh marks bumped unchanged and missing", () => {
  const pins: PinnedSheetRow[] = [
    {
      id: "pin-a",
      folder_id: "folder-1",
      project_name: "Maple Point Medical Office",
      sheet_id: "A-101",
      discipline: "architectural",
      last_seen_rev: "A",
      last_pulled_at: null,
    },
    {
      id: "pin-e",
      folder_id: "folder-1",
      project_name: "Maple Point Medical Office",
      sheet_id: "E-101",
      discipline: "electrical",
      last_seen_rev: "A",
      last_pulled_at: null,
    },
    {
      id: "pin-missing",
      folder_id: "folder-1",
      project_name: "Maple Point Medical Office",
      sheet_id: "Z-999",
      discipline: "electrical",
      last_seen_rev: "A",
      last_pulled_at: null,
    },
  ];
  const cache: SheetRevisionCacheRow[] = [
    {
      id: "cache-a",
      project_name: "Maple Point Medical Office",
      sheet_id: "A-101",
      rev: "A",
      checked_at: "2026-09-18T00:00:00.000Z",
    },
  ];
  const current = new Map<string, string>([
    ["maple point medical office::a-101", "A"],
    ["maple point medical office::e-101", "B"],
  ]);
  const plan = planShareRefresh(pins, cache, current);
  assert.equal(plan.scanned, 3);
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.bumped, 1);
  assert.equal(plan.missing, 1);
  assert.equal(plan.items.find((item) => item.sheet_id === "E-101")?.status, "bumped");
  assert.equal(plan.items.find((item) => item.sheet_id === "A-101")?.status, "unchanged");
  assert.equal(plan.items.find((item) => item.sheet_id === "Z-999")?.status, "missing");
  assert.deepEqual(bumpsFromPlan(plan), [
    {
      sheet_id: "E-101",
      old_rev: "A",
      new_rev: "B",
      project_name: "Maple Point Medical Office",
    },
  ]);
});
