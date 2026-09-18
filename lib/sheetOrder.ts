import type { Sheet } from "./pack";

const ARCH_ID = /^A[-_.]?\d/i;
const ARCH_WORD = /\barch(?:itectural)?\b/i;
const FLOOR_PLAN = /\bfloor\s*plans?\b|\bfloorplan\b|\bflr\s*pln\b/i;
const NOT_PLAN = /\b(elev(?:ation)?s?|sections?|details?|schedules?|rcp|reflected)\b/i;
const MEP_PLAN =
  /\b(power|lighting|electrical|mechanical|plumbing|fire\s*alarm)\b/i;

function haystack(sheet: Sheet): string {
  return [sheet.id, sheet.title, sheet.name, sheet.discipline]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
}

/**
 * Score a sheet as a clean architectural floor plan. A-* / architectural /
 * "floor plan" win. Elevations, schedules, and MEP plans lose.
 */
export function architecturalScore(sheet: Sheet): number {
  const text = haystack(sheet);
  const id = sheet.id.trim();
  let score = 0;
  if (ARCH_ID.test(id)) score += 40;
  if (ARCH_WORD.test(text)) score += 30;
  if (FLOOR_PLAN.test(text)) score += 25;
  if (NOT_PLAN.test(text)) score -= 35;
  if (MEP_PLAN.test(text) && !ARCH_WORD.test(text) && !ARCH_ID.test(id)) {
    score -= 20;
  }
  return score;
}

export function isArchitecturalFloorPlan(sheet: Sheet): boolean {
  return architecturalScore(sheet) >= 25;
}

/**
 * Prefer a clean architectural floor plan when the pack includes one.
 * Otherwise keep the current primary (layout.sheet, else sheets[0]).
 */
export function pickPrimarySheet(
  sheets: Sheet[],
  layoutSheetId?: string,
): Sheet | undefined {
  if (sheets.length === 0) return undefined;

  let best: Sheet | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const sheet of sheets) {
    const score = architecturalScore(sheet);
    if (score > bestScore) {
      best = sheet;
      bestScore = score;
    }
  }
  if (best && bestScore >= 25) return best;
  return sheets.find((sheet) => sheet.id === layoutSheetId) ?? sheets[0];
}

export function splitPackSheets(
  sheets: Sheet[],
  layoutSheetId?: string,
): { primary: Sheet | undefined; rest: Sheet[] } {
  const primary = pickPrimarySheet(sheets, layoutSheetId);
  if (!primary) return { primary: undefined, rest: [] };
  return {
    primary,
    rest: sheets.filter((sheet) => sheet.id !== primary.id),
  };
}

export function sheetKindLabel(sheet: Sheet, isPrimary = false): string {
  if (isPrimary && isArchitecturalFloorPlan(sheet)) return "Floor plan";
  if (isPrimary) return "Plan";
  const text = haystack(sheet);
  if (/\blighting\b/i.test(text)) return "Lighting";
  if (/\bpower\b/i.test(text)) return "Power";
  if (/\belectrical\b/i.test(text)) return "Electrical";
  if (MEP_PLAN.test(text)) return "Detail sheet";
  return sheet.title?.trim() || sheet.name?.trim() || "Sheet";
}
