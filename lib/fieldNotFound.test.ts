import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  FIELD_NOT_FOUND_MESSAGE,
  FIELD_NOT_FOUND_TITLE,
  HOME_HREF,
  HOME_LABEL,
  LINK_NOT_FOUND_DOCUMENT_DESCRIPTION,
  LINK_NOT_FOUND_DOCUMENT_TITLE,
  LINK_NOT_FOUND_MESSAGE,
  LINK_NOT_FOUND_TITLE,
  MAPLE_POINT_DEMO_HREF,
  MAPLE_POINT_DEMO_LABEL,
  PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
  PAGE_NOT_FOUND_DOCUMENT_TITLE,
  PAGE_NOT_FOUND_MESSAGE,
  PAGE_NOT_FOUND_TITLE,
  SHEETS_SECTION,
  DEMO_ALIAS_SOURCE,
  SIGN_IN_ALIAS_SOURCE,
  demoAliasDestination,
  demoAliasRedirects,
  fieldNotFoundCopy,
  fieldNotFoundSpeak,
  opensSheetsSection,
  packSubpathDecision,
  packSubpathHref,
  signInAliasDestination,
  signInAliasRedirects,
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
  const packCopy = fieldNotFoundCopy("pack");
  const speak = fieldNotFoundSpeak("pack");
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
  assert.equal(packCopy.title, FIELD_NOT_FOUND_TITLE);
  assert.equal(packCopy.message, FIELD_NOT_FOUND_MESSAGE);
  assert.deepEqual(packCopy.primary, {
    href: MAPLE_POINT_DEMO_HREF,
    label: MAPLE_POINT_DEMO_LABEL,
  });
  assert.deepEqual(packCopy.secondary, { href: HOME_HREF, label: HOME_LABEL });

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
  assert.match(card, /copy\.primary/);
  assert.match(card, /href=\{copy\.primary\.href\}/);
  assert.match(card, /href=\{copy\.secondary\.href\}/);
  assert.match(card, /<a/);
  assert.doesNotMatch(card, /next\/link/);
  assert.match(card, /fieldNotFoundSpeak\(variant\)/);
  assert.doesNotMatch(card, /"use client"/);
});

test("page not-found is a different card from a pack miss", () => {
  const page = fieldNotFoundCopy("page");
  const speak = fieldNotFoundSpeak("page");
  assert.equal(page.title, "Page not found");
  assert.equal(PAGE_NOT_FOUND_TITLE, "Page not found");
  assert.equal(
    page.message,
    "This page isn't here. Go home or open the Maple Point demo.",
  );
  assert.equal(PAGE_NOT_FOUND_MESSAGE, page.message);
  assert.deepEqual(page.primary, { href: "/", label: "Home" });
  assert.deepEqual(page.secondary, {
    href: "/pack/maple-point",
    label: "Open Maple Point demo",
  });
  assert.equal(
    speak,
    "Page not found. This page isn't here. Go home or open the Maple Point demo.",
  );

  const rendered = [page.title, page.message, page.primary.label, page.secondary.label, speak].join(
    "\n",
  );
  assert.doesNotMatch(rendered, /Pack/);
  for (const pattern of FORBIDDEN) {
    assert.doesNotMatch(rendered, pattern);
  }

  const root = readRepo("app/not-found.tsx");
  const pack = readRepo("app/pack/[requestId]/not-found.tsx");
  assert.match(root, /"page"/);
  assert.match(root, /FIELD_LINK_MISS \? "link"/);
  assert.match(pack, /variant="link"/);
  assert.doesNotMatch(root, /variant="pack"/);
  assert.doesNotMatch(pack, /variant="page"/);

  const css = readRepo("app/globals.css");
  const banner = readRepo("components/AppleComingSoonBanner.tsx");
  assert.match(css, /body:has\(\[data-field-not-found\]\) \[data-site-banner\]/);
  assert.match(css, /display:\s*none/);
  assert.match(banner, /data-site-banner/);
  assert.match(readRepo("components/FieldNotFound.tsx"), /data-field-not-found/);
});

test("a bad invite or pack link uses a shorter card than a missing page", () => {
  const link = fieldNotFoundCopy("link");
  const speak = fieldNotFoundSpeak("link");
  assert.equal(LINK_NOT_FOUND_TITLE, "Link not found");
  assert.equal(LINK_NOT_FOUND_MESSAGE, "It may be old.");
  assert.equal(link.title, LINK_NOT_FOUND_TITLE);
  assert.equal(link.message, LINK_NOT_FOUND_MESSAGE);
  assert.deepEqual(link.primary, { href: "/", label: "Home" });
  assert.deepEqual(link.secondary, {
    href: "/pack/maple-point",
    label: "Open Maple Point demo",
  });
  assert.equal(speak, "Link not found. It may be old.");
  assert.notEqual(link.title, fieldNotFoundCopy("page").title);
  assert.notEqual(link.title, fieldNotFoundCopy("pack").title);

  const rendered = [link.title, link.message, link.primary.label, link.secondary.label, speak].join(
    "\n",
  );
  for (const pattern of FORBIDDEN) {
    assert.doesNotMatch(rendered, pattern);
  }

  assert.match(readRepo("app/invite/[token]/not-found.tsx"), /variant="link"/);
  assert.match(readRepo("app/pack/[requestId]/not-found.tsx"), /variant="link"/);
  assert.match(readRepo("components/FieldNotFound.tsx"), /<a/);
  assert.match(readRepo("components/FieldNotFound.tsx"), /Hear this/);
});

test("branded 404 document title names GC Field Log and keeps the card headings", () => {
  assert.equal(PAGE_NOT_FOUND_DOCUMENT_TITLE, "Page not found — GC Field Log");
  assert.equal(PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION, PAGE_NOT_FOUND_MESSAGE);
  assert.equal(
    PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION,
    "This page isn't here. Go home or open the Maple Point demo.",
  );
  assert.equal(LINK_NOT_FOUND_DOCUMENT_TITLE, "Link not found — GC Field Log");
  assert.equal(LINK_NOT_FOUND_DOCUMENT_DESCRIPTION, LINK_NOT_FOUND_MESSAGE);
  assert.equal(LINK_NOT_FOUND_DOCUMENT_DESCRIPTION, "It may be old.");
  assert.equal(fieldNotFoundCopy("page").title, "Page not found");
  assert.equal(fieldNotFoundCopy("link").title, "Link not found");
  assert.notEqual(LINK_NOT_FOUND_DOCUMENT_TITLE, PAGE_NOT_FOUND_DOCUMENT_TITLE);
  assert.notEqual(fieldNotFoundCopy("link").title, PAGE_NOT_FOUND_DOCUMENT_TITLE);

  const root = readRepo("app/not-found.tsx");
  assert.match(root, /PAGE_NOT_FOUND_DOCUMENT_TITLE/);
  assert.match(root, /PAGE_NOT_FOUND_DOCUMENT_DESCRIPTION/);
  assert.match(root, /absolute: PAGE_NOT_FOUND_DOCUMENT_TITLE/);
  assert.match(root, /LINK_NOT_FOUND_DOCUMENT_TITLE/);
  assert.match(root, /LINK_NOT_FOUND_DOCUMENT_DESCRIPTION/);
  assert.match(root, /absolute: LINK_NOT_FOUND_DOCUMENT_TITLE/);
  assert.match(root, /FIELD_LINK_MISS/);
  assert.match(root, /index:\s*false/);
  assert.match(root, /follow:\s*false/);

  for (const file of [
    "app/invite/[token]/not-found.tsx",
    "app/pack/[requestId]/not-found.tsx",
  ]) {
    const text = readRepo(file);
    assert.match(text, /LINK_NOT_FOUND_DOCUMENT_TITLE/, file);
    assert.match(text, /LINK_NOT_FOUND_DOCUMENT_DESCRIPTION/, file);
    assert.match(text, /absolute: LINK_NOT_FOUND_DOCUMENT_TITLE/, file);
    assert.doesNotMatch(text, /PAGE_NOT_FOUND_DOCUMENT_TITLE/, file);
    assert.match(text, /index:\s*false/, file);
    assert.match(text, /follow:\s*false/, file);
  }
});

test("sign-in aliases, /join, /create-account, /get-started, /start, /trial, /free-trial, /onboarding, /download, /ios, /app-store, /android, /how-it-works, /tour, /mobile, /web, /apps, /mobile-app, /iphone, /ipad, /app-store-link, /free, /sign-up-free, /free-account, /signup-free, /welcome, /web-app, /beta, /waitlist, /early-access, /register-now, /join-now, /login-page, /signin-page, /download-app, /get-the-app, /ios-app, /getting-started, and /start-here redirect home (307) and keep the query", () => {
  assert.deepEqual(signInAliasRedirects(), [
    {
      source: SIGN_IN_ALIAS_SOURCE,
      destination: "/",
      permanent: false,
    },
  ]);
  assert.equal(
    SIGN_IN_ALIAS_SOURCE,
    "/:alias(login|log-in|signin|sign-in|signup|sign-up|register|join|create-account|get-started|start|trial|free-trial|onboarding|download|ios|app-store|android|how-it-works|tour|mobile|web|apps|mobile-app|iphone|ipad|app-store-link|free|sign-up-free|free-account|signup-free|welcome|web-app|beta|waitlist|early-access|register-now|join-now|login-page|signin-page|download-app|get-the-app|ios-app|getting-started|start-here)",
  );
  assert.equal(signInAliasRedirects()[0]?.permanent, false);
  assert.equal(signInAliasRedirects()[0]?.permanent ? 308 : 307, 307);
  assert.equal(signInAliasRedirects()[0]?.destination, "/");

  const config = readRepo("next.config.ts");
  assert.match(config, /signInAliasRedirects\(\)/);
  assert.doesNotMatch(config, /\/free-account|\/signup-free|\/welcome|\/web-app|\/beta|\/waitlist|\/early-access|\/register-now|\/join-now|\/login-page|\/signin-page|\/download-app|\/get-the-app|\/ios-app|\/getting-started|\/start-here/);
  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/free-account|\/signup-free|\/welcome|\/web-app|\/beta|\/waitlist|\/early-access|\/register-now|\/join-now|\/login-page|\/signin-page|\/download-app|\/get-the-app|\/ios-app|\/getting-started|\/start-here/);
  assert.doesNotMatch(proxy, /redirect/);

  assert.equal(signInAliasDestination("/login"), "/");
  assert.equal(signInAliasDestination("/login/"), "/");
  assert.equal(signInAliasDestination("/LOGIN"), "/");
  assert.equal(signInAliasDestination("/Login/"), "/");
  assert.equal(signInAliasDestination("/log-in"), "/");
  assert.equal(signInAliasDestination("/log-in/"), "/");
  assert.equal(signInAliasDestination("/LOG-IN"), "/");
  assert.equal(signInAliasDestination("/Log-In/"), "/");
  assert.equal(signInAliasDestination("/signin"), "/");
  assert.equal(signInAliasDestination("/SIGNIN/"), "/");
  assert.equal(signInAliasDestination("/sign-in"), "/");
  assert.equal(signInAliasDestination("/Sign-In/"), "/");
  assert.equal(signInAliasDestination("/sIgN-iN"), "/");
  assert.equal(signInAliasDestination("/signup"), "/");
  assert.equal(signInAliasDestination("/signup/"), "/");
  assert.equal(signInAliasDestination("/SIGNUP"), "/");
  assert.equal(signInAliasDestination("/sign-up"), "/");
  assert.equal(signInAliasDestination("/Sign-Up/"), "/");
  assert.equal(signInAliasDestination("/register"), "/");
  assert.equal(signInAliasDestination("/REGISTER/"), "/");
  assert.equal(signInAliasDestination("/join"), "/");
  assert.equal(signInAliasDestination("/join/"), "/");
  assert.equal(signInAliasDestination("/JOIN"), "/");
  assert.equal(signInAliasDestination("/Join/"), "/");
  assert.equal(signInAliasDestination("/create-account"), "/");
  assert.equal(signInAliasDestination("/create-account/"), "/");
  assert.equal(signInAliasDestination("/CREATE-ACCOUNT"), "/");
  assert.equal(signInAliasDestination("/Create-Account/"), "/");
  assert.equal(signInAliasDestination("/get-started"), "/");
  assert.equal(signInAliasDestination("/get-started/"), "/");
  assert.equal(signInAliasDestination("/GET-STARTED"), "/");
  assert.equal(signInAliasDestination("/Get-Started/"), "/");
  assert.equal(signInAliasDestination("/start"), "/");
  assert.equal(signInAliasDestination("/start/"), "/");
  assert.equal(signInAliasDestination("/START"), "/");
  assert.equal(signInAliasDestination("/Start/"), "/");
  assert.equal(signInAliasDestination("/trial"), "/");
  assert.equal(signInAliasDestination("/trial/"), "/");
  assert.equal(signInAliasDestination("/TRIAL"), "/");
  assert.equal(signInAliasDestination("/Trial/"), "/");
  assert.equal(signInAliasDestination("/free-trial"), "/");
  assert.equal(signInAliasDestination("/free-trial/"), "/");
  assert.equal(signInAliasDestination("/FREE-TRIAL"), "/");
  assert.equal(signInAliasDestination("/Free-Trial/"), "/");
  assert.equal(signInAliasDestination("/onboarding"), "/");
  assert.equal(signInAliasDestination("/onboarding/"), "/");
  assert.equal(signInAliasDestination("/ONBOARDING"), "/");
  assert.equal(signInAliasDestination("/Onboarding/"), "/");
  assert.equal(signInAliasDestination("/download"), "/");
  assert.equal(signInAliasDestination("/download/"), "/");
  assert.equal(signInAliasDestination("/DOWNLOAD"), "/");
  assert.equal(signInAliasDestination("/Download/"), "/");
  assert.equal(signInAliasDestination("/ios"), "/");
  assert.equal(signInAliasDestination("/ios/"), "/");
  assert.equal(signInAliasDestination("/IOS"), "/");
  assert.equal(signInAliasDestination("/Ios/"), "/");
  assert.equal(signInAliasDestination("/app-store"), "/");
  assert.equal(signInAliasDestination("/app-store/"), "/");
  assert.equal(signInAliasDestination("/APP-STORE"), "/");
  assert.equal(signInAliasDestination("/App-Store/"), "/");
  assert.equal(signInAliasDestination("/android"), "/");
  assert.equal(signInAliasDestination("/android/"), "/");
  assert.equal(signInAliasDestination("/ANDROID"), "/");
  assert.equal(signInAliasDestination("/Android/"), "/");
  assert.equal(signInAliasDestination("/how-it-works"), "/");
  assert.equal(signInAliasDestination("/how-it-works/"), "/");
  assert.equal(signInAliasDestination("/HOW-IT-WORKS"), "/");
  assert.equal(signInAliasDestination("/How-It-Works/"), "/");
  assert.equal(signInAliasDestination("/tour"), "/");
  assert.equal(signInAliasDestination("/tour/"), "/");
  assert.equal(signInAliasDestination("/TOUR"), "/");
  assert.equal(signInAliasDestination("/Tour/"), "/");
  assert.equal(signInAliasDestination("/mobile"), "/");
  assert.equal(signInAliasDestination("/mobile/"), "/");
  assert.equal(signInAliasDestination("/MOBILE"), "/");
  assert.equal(signInAliasDestination("/Mobile/"), "/");
  assert.equal(signInAliasDestination("/web"), "/");
  assert.equal(signInAliasDestination("/web/"), "/");
  assert.equal(signInAliasDestination("/WEB"), "/");
  assert.equal(signInAliasDestination("/Web/"), "/");
  for (const path of [
    "/apps",
    "/mobile-app",
    "/iphone",
    "/ipad",
    "/app-store-link",
    "/free",
    "/sign-up-free",
    "/free-account",
    "/signup-free",
    "/welcome",
    "/web-app",
    "/beta",
    "/waitlist",
    "/early-access",
    "/register-now",
    "/join-now",
    "/login-page",
    "/signin-page",
    "/download-app",
    "/get-the-app",
    "/ios-app",
    "/getting-started",
    "/start-here",
  ]) {
    assert.equal(signInAliasDestination(path), "/", path);
    assert.equal(signInAliasDestination(`${path}/`), "/", path);
    assert.equal(signInAliasDestination(path.toUpperCase()), "/", path);
    assert.equal(signInAliasDestination(`${path.toUpperCase()}/`), "/", path);
    assert.equal(signInAliasDestination(`${path}/extra`), null, path);
    assert.equal(signInAliasDestination(`${path}s`), null, path);
  }

  const next = "?next=/jobs/cedar-ridge";
  assert.equal(signInAliasDestination("/login", next), `/${next}`);
  assert.equal(signInAliasDestination("/log-in", next), `/${next}`);
  assert.equal(signInAliasDestination("/LOG-IN/", next), `/${next}`);
  assert.equal(signInAliasDestination("/signin", next), `/${next}`);
  assert.equal(signInAliasDestination("/sign-in", next), `/${next}`);
  assert.equal(signInAliasDestination("/SIGN-IN/", next), `/${next}`);
  assert.equal(signInAliasDestination("/signup", next), `/${next}`);
  assert.equal(signInAliasDestination("/sign-up", next), `/${next}`);
  assert.equal(signInAliasDestination("/register/", next), `/${next}`);
  assert.equal(signInAliasDestination("/join", next), `/${next}`);
  assert.equal(signInAliasDestination("/JOIN/", next), `/${next}`);
  assert.equal(signInAliasDestination("/create-account", next), `/${next}`);
  assert.equal(signInAliasDestination("/create-account/", next), `/${next}`);
  assert.equal(signInAliasDestination("/get-started", next), `/${next}`);
  assert.equal(signInAliasDestination("/GET-STARTED/", next), `/${next}`);
  assert.equal(signInAliasDestination("/start", next), `/${next}`);
  assert.equal(signInAliasDestination("/START/", next), `/${next}`);
  assert.equal(signInAliasDestination("/trial", next), `/${next}`);
  assert.equal(signInAliasDestination("/TRIAL/", next), `/${next}`);
  assert.equal(signInAliasDestination("/free-trial", next), `/${next}`);
  assert.equal(signInAliasDestination("/FREE-TRIAL/", next), `/${next}`);
  assert.equal(signInAliasDestination("/onboarding", next), `/${next}`);
  assert.equal(signInAliasDestination("/ONBOARDING/", next), `/${next}`);
  assert.equal(signInAliasDestination("/download", next), `/${next}`);
  assert.equal(signInAliasDestination("/DOWNLOAD/", next), `/${next}`);
  assert.equal(signInAliasDestination("/ios", next), `/${next}`);
  assert.equal(signInAliasDestination("/IOS/", next), `/${next}`);
  assert.equal(signInAliasDestination("/app-store", next), `/${next}`);
  assert.equal(signInAliasDestination("/APP-STORE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/android", next), `/${next}`);
  assert.equal(signInAliasDestination("/ANDROID/", next), `/${next}`);
  assert.equal(signInAliasDestination("/how-it-works", next), `/${next}`);
  assert.equal(signInAliasDestination("/HOW-IT-WORKS/", next), `/${next}`);
  assert.equal(signInAliasDestination("/tour", next), `/${next}`);
  assert.equal(signInAliasDestination("/TOUR/", next), `/${next}`);
  assert.equal(signInAliasDestination("/mobile", next), `/${next}`);
  assert.equal(signInAliasDestination("/MOBILE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/web", next), `/${next}`);
  assert.equal(signInAliasDestination("/WEB/", next), `/${next}`);
  assert.equal(signInAliasDestination("/apps", next), `/${next}`);
  assert.equal(signInAliasDestination("/APPS/", next), `/${next}`);
  assert.equal(signInAliasDestination("/mobile-app", next), `/${next}`);
  assert.equal(signInAliasDestination("/MOBILE-APP/", next), `/${next}`);
  assert.equal(signInAliasDestination("/iphone", next), `/${next}`);
  assert.equal(signInAliasDestination("/IPHONE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/ipad", next), `/${next}`);
  assert.equal(signInAliasDestination("/IPAD/", next), `/${next}`);
  assert.equal(signInAliasDestination("/app-store-link", next), `/${next}`);
  assert.equal(signInAliasDestination("/APP-STORE-LINK/", next), `/${next}`);
  assert.equal(signInAliasDestination("/free", next), `/${next}`);
  assert.equal(signInAliasDestination("/FREE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/sign-up-free", next), `/${next}`);
  assert.equal(signInAliasDestination("/SIGN-UP-FREE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/free-account", next), `/${next}`);
  assert.equal(signInAliasDestination("/FREE-ACCOUNT/", next), `/${next}`);
  assert.equal(signInAliasDestination("/signup-free", next), `/${next}`);
  assert.equal(signInAliasDestination("/SIGNUP-FREE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/welcome", next), `/${next}`);
  assert.equal(signInAliasDestination("/WELCOME/", next), `/${next}`);
  assert.equal(signInAliasDestination("/web-app", next), `/${next}`);
  assert.equal(signInAliasDestination("/WEB-APP/", next), `/${next}`);
  assert.equal(signInAliasDestination("/beta", next), `/${next}`);
  assert.equal(signInAliasDestination("/BETA/", next), `/${next}`);
  assert.equal(signInAliasDestination("/waitlist", next), `/${next}`);
  assert.equal(signInAliasDestination("/WAITLIST/", next), `/${next}`);
  assert.equal(signInAliasDestination("/early-access", next), `/${next}`);
  assert.equal(signInAliasDestination("/EARLY-ACCESS/", next), `/${next}`);
  assert.equal(signInAliasDestination("/register-now", next), `/${next}`);
  assert.equal(signInAliasDestination("/REGISTER-NOW/", next), `/${next}`);
  assert.equal(signInAliasDestination("/join-now", next), `/${next}`);
  assert.equal(signInAliasDestination("/JOIN-NOW/", next), `/${next}`);
  assert.equal(signInAliasDestination("/login-page", next), `/${next}`);
  assert.equal(signInAliasDestination("/LOGIN-PAGE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/signin-page", next), `/${next}`);
  assert.equal(signInAliasDestination("/SIGNIN-PAGE/", next), `/${next}`);
  assert.equal(signInAliasDestination("/download-app", next), `/${next}`);
  assert.equal(signInAliasDestination("/DOWNLOAD-APP/", next), `/${next}`);
  assert.equal(signInAliasDestination("/get-the-app", next), `/${next}`);
  assert.equal(signInAliasDestination("/GET-THE-APP/", next), `/${next}`);
  assert.equal(signInAliasDestination("/ios-app", next), `/${next}`);
  assert.equal(signInAliasDestination("/IOS-APP/", next), `/${next}`);
  assert.equal(signInAliasDestination("/getting-started", next), `/${next}`);
  assert.equal(signInAliasDestination("/GETTING-STARTED/", next), `/${next}`);
  assert.equal(signInAliasDestination("/start-here", next), `/${next}`);
  assert.equal(signInAliasDestination("/START-HERE/", next), `/${next}`);
  assert.equal(signInAliasRedirects()[0]?.permanent ? 308 : 307, 307);
  assert.equal(signInAliasDestination("/free-account"), "/");
  assert.equal(signInAliasDestination("/signup-free"), "/");
  assert.equal(
    signInAliasDestination("/login/", "?next=/jobs/cedar-ridge&room=101"),
    "/?next=/jobs/cedar-ridge&room=101",
  );
  assert.equal(
    signInAliasDestination("/sign-up/", "?next=/jobs/cedar-ridge&room=101"),
    "/?next=/jobs/cedar-ridge&room=101",
  );

  assert.equal(signInAliasDestination("/help"), null);
  assert.equal(signInAliasDestination("/faq"), null);
  assert.equal(signInAliasDestination("/login/extra"), null);
  assert.equal(signInAliasDestination("/signup/extra"), null);
  assert.equal(signInAliasDestination("/sign-up/extra"), null);
  assert.equal(signInAliasDestination("/register/extra"), null);
  assert.equal(signInAliasDestination("/logins"), null);
  assert.equal(signInAliasDestination("/log-ins"), null);
  assert.equal(signInAliasDestination("/log-in/extra"), null);
  assert.equal(signInAliasDestination("/signups"), null);
  assert.equal(signInAliasDestination("/registers"), null);
  assert.equal(signInAliasDestination("/joins"), null);
  assert.equal(signInAliasDestination("/join/extra"), null);
  assert.equal(signInAliasDestination("/create"), null);
  assert.equal(signInAliasDestination("/create-accounts"), null);
  assert.equal(signInAliasDestination("/create-account/extra"), null);
  assert.equal(signInAliasDestination("/get-starteds"), null);
  assert.equal(signInAliasDestination("/get-started/extra"), null);
  assert.equal(signInAliasDestination("/get-start"), null);
  assert.equal(signInAliasDestination("/starts"), null);
  assert.equal(signInAliasDestination("/start/extra"), null);
  assert.equal(signInAliasDestination("/trials"), null);
  assert.equal(signInAliasDestination("/trial/extra"), null);
  assert.equal(signInAliasDestination("/free"), "/");
  assert.equal(signInAliasDestination("/frees"), null);
  assert.equal(signInAliasDestination("/free/extra"), null);
  assert.equal(signInAliasDestination("/free-trials"), null);
  assert.equal(signInAliasDestination("/free-trial/extra"), null);
  assert.equal(signInAliasDestination("/onboard"), null);
  assert.equal(signInAliasDestination("/onboardings"), null);
  assert.equal(signInAliasDestination("/onboarding/extra"), null);
  assert.equal(signInAliasDestination("/downloads"), null);
  assert.equal(signInAliasDestination("/download/extra"), null);
  assert.equal(signInAliasDestination("/io"), null);
  assert.equal(signInAliasDestination("/ioses"), null);
  assert.equal(signInAliasDestination("/ios/extra"), null);
  assert.equal(signInAliasDestination("/app"), null);
  assert.equal(signInAliasDestination("/app-stores"), null);
  assert.equal(signInAliasDestination("/app-store/extra"), null);
  assert.equal(signInAliasDestination("/androids"), null);
  assert.equal(signInAliasDestination("/android/extra"), null);
  assert.equal(signInAliasDestination("/how"), null);
  assert.equal(signInAliasDestination("/how-it-work"), null);
  assert.equal(signInAliasDestination("/how-it-works/extra"), null);
  assert.equal(signInAliasDestination("/tours"), null);
  assert.equal(signInAliasDestination("/tour/extra"), null);
  assert.equal(signInAliasDestination("/mobiles"), null);
  assert.equal(signInAliasDestination("/mobile/extra"), null);
  assert.equal(signInAliasDestination("/webs"), null);
  assert.equal(signInAliasDestination("/web/extra"), null);
  assert.equal(signInAliasDestination("/webinar"), null);
  assert.equal(signInAliasDestination("/security"), null);
  assert.equal(signInAliasDestination("/trust"), null);
  assert.equal(signInAliasDestination("/gdpr"), null);
  assert.equal(signInAliasDestination("/ccpa"), null);
  assert.equal(signInAliasDestination("/legal/privacy"), null);
  assert.equal(signInAliasDestination("/legal/terms"), null);
  assert.equal(signInAliasDestination("/sla"), null);
  assert.equal(signInAliasDestination("/guides"), null);
  assert.equal(signInAliasDestination("/resources"), null);
  assert.equal(signInAliasDestination("/case-studies"), null);
  assert.equal(signInAliasDestination("/testimonials"), null);
  assert.equal(signInAliasDestination("/events"), null);
  assert.equal(signInAliasDestination("/rfi"), null);
  assert.equal(signInAliasDestination("/rfis"), null);
  assert.equal(signInAliasDestination("/submittals"), null);
  assert.equal(signInAliasDestination("/punch"), null);
  assert.equal(signInAliasDestination("/daily-log"), null);
  assert.equal(signInAliasDestination("/reports"), null);
  assert.equal(signInAliasDestination("/photos"), null);
  assert.equal(signInAliasDestination("/drawings"), null);
  assert.equal(signInAliasDestination("/schedule"), null);
  assert.equal(signInAliasDestination("/calendar"), null);
  assert.equal(signInAliasDestination("/invite"), null);
  assert.equal(signInAliasDestination("/notifications"), null);
  assert.equal(signInAliasDestination("/billing"), null);
  assert.equal(signInAliasDestination("/subscribe"), null);
  assert.equal(signInAliasDestination("/upgrade"), null);
  assert.equal(signInAliasDestination("/checkout"), null);
  assert.equal(signInAliasDestination("/api/docs"), null);
  assert.equal(signInAliasDestination("/.well-known/apple-app-site-association"), null);
  assert.equal(signInAliasDestination("/refund"), null);
  assert.equal(signInAliasDestination("/refunds"), null);
  assert.equal(signInAliasDestination("/dmca"), null);
  assert.equal(signInAliasDestination("/imprint"), null);
  assert.equal(signInAliasDestination("/accessibility"), null);
  assert.equal(signInAliasDestination("/docs"), null);
  assert.equal(signInAliasDestination("/status"), null);
  assert.equal(signInAliasDestination("/blog"), null);
  assert.equal(signInAliasDestination("/changelog"), null);
  assert.equal(signInAliasDestination("/news"), null);
  assert.equal(signInAliasDestination("/press"), null);
  assert.equal(signInAliasDestination("/roadmap"), null);
  assert.equal(signInAliasDestination("/careers"), null);
  assert.equal(signInAliasDestination("/team"), null);
  assert.equal(signInAliasDestination("/partners"), null);
  assert.equal(signInAliasDestination("/customers"), null);
  assert.equal(signInAliasDestination("/integrations"), null);
  assert.equal(signInAliasDestination("/procore"), null);
  assert.equal(signInAliasDestination("/api/procore/status"), null);
  assert.equal(signInAliasDestination("/admin"), null);
  assert.equal(signInAliasDestination("/api"), null);
  assert.equal(signInAliasDestination("/humans.txt"), null);
  assert.equal(signInAliasDestination("/zz-nope"), null);
  assert.equal(signInAliasDestination("/search"), null);
  assert.equal(signInAliasDestination("/unsubscribe"), null);
  assert.equal(signInAliasDestination("/preferences"), null);
  assert.equal(signInAliasDestination("/affiliates"), null);
  assert.equal(signInAliasDestination("/referral"), null);
  assert.equal(signInAliasDestination("/llms.txt"), null);
  assert.equal(signInAliasDestination("/ads.txt"), null);
  assert.equal(signInAliasDestination("/welcome"), "/");
  assert.equal(signInAliasDestination("/web-app"), "/");
  assert.equal(signInAliasDestination("/web"), "/");
  assert.equal(signInAliasDestination("/web-apps"), null);
  assert.equal(signInAliasDestination("/web-app/extra"), null);
  assert.equal(signInAliasDestination("/betas"), null);
  assert.equal(signInAliasDestination("/beta/extra"), null);
  assert.equal(signInAliasDestination("/welcomes"), null);
  assert.equal(signInAliasDestination("/welcome/extra"), null);
  assert.equal(signInAliasDestination("/waitlists"), null);
  assert.equal(signInAliasDestination("/waitlist/extra"), null);
  assert.equal(signInAliasDestination("/early"), null);
  assert.equal(signInAliasDestination("/early-accesss"), null);
  assert.equal(signInAliasDestination("/early-access/extra"), null);
  assert.equal(signInAliasDestination("/register"), "/");
  assert.equal(signInAliasDestination("/register-now"), "/");
  assert.equal(signInAliasDestination("/register-nows"), null);
  assert.equal(signInAliasDestination("/register-now/extra"), null);
  assert.equal(signInAliasDestination("/register/now"), null);
  assert.equal(signInAliasDestination("/join"), "/");
  assert.equal(signInAliasDestination("/join-now"), "/");
  assert.equal(signInAliasDestination("/join-nows"), null);
  assert.equal(signInAliasDestination("/join-now/extra"), null);
  assert.equal(signInAliasDestination("/login"), "/");
  assert.equal(signInAliasDestination("/log-in"), "/");
  assert.equal(signInAliasDestination("/login-page"), "/");
  assert.equal(signInAliasDestination("/login-pages"), null);
  assert.equal(signInAliasDestination("/login/page"), null);
  assert.equal(signInAliasDestination("/signin"), "/");
  assert.equal(signInAliasDestination("/sign-in"), "/");
  assert.equal(signInAliasDestination("/signin-page"), "/");
  assert.equal(signInAliasDestination("/signin-pages"), null);
  assert.equal(signInAliasDestination("/signin/page"), null);
  assert.equal(signInAliasDestination("/download"), "/");
  assert.equal(signInAliasDestination("/download-app"), "/");
  assert.equal(signInAliasDestination("/download-apps"), null);
  assert.equal(signInAliasDestination("/download/app"), null);
  assert.equal(signInAliasDestination("/get-started"), "/");
  assert.equal(signInAliasDestination("/getting-started"), "/");
  assert.equal(signInAliasDestination("/get-the-app"), "/");
  assert.equal(signInAliasDestination("/getting-starteds"), null);
  assert.equal(signInAliasDestination("/getting-started/extra"), null);
  assert.equal(signInAliasDestination("/get-the-apps"), null);
  assert.equal(signInAliasDestination("/start"), "/");
  assert.equal(signInAliasDestination("/start-here"), "/");
  assert.equal(signInAliasDestination("/start-heres"), null);
  assert.equal(signInAliasDestination("/start/here"), null);
  assert.equal(signInAliasDestination("/ios"), "/");
  assert.equal(signInAliasDestination("/ios-app"), "/");
  assert.equal(signInAliasDestination("/ios-apps"), null);
  assert.equal(signInAliasDestination("/ios/app"), null);
  assert.equal(signInAliasDestination("/subscribe"), null);
  assert.equal(signInAliasDestination("/subscription"), null);
  assert.equal(signInAliasDestination("/billing"), null);
  assert.equal(signInAliasDestination("/upgrade"), null);
  assert.equal(signInAliasDestination("/checkout"), null);
  assert.equal(signInAliasDestination("/android-app"), null);
  assert.equal(signInAliasDestination("/android"), "/");
  for (const path of [
    "/safety",
    "/punch-list",
    "/daily-reports",
    "/field-notes",
    "/export",
    "/pdf",
    "/industries",
    "/construction",
    "/contractors",
    "/twitter",
    "/x",
    "/facebook",
    "/instagram",
    "/linkedin",
    "/youtube",
    "/discord",
    "/slack",
    "/mac",
    "/windows",
    "/play-store",
    "/google-play",
    "/testflight",
    "/desktop",
    "/soc2",
    "/hipaa",
    "/compliance",
    "/webhooks",
  ]) {
    assert.equal(signInAliasDestination(path), null, path);
    assert.equal(signInAliasDestination(`${path}/`), null, path);
    assert.equal(signInAliasDestination(`${path}/extra`), null, path);
  }
  assert.equal(signInAliasDestination("/book-demo"), null);
  assert.equal(signInAliasDestination("/request-demo"), null);
  assert.equal(signInAliasDestination("/schedule-demo"), null);
  assert.equal(signInAliasDestination("/get-demo"), null);
  assert.equal(signInAliasDestination("/app"), null);
  assert.equal(signInAliasDestination("/apps/extra"), null);
  assert.equal(signInAliasDestination("/mobile-apps"), null);
  assert.equal(signInAliasDestination("/iphones"), null);
  assert.equal(signInAliasDestination("/ipads"), null);
  assert.equal(signInAliasDestination("/app-store-links"), null);
  assert.equal(signInAliasDestination("/sign-up-frees"), null);
  assert.equal(signInAliasDestination("/free-accounts"), null);
  assert.equal(signInAliasDestination("/free-account/extra"), null);
  assert.equal(signInAliasDestination("/signup-frees"), null);
  assert.equal(signInAliasDestination("/signup-free/extra"), null);
  assert.equal(signInAliasDestination("/signup"), "/");
  assert.notEqual(signInAliasDestination("/signup-free"), signInAliasDestination("/signup-frees"));
  assert.equal(signInAliasDestination("/features"), null);
  assert.equal(signInAliasDestination("/cookies"), null);
  assert.equal(signInAliasDestination("/cookie-policy"), null);
  assert.equal(signInAliasDestination("/eula"), null);
  assert.equal(signInAliasDestination("/security.txt"), null);
  assert.equal(signInAliasDestination("/manifest.json"), null);
  assert.equal(signInAliasDestination("/site.webmanifest"), null);
  assert.equal(signInAliasDestination("/demo"), null);
  assert.equal(signInAliasDestination("/pack/maple-point"), null);
  assert.equal(signInAliasDestination("/share/abc", next), null);

  const home = readRepo("app/page.tsx");
  assert.match(home, /safeNextPath\(query\.next\)/);
  assert.match(home, /if \(session\) \{\s*redirect\(next\);/s);
  const form = readRepo("components/LoginForm.tsx");
  assert.match(form, /safeNextPath\(searchParams\.get\("next"\)\)/);
  assert.match(form, /router\.push\(returnPath\)/);

  for (const page of [
    "app/log-in/page.tsx",
    "app/log-in/route.ts",
    "app/join/page.tsx",
    "app/join/route.ts",
    "app/create-account/page.tsx",
    "app/create-account/route.ts",
    "public/join",
    "public/join.html",
    "public/create-account",
    "public/create-account.html",
    "app/get-started/page.tsx",
    "app/get-started/route.ts",
    "app/start/page.tsx",
    "app/start/route.ts",
    "app/trial/page.tsx",
    "app/trial/route.ts",
    "app/free-trial/page.tsx",
    "app/free-trial/route.ts",
    "app/onboarding/page.tsx",
    "app/onboarding/route.ts",
    "public/get-started",
    "public/get-started.html",
    "public/start",
    "public/start.html",
    "public/trial",
    "public/trial.html",
    "public/free-trial",
    "public/free-trial.html",
    "public/onboarding",
    "public/onboarding.html",
    "app/download/page.tsx",
    "app/download/route.ts",
    "app/ios/page.tsx",
    "app/ios/route.ts",
    "app/app-store/page.tsx",
    "app/app-store/route.ts",
    "app/android/page.tsx",
    "app/android/route.ts",
    "public/download",
    "public/download.html",
    "public/ios",
    "public/ios.html",
    "public/app-store",
    "public/app-store.html",
    "public/android",
    "public/android.html",
    "app/how-it-works/page.tsx",
    "app/how-it-works/route.ts",
    "app/tour/page.tsx",
    "app/tour/route.ts",
    "app/mobile/page.tsx",
    "app/mobile/route.ts",
    "app/web/page.tsx",
    "app/web/route.ts",
    "public/how-it-works",
    "public/how-it-works.html",
    "public/tour",
    "public/tour.html",
    "public/mobile",
    "public/mobile.html",
    "public/web",
    "public/web.html",
    "app/apps/page.tsx",
    "app/apps/route.ts",
    "app/mobile-app/page.tsx",
    "app/mobile-app/route.ts",
    "app/iphone/page.tsx",
    "app/iphone/route.ts",
    "app/ipad/page.tsx",
    "app/ipad/route.ts",
    "app/app-store-link/page.tsx",
    "app/app-store-link/route.ts",
    "app/free/page.tsx",
    "app/free/route.ts",
    "app/sign-up-free/page.tsx",
    "app/sign-up-free/route.ts",
    "public/apps",
    "public/apps.html",
    "public/mobile-app",
    "public/mobile-app.html",
    "public/iphone",
    "public/iphone.html",
    "public/ipad",
    "public/ipad.html",
    "public/app-store-link",
    "public/app-store-link.html",
    "public/free",
    "public/free.html",
    "public/sign-up-free",
    "public/sign-up-free.html",
    "app/free-account/page.tsx",
    "app/free-account/route.ts",
    "app/signup-free/page.tsx",
    "app/signup-free/route.ts",
    "public/free-account",
    "public/free-account.html",
    "public/signup-free",
    "public/signup-free.html",
    "app/welcome/page.tsx",
    "app/welcome/route.ts",
    "app/web-app/page.tsx",
    "app/web-app/route.ts",
    "app/beta/page.tsx",
    "app/beta/route.ts",
    "app/waitlist/page.tsx",
    "app/waitlist/route.ts",
    "app/early-access/page.tsx",
    "app/early-access/route.ts",
    "public/welcome",
    "public/welcome.html",
    "public/web-app",
    "public/web-app.html",
    "public/beta",
    "public/beta.html",
    "public/waitlist",
    "public/waitlist.html",
    "public/early-access",
    "public/early-access.html",
    "app/register-now/page.tsx",
    "app/register-now/route.ts",
    "app/join-now/page.tsx",
    "app/join-now/route.ts",
    "app/login-page/page.tsx",
    "app/login-page/route.ts",
    "app/signin-page/page.tsx",
    "app/signin-page/route.ts",
    "app/download-app/page.tsx",
    "app/download-app/route.ts",
    "app/get-the-app/page.tsx",
    "app/get-the-app/route.ts",
    "app/ios-app/page.tsx",
    "app/ios-app/route.ts",
    "app/getting-started/page.tsx",
    "app/getting-started/route.ts",
    "app/start-here/page.tsx",
    "app/start-here/route.ts",
    "public/register-now",
    "public/register-now.html",
    "public/join-now",
    "public/join-now.html",
    "public/login-page",
    "public/login-page.html",
    "public/signin-page",
    "public/signin-page.html",
    "public/download-app",
    "public/download-app.html",
    "public/get-the-app",
    "public/get-the-app.html",
    "public/ios-app",
    "public/ios-app.html",
    "public/getting-started",
    "public/getting-started.html",
    "public/start-here",
    "public/start-here.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});

test("/book-demo, /request-demo, /schedule-demo, /get-demo, /demo-video, /book-a-demo, /try, /try-free, /freetrial, and /request-quote temporarily move straight to /pack/maple-point (307), not via /demo", () => {
  assert.deepEqual(demoAliasRedirects(), [
    {
      source: DEMO_ALIAS_SOURCE,
      destination: "/pack/maple-point",
      permanent: false,
    },
  ]);
  assert.equal(
    DEMO_ALIAS_SOURCE,
    "/:alias(book-demo|request-demo|schedule-demo|get-demo|demo-video|book-a-demo|try|try-free|freetrial|request-quote)",
  );
  assert.equal(demoAliasRedirects()[0]?.permanent, false);
  assert.equal(demoAliasRedirects()[0]?.permanent ? 308 : 307, 307);
  assert.equal(demoAliasRedirects()[0]?.destination, "/pack/maple-point");
  assert.notEqual(demoAliasRedirects()[0]?.destination, "/demo");
  assert.doesNotMatch(DEMO_ALIAS_SOURCE, /\*/);

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.demoAliasRedirects\(\)/);
  assert.match(config, /source:\s*"\/demo"/);
  assert.match(config, /destination:\s*"\/pack\/maple-point"/);
  assert.doesNotMatch(config, /\/book-demo|\/request-demo|\/schedule-demo|\/get-demo|\/demo-video|\/book-a-demo|\/try-free|\/freetrial|\/request-quote|\/try(?!-)/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/book-demo|\/request-demo|\/schedule-demo|\/get-demo|\/demo-video|\/book-a-demo|\/try-free|\/freetrial|\/request-quote|\/try(?!-)/);
  assert.doesNotMatch(proxy, /redirect/);

  const next = "?room=101";
  for (const path of [
    "/book-demo",
    "/request-demo",
    "/schedule-demo",
    "/get-demo",
    "/demo-video",
    "/book-a-demo",
    "/try",
    "/try-free",
    "/freetrial",
    "/request-quote",
  ]) {
    assert.equal(demoAliasDestination(path), "/pack/maple-point", path);
    assert.equal(demoAliasDestination(`${path}/`), "/pack/maple-point", path);
    assert.equal(demoAliasDestination(path.toUpperCase()), "/pack/maple-point", path);
    assert.equal(demoAliasDestination(`${path.toUpperCase()}/`), "/pack/maple-point", path);
    assert.equal(demoAliasDestination(path, next), `/pack/maple-point${next}`, path);
    assert.equal(demoAliasDestination(`${path.toUpperCase()}/`, next), `/pack/maple-point${next}`, path);
    assert.notEqual(demoAliasDestination(path), "/demo", path);
    assert.equal(demoAliasDestination(`${path}/extra`), null, path);
    assert.equal(demoAliasDestination(`${path}s`), null, path);
    assert.equal(signInAliasDestination(path), null, path);
  }
  assert.equal(demoAliasDestination("/demo"), null);
  assert.equal(demoAliasDestination("/demo-video"), "/pack/maple-point");
  assert.notEqual(demoAliasDestination("/demo-video"), "/demo");
  assert.equal(demoAliasRedirects()[0]?.permanent ? 308 : 307, 307);
  assert.equal(signInAliasDestination("/demo-video"), null);
  assert.equal(demoAliasDestination("/demo/"), null);
  assert.equal(demoAliasDestination("/pack/maple-point"), null);
  assert.equal(demoAliasDestination("/book"), null);
  assert.equal(demoAliasDestination("/get"), null);
  assert.equal(demoAliasDestination("/search"), null);
  assert.equal(demoAliasDestination("/unsubscribe"), null);
  assert.equal(demoAliasDestination("/preferences"), null);
  assert.equal(demoAliasDestination("/affiliates"), null);
  assert.equal(demoAliasDestination("/referral"), null);
  assert.equal(demoAliasDestination("/llms.txt"), null);
  assert.equal(demoAliasDestination("/ads.txt"), null);
  assert.equal(demoAliasDestination("/zz-nope"), null);
  for (const path of [
    "/safety",
    "/punch-list",
    "/daily-reports",
    "/field-notes",
    "/export",
    "/pdf",
    "/industries",
    "/construction",
    "/contractors",
    "/twitter",
    "/x",
    "/facebook",
    "/instagram",
    "/linkedin",
    "/youtube",
    "/discord",
    "/slack",
    "/mac",
    "/windows",
    "/android-app",
    "/play-store",
    "/google-play",
    "/testflight",
    "/desktop",
    "/soc2",
    "/hipaa",
    "/compliance",
    "/webhooks",
    "/welcome",
    "/web-app",
    "/beta",
    "/waitlist",
    "/early-access",
    "/talk-to-sales",
    "/terms-of-use",
    "/data-policy",
    "/about-gc-field-log",
  ]) {
    assert.equal(demoAliasDestination(path), null, path);
  }
  assert.equal(demoAliasDestination("/free"), null);
  assert.equal(demoAliasDestination("/apps"), null);
  assert.equal(demoAliasDestination("/book-demo"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/book-a-demo"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/book-a-demos"), null);
  assert.equal(demoAliasDestination("/book-a-demo/extra"), null);
  assert.equal(demoAliasDestination("/book/a-demo"), null);
  assert.equal(demoAliasDestination("/try"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/TRY/"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/try-free"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/TRY-FREE/"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/trying"), null);
  assert.equal(demoAliasDestination("/try/extra"), null);
  assert.equal(demoAliasDestination("/try/free"), null);
  assert.equal(demoAliasDestination("/try-frees"), null);
  assert.equal(demoAliasDestination("/freetrial"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/FREETRIAL/"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/freetrials"), null);
  assert.equal(demoAliasDestination("/free-trial"), null);
  assert.equal(signInAliasDestination("/free-trial"), "/");
  assert.equal(signInAliasDestination("/freetrial"), null);
  assert.equal(signInAliasDestination("/try"), null);
  assert.equal(signInAliasDestination("/try-free"), null);
  assert.equal(demoAliasDestination("/trial"), null);
  assert.equal(signInAliasDestination("/trial"), "/");
  assert.equal(demoAliasDestination("/request-quote"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/request-quote/extra"), null);
  assert.equal(demoAliasDestination("/request-quotes"), null);
  assert.equal(demoAliasDestination("/quote"), null);
  assert.equal(demoAliasDestination("/get-quote"), null);
  assert.equal(demoAliasDestination("/request-demo"), "/pack/maple-point");
  assert.equal(demoAliasDestination("/subscribe"), null);
  assert.equal(demoAliasDestination("/subscription"), null);
  assert.equal(demoAliasDestination("/billing"), null);
  assert.equal(demoAliasDestination("/upgrade"), null);
  assert.equal(demoAliasDestination("/checkout"), null);
  assert.equal(demoAliasDestination("/try", "?room=101"), "/pack/maple-point?room=101");
  assert.notEqual(demoAliasDestination("/try"), "/demo");
  assert.notEqual(demoAliasDestination("/request-quote"), "/demo");

  for (const page of [
    "app/book-demo/page.tsx",
    "app/book-demo/route.ts",
    "app/request-demo/page.tsx",
    "app/request-demo/route.ts",
    "app/schedule-demo/page.tsx",
    "app/schedule-demo/route.ts",
    "app/get-demo/page.tsx",
    "app/get-demo/route.ts",
    "public/book-demo",
    "public/book-demo.html",
    "public/request-demo",
    "public/request-demo.html",
    "public/schedule-demo",
    "public/schedule-demo.html",
    "public/get-demo",
    "public/get-demo.html",
    "app/demo-video/page.tsx",
    "app/demo-video/route.ts",
    "public/demo-video",
    "public/demo-video.html",
    "app/book-a-demo/page.tsx",
    "app/book-a-demo/route.ts",
    "app/try/page.tsx",
    "app/try/route.ts",
    "app/try-free/page.tsx",
    "app/try-free/route.ts",
    "app/freetrial/page.tsx",
    "app/freetrial/route.ts",
    "app/request-quote/page.tsx",
    "app/request-quote/route.ts",
    "public/book-a-demo",
    "public/book-a-demo.html",
    "public/try",
    "public/try.html",
    "public/try-free",
    "public/try-free.html",
    "public/freetrial",
    "public/freetrial.html",
    "public/request-quote",
    "public/request-quote.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
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
