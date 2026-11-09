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
/** Browser title for /nope and /_not-found. */
export const PAGE_NOT_FOUND_DOCUMENT_TITLE = "Page not found — GC Field Log";
/** Meta description. Matches the page card line. Card headings stay as they are. */
export const PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION = PAGE_NOT_FOUND_MESSAGE;
export const MAPLE_POINT_DEMO_LABEL = "Open Maple Point demo";
export const HOME_LABEL = "Home";
export const LINK_NOT_FOUND_TITLE = "Link not found";
export const LINK_NOT_FOUND_MESSAGE = "It may be old.";
/** Browser title for a bad invite or pack. */
export const LINK_NOT_FOUND_DOCUMENT_TITLE = "Link not found — GC Field Log";
/** Meta description. Matches the link card line. */
export const LINK_NOT_FOUND_DOCUMENT_DESCRIPTION = LINK_NOT_FOUND_MESSAGE;

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
 * Sign-in and account-creation aliases, including /log-in, /join,
 * /create-account, /get-started, /start, /trial, /free-trial, and
 * /onboarding. /download, /ios, /app-store, /android, /how-it-works,
 * /tour, /mobile, /web, /apps, /mobile-app, /iphone, /ipad,
 * /app-store-link, /free, /sign-up-free, /free-account, /signup-free,
 * /welcome, /web-app, /beta, /waitlist, /early-access, /register-now,
 * /join-now, /login-page, /signin-page, /download-app, /get-the-app,
 * /ios-app, /getting-started, /start-here, /sign-in-page, /log-in-page,
 * /create-an-account, /register-account, /open-account, /new-account,
 * /start-free, /ios-download, /get-app, /mobile-download, /appstore,
 * /login-help, /recover, and /account-recovery
 * use the same temporary redirect. Each name is one exact path segment.
 * /free-account does not match /free. /signup-free does not match /signup
 * or /sign-up-free. /web-app does not match /web. /early-access does not
 * match /early. /register-now does not match /register. /join-now does not
 * match /join. /login-page does not match /login or /log-in. /signin-page
 * does not match /signin or /sign-in. /download-app does not match
 * /download. /get-the-app does not match /get-started. /ios-app does not
 * match /ios. /getting-started does not match /get-started. /start-here
 * does not match /start. /sign-in-page does not match /sign-in or
 * /signin-page. /log-in-page does not match /log-in or /login-page.
 * /create-an-account does not match /create-account. /register-account
 * does not match /register or /register-now. /open-account and
 * /new-account do not match /account. /start-free does not match /start
 * or /free. /ios-download does not match /ios, /ios-app, or /download.
 * /get-app does not match /get-the-app or /get-started. /mobile-download
 * does not match /mobile or /download. /appstore does not match
 * /app-store. /login-help does not match /login. /account-recovery does
 * not match /recover or /account.
 * /sign-up-page, /signup-page, /create-account-page, /download-ios,
 * /app-download, /logon, /signon, /install, /install-app, and /iphone-app
 * use that same hop. /sign-up-page does not match /sign-up or
 * /sign-up-free. /signup-page does not match /signup or /signup-free.
 * /create-account-page does not match /create-account.
 * /download-ios does not match /ios-download, /ios, or /download.
 * /app-download does not match /download-app or /download.
 * /install-app does not match /install. /iphone-app does not match
 * /iphone or /ios-app. /logon does not match /login. /signon does not
 * match /signin.
 * /onboard, /welcome-back, /thank-you, /thanks, /success, and /cancel
 * use that same hop. /onboard does not match /onboarding.
 * /welcome-back does not match /welcome or /welcome-page.
 * /thank-you does not match /thanks. /thanks does not match /thank-you.
 * /success and /cancel are this exact path only. Checkout returns
 * stay on /pricing. Next matches this source without case
 * sensitivity and allows one trailing slash. Query values pass through
 * to `/`. permanent: false is the same temporary 307 as /login and /signup.
 */
export const SIGN_IN_ALIAS_SOURCE =
  "/:alias(login|log-in|signin|sign-in|signup-page|signup|sign-up-page|sign-up|register|join|create-account-page|create-account|get-started|start|trial|free-trial|onboarding|onboard|download|ios|app-store|android|how-it-works|tour|mobile|web|apps|mobile-app|iphone-app|iphone|ipad|app-store-link|free|sign-up-free|free-account|signup-free|welcome-back|welcome|web-app|beta|waitlist|early-access|register-now|join-now|login-page|signin-page|download-app|get-the-app|ios-app|getting-started|start-here|sign-in-page|log-in-page|create-an-account|register-account|open-account|new-account|start-free|ios-download|get-app|mobile-download|appstore|login-help|recover|account-recovery|download-ios|app-download|logon|signon|install-app|install|thank-you|thanks|success|cancel)";

const SIGN_IN_ALIAS_PATH =
  /^\/(?:login|log-in|signin|sign-in|signup-page|signup|sign-up-page|sign-up|register|join|create-account-page|create-account|get-started|start|trial|free-trial|onboarding|onboard|download|ios|app-store|android|how-it-works|tour|mobile|web|apps|mobile-app|iphone-app|iphone|ipad|app-store-link|free|sign-up-free|free-account|signup-free|welcome-back|welcome|web-app|beta|waitlist|early-access|register-now|join-now|login-page|signin-page|download-app|get-the-app|ios-app|getting-started|start-here|sign-in-page|log-in-page|create-an-account|register-account|open-account|new-account|start-free|ios-download|get-app|mobile-download|appstore|login-help|recover|account-recovery|download-ios|app-download|logon|signon|install-app|install|thank-you|thanks|success|cancel)\/?$/i;

/**
 * Demo booking aliases have no page. Each name is one exact path segment
 * and a temporary move straight to the Maple Point pack, not to /demo.
 * /demo-video uses that same hop. It does not match /demo.
 * /book-a-demo, /try, /try-free, /freetrial, and /request-quote use that
 * same hop. /book-a-demo does not match /book-demo. /try does not match
 * /try-free, /trial, or /freetrial. /try-free does not match /free or
 * /free-trial. /freetrial does not match /free-trial or /free.
 * /request-quote does not match /quote, /get-quote, or /request-demo.
 * /try-it, /try-it-free, /demo-now, /schedule, /book-demo-now, and
 * /see-demo use that same hop. /try-it does not match /try. /try-it-free
 * does not match /try-free, /try-it, or /free. /demo-now does not match
 * /demo or /demo-video. /schedule does not match /schedule-demo. It is
 * this exact path only, a temporary move to the Maple Point pack.
 * /book-demo-now does not match /book-demo or /book-a-demo. /see-demo
 * does not match /get-demo or /demo.
 * /schedule-a-demo, /see-it-in-action, /product-demo, /live-demo,
 * /interactive-demo, and /try-demo use that same hop. /schedule-a-demo
 * does not match /schedule or /schedule-demo. /see-it-in-action does not
 * match /see-demo. /product-demo does not match /demo or /demo-now.
 * /live-demo and /interactive-demo do not match /demo. /try-demo does
 * not match /try or /demo.
 * Next matches this source without case sensitivity and allows one
 * trailing slash. Query values pass through. permanent: false is HTTP 307.
 */
export const DEMO_ALIAS_SOURCE =
  "/:alias(book-demo|request-demo|schedule-demo|get-demo|demo-video|book-a-demo|try-demo|try|try-free|freetrial|request-quote|try-it-free|try-it|demo-now|schedule-a-demo|schedule|book-demo-now|see-demo|see-it-in-action|product-demo|live-demo|interactive-demo)";

const DEMO_ALIAS_PATH =
  /^\/(?:book-demo|request-demo|schedule-demo|get-demo|demo-video|book-a-demo|try-demo|try|try-free|freetrial|request-quote|try-it-free|try-it|demo-now|schedule-a-demo|schedule|book-demo-now|see-demo|see-it-in-action|product-demo|live-demo|interactive-demo)\/?$/i;

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

/** Where a sign-in or account-creation alias should land, or null when the path is not an alias. */
export function signInAliasDestination(pathname: string, search = ""): string | null {
  if (!SIGN_IN_ALIAS_PATH.test(pathname)) return null;
  if (!search || search === "?") return HOME_HREF;
  const query = search.startsWith("?") ? search : `?${search}`;
  return `${HOME_HREF}${query}`;
}

export function demoAliasRedirects(): Array<{
  source: string;
  destination: string;
  permanent: boolean;
}> {
  return [
    {
      source: DEMO_ALIAS_SOURCE,
      destination: MAPLE_POINT_DEMO_HREF,
      permanent: false,
    },
  ];
}

/** Where a demo booking alias should land, or null when the path is not one. */
export function demoAliasDestination(pathname: string, search = ""): string | null {
  if (!DEMO_ALIAS_PATH.test(pathname)) return null;
  if (!search || search === "?") return MAPLE_POINT_DEMO_HREF;
  const query = search.startsWith("?") ? search : `?${search}`;
  return `${MAPLE_POINT_DEMO_HREF}${query}`;
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
