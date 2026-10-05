/**
 * Field copy and path aliases for a missing page or pack.
 * Short title, one short line. No file paths, no request ids.
 */

export const MAPLE_POINT_DEMO_HREF = "/pack/maple-point";
export const HOME_HREF = "/";

export const FIELD_NOT_FOUND_TITLE = "Pack not found";
export const FIELD_NOT_FOUND_MESSAGE =
  "This link may be old. Open the Maple Point demo or go home.";
export const MAPLE_POINT_DEMO_LABEL = "Open Maple Point demo";
export const HOME_LABEL = "Home";

/** Query value and in-page id for the sheet block on a pack. */
export const SHEETS_SECTION = "sheets";

export function fieldNotFoundSpeak(): string {
  return `${FIELD_NOT_FOUND_TITLE}. ${FIELD_NOT_FOUND_MESSAGE}`;
}

export function opensSheetsSection(
  section: string | string[] | undefined,
): boolean {
  if (section === SHEETS_SECTION) return true;
  return Array.isArray(section) && section.includes(SHEETS_SECTION);
}

export function queryToSearchParams(
  query: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") {
      params.append(key, value);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const item of value) params.append(key, item);
  }
  return params;
}

function isSheetsSlug(slug: readonly string[]): boolean {
  return slug.length === 1 && slug[0].toLowerCase() === SHEETS_SECTION;
}

/**
 * Where an unknown path under a pack should land.
 * `/sheets` opens the sheet block. Anything else returns to the pack.
 */
export function packSubpathHref(
  packId: string,
  slug: readonly string[],
  search?: URLSearchParams,
): string {
  const params = new URLSearchParams(search);
  params.delete("section");
  if (isSheetsSlug(slug)) params.set("section", SHEETS_SECTION);
  const qs = params.toString();
  return `/pack/${encodeURIComponent(packId)}${qs ? `?${qs}` : ""}`;
}

export type PackSubpathDecision =
  | { type: "not-found" }
  | { type: "redirect"; href: string };

export function packSubpathDecision(input: {
  packId: string;
  slug: readonly string[];
  packFound: boolean;
  search?: URLSearchParams;
}): PackSubpathDecision {
  if (!input.packFound) return { type: "not-found" };
  return {
    type: "redirect",
    href: packSubpathHref(input.packId, input.slug, input.search),
  };
}
