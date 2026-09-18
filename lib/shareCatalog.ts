/**
 * Maple Point pin catalog for the share-folder / viewer portal MVP.
 *
 * Demo data is fictional only. Never Brown / Rossi / Danoff / Suffolk / ILSB.
 * Lighting is its own pin group even when pack JSON stores E-102 as electrical.
 */

import {
  PINNED_SHEET_DISCIPLINES,
  type PinnedSheetDiscipline,
} from "./schema";

export const MAPLE_POINT_PROJECT_NAME = "Maple Point Medical Office";
export const MAPLE_POINT_REQUEST_ID = "maple-point";

export type SharePinCandidate = {
  project_name: string;
  sheet_id: string;
  rev: string;
  discipline: PinnedSheetDiscipline;
  title: string;
  request_id: string;
};

export type ShareRoomPackOption = {
  id: string;
  label: string;
  project_name: string;
  room: string;
  request_id: string;
  sheet_ids: string[];
};

export type ShareCatalog = {
  project_name: string;
  disciplines: PinnedSheetDiscipline[];
  sheets: SharePinCandidate[];
  room_packs: ShareRoomPackOption[];
};

export type SharePinDraft = {
  project_name: string;
  sheet_id: string;
  discipline: string;
  last_seen_rev: string;
  request_id: string;
};

const MAPLE_POINT_SHEETS: SharePinCandidate[] = [
  {
    project_name: MAPLE_POINT_PROJECT_NAME,
    sheet_id: "A-101",
    rev: "A",
    discipline: "architectural",
    title: "Level 1 Floor Plan",
    request_id: MAPLE_POINT_REQUEST_ID,
  },
  {
    project_name: MAPLE_POINT_PROJECT_NAME,
    sheet_id: "E-101",
    rev: "A",
    discipline: "electrical",
    title: "Level 1 Power Plan",
    request_id: MAPLE_POINT_REQUEST_ID,
  },
  {
    project_name: MAPLE_POINT_PROJECT_NAME,
    sheet_id: "E-102",
    rev: "A",
    discipline: "lighting",
    title: "Level 1 Lighting Plan",
    request_id: MAPLE_POINT_REQUEST_ID,
  },
];

export const SHARE_CATALOG: ShareCatalog = {
  project_name: MAPLE_POINT_PROJECT_NAME,
  disciplines: [...PINNED_SHEET_DISCIPLINES],
  sheets: MAPLE_POINT_SHEETS,
  room_packs: [
    {
      id: "maple-point",
      label: "Maple Point — Electrical Closet 101",
      project_name: MAPLE_POINT_PROJECT_NAME,
      room: "101",
      request_id: MAPLE_POINT_REQUEST_ID,
      sheet_ids: MAPLE_POINT_SHEETS.map((sheet) => sheet.sheet_id),
    },
    {
      id: "maple-point-733",
      label: "Maple Point — Room 733",
      project_name: MAPLE_POINT_PROJECT_NAME,
      room: "733",
      request_id: MAPLE_POINT_REQUEST_ID,
      sheet_ids: MAPLE_POINT_SHEETS.map((sheet) => sheet.sheet_id),
    },
  ],
};

export function isPinnedSheetDiscipline(
  value: unknown,
): value is PinnedSheetDiscipline {
  return (
    typeof value === "string" &&
    (PINNED_SHEET_DISCIPLINES as readonly string[]).includes(value)
  );
}

/** Classify a pack sheet into a viewer-portal pin group. */
export function classifyShareDiscipline(sheet: {
  id: string;
  title?: string | null;
  name?: string | null;
  discipline?: string | null;
}): PinnedSheetDiscipline {
  const text = [sheet.id, sheet.title, sheet.name, sheet.discipline]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  if (/\blighting\b/i.test(text) || sheet.discipline === "lighting") {
    return "lighting";
  }
  if (
    sheet.discipline === "architectural" ||
    /^A[-_.]?\d/i.test(sheet.id) ||
    /\barch(?:itectural)?\b/i.test(text)
  ) {
    return "architectural";
  }
  return "electrical";
}

export function sheetsForDiscipline(
  discipline: PinnedSheetDiscipline,
  catalog: ShareCatalog = SHARE_CATALOG,
): SharePinCandidate[] {
  return catalog.sheets.filter((sheet) => sheet.discipline === discipline);
}

export function expandDisciplinePins(
  discipline: PinnedSheetDiscipline,
  catalog: ShareCatalog = SHARE_CATALOG,
): SharePinDraft[] {
  return sheetsForDiscipline(discipline, catalog).map((sheet) => ({
    project_name: sheet.project_name,
    sheet_id: sheet.sheet_id,
    discipline,
    last_seen_rev: sheet.rev,
    request_id: sheet.request_id,
  }));
}

export function expandRoomPackPins(
  packId: string,
  catalog: ShareCatalog = SHARE_CATALOG,
): SharePinDraft[] | null {
  const pack = catalog.room_packs.find((option) => option.id === packId);
  if (!pack) return null;
  const byId = new Map(catalog.sheets.map((sheet) => [sheet.sheet_id, sheet]));
  const drafts: SharePinDraft[] = [];
  for (const sheetId of pack.sheet_ids) {
    const sheet = byId.get(sheetId);
    if (!sheet) continue;
    drafts.push({
      project_name: pack.project_name,
      sheet_id: sheet.sheet_id,
      discipline: pack.room,
      last_seen_rev: sheet.rev,
      request_id: pack.request_id,
    });
  }
  return drafts;
}

export function catalogRevMap(
  catalog: ShareCatalog = SHARE_CATALOG,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const sheet of catalog.sheets) {
    map.set(shareSheetKey(sheet.project_name, sheet.sheet_id), sheet.rev);
  }
  return map;
}

export function shareSheetKey(projectName: string, sheetId: string): string {
  return `${projectName.trim().toLowerCase()}::${sheetId.trim().toLowerCase()}`;
}

export function packHrefForSheet(requestId: string): string {
  return `/pack/${encodeURIComponent(requestId)}`;
}
