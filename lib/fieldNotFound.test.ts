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
  SIGN_IN_ALIAS_SOURCE,
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

test("sign-in aliases, /join, /create-account, /get-started, /start, /trial, /free-trial, /onboarding, /download, /ios, /app-store, and /android redirect home and keep the query", () => {
  assert.deepEqual(signInAliasRedirects(), [
    {
      source: SIGN_IN_ALIAS_SOURCE,
      destination: "/",
      permanent: false,
    },
  ]);
  assert.equal(
    SIGN_IN_ALIAS_SOURCE,
    "/:alias(login|log-in|signin|sign-in|signup|sign-up|register|join|create-account|get-started|start|trial|free-trial|onboarding|download|ios|app-store|android)",
  );
  assert.equal(signInAliasRedirects()[0]?.permanent, false);

  const config = readRepo("next.config.ts");
  assert.match(config, /signInAliasRedirects\(\)/);

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
  assert.equal(signInAliasDestination("/free"), null);
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
