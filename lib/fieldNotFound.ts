/**
 * Field copy and path aliases for a missing page or pack.
 * Short title, one short line. No file paths, no request ids.
 */

export const MAPLE_POINT_DEMO_HREF = "/pack/maple-point";
export const HOME_HREF = "/";

export const FIELD_NOT_FOUND_TITLE = "Pack not found";
export const FIELD_NOT_FOUND_MESSAGE =
  "This link may be old. Open the Maple Point demo or go home.";
export const PAGE_NOT_FOUND_TITLE = "Page not found";
export const PAGE_NOT_FOUND_MESSAGE =
  "This page isn't here. Go home or open the Maple Point demo.";
export const MAPLE_POINT_DEMO_LABEL = "Open Maple Point demo";
export const HOME_LABEL = "Home";
export const LINK_NOT_FOUND_TITLE = "Link not found";
export const LINK_NOT_FOUND_MESSAGE = "It may be old.";

/**
 * Set by the proxy when a matched invite or pack id does not resolve.
 * The root not-found page reads it. Clients cannot keep a spoofed value:
 * the proxy deletes this header unless it decided the link is missing.
 */
export const FIELD_NOT_FOUND_HEADER = "x-gc-field-not-found";
export const FIELD_LINK_MISS = "link";

/** Query value and in-page id for the sheet block on a pack. */
export const SHEETS_SECTION = "sheets";

export type FieldNotFoundVariant = "pack" | "page" | "link";

export type FieldNotFoundAction = {
  href: string;
  label: string;
};

export type FieldNotFoundCopy = {
  title: string;
  message: string;
  primary: FieldNotFoundAction;
  secondary: FieldNotFoundAction;
};

/** Pack, page, and bad-link cards. Bad invite and pack URLs use the link card. */
export function fieldNotFoundCopy(variant: FieldNotFoundVariant): FieldNotFoundCopy {
  if (variant === "pack") {
    return {
      title: FIELD_NOT_FOUND_TITLE,
      message: FIELD_NOT_FOUND_MESSAGE,
      primary: { href: MAPLE_POINT_DEMO_HREF, label: MAPLE_POINT_DEMO_LABEL },
      secondary: { href: HOME_HREF, label: HOME_LABEL },
    };
  }
  if (variant === "link") {
    return {
      title: LINK_NOT_FOUND_TITLE,
      message: LINK_NOT_FOUND_MESSAGE,
      primary: { href: HOME_HREF, label: HOME_LABEL },
      secondary: { href: MAPLE_POINT_DEMO_HREF, label: MAPLE_POINT_DEMO_LABEL },
    };
  }
  return {
    title: PAGE_NOT_FOUND_TITLE,
    message: PAGE_NOT_FOUND_MESSAGE,
    primary: { href: HOME_HREF, label: HOME_LABEL },
    secondary: { href: MAPLE_POINT_DEMO_HREF, label: MAPLE_POINT_DEMO_LABEL },
  };
}

export function fieldNotFoundSpeak(variant: FieldNotFoundVariant): string {
  const copy = fieldNotFoundCopy(variant);
  return `${copy.title}. ${copy.message}`;
}

/**
 * Sign-in aliases. Next matches this source without case sensitivity
 * and allows one trailing slash. Query values pass through to `/`.
 */
export const SIGN_IN_ALIAS_SOURCE = "/:alias(login|signin|sign-in)";

const SIGN_IN_ALIAS_PATH = /^\/(?:login|signin|sign-in)\/?$/i;

export function signInAliasRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    {
      source: SIGN_IN_ALIAS_SOURCE,
      destination: HOME_HREF,
      permanent: false,
    },
  ];
}

/** Where a sign-in alias should land, or null when the path is not an alias. */
export function signInAliasDestination(pathname: string, search = ""): string | null {
  if (!SIGN_IN_ALIAS_PATH.test(pathname)) return null;
  if (!search || search === "?") return HOME_HREF;
  const query = search.startsWith("?") ? search : `?${search}`;
  return `${HOME_HREF}${query}`;
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
