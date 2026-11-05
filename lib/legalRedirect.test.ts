import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { legalRedirects } from "./legalRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legal aliases permanently move to /terms or /privacy (308), including /eula, /cookies, /cookie-policy, /refund, /refunds, /dmca, /imprint, /accessibility, /security, /trust, /gdpr, /ccpa, /legal/privacy, /legal/terms, /sla, /terms-and-conditions, /acceptable-use, /aup, /copyright, /trademarks, /privacy-notice, /legal/cookies, /subprocessors, /dpa, /legal-notice, /disclaimer, /accessibility-statement, /terms-of-use, /cookie-settings, /do-not-sell, /privacy-choices, /your-privacy-choices, /security-policy, /responsible-disclosure, /bug-bounty, /vulnerability-disclosure, /data-policy, /data-processing, /termsandconditions, /tos-page, /eula-page, /dmca-policy, /refund-policy, /a11y, /wcag, /privacypolicy, /cookie, /cookies-settings, /manage-cookies, /consent, and /privacy-center", () => {
  assert.deepEqual(legalRedirects(), [
    {
      source: "/legal",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/tos",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-of-service",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/eula",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/refund",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/refunds",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/dmca",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/imprint",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/accessibility",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/legal/terms",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/sla",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-and-conditions",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/acceptable-use",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/aup",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/copyright",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/trademarks",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/legal-notice",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/disclaimer",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/accessibility-statement",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-of-use",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/termsandconditions",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/tos-page",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/eula-page",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/dmca-policy",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/refund-policy",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/a11y",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/wcag",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/privacy-policy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookies",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-policy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/security",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/trust",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/gdpr",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/ccpa",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/legal/privacy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-notice",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/legal/cookies",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/subprocessors",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/dpa",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-settings",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/do-not-sell",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-choices",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/your-privacy-choices",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/security-policy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/responsible-disclosure",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/bug-bounty",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/vulnerability-disclosure",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/data-policy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/data-processing",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacypolicy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookies-settings",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/manage-cookies",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/consent",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-center",
      destination: "/privacy",
      permanent: true,
    },
  ]);
  for (const redirect of legalRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.equal(redirect.permanent ? 308 : 307, 308);
    assert.ok(redirect.destination === "/terms" || redirect.destination === "/privacy");
    assert.doesNotMatch(redirect.source, /[:*]/);
    assert.equal(redirect.source.endsWith("/"), false, redirect.source);
    const nested = redirect.source.slice(1).includes("/");
    if (nested) {
      assert.ok(
        redirect.source === "/legal/privacy" ||
          redirect.source === "/legal/terms" ||
          redirect.source === "/legal/cookies",
        redirect.source,
      );
    }
  }

  const bySource = new Map(legalRedirects().map((redirect) => [redirect.source, redirect.destination]));
  assert.equal(bySource.get("/eula"), "/terms");
  assert.equal(bySource.get("/eula"), bySource.get("/legal"));
  assert.equal(bySource.get("/tos"), bySource.get("/legal"));
  assert.equal(bySource.get("/terms-of-service"), bySource.get("/legal"));
  assert.equal(bySource.get("/refund"), "/terms");
  assert.equal(bySource.get("/refunds"), "/terms");
  assert.equal(bySource.get("/dmca"), "/terms");
  assert.equal(bySource.get("/imprint"), "/terms");
  assert.equal(bySource.get("/accessibility"), "/terms");
  assert.equal(bySource.get("/refund"), bySource.get("/legal"));
  assert.equal(bySource.get("/refunds"), bySource.get("/legal"));
  assert.equal(bySource.get("/dmca"), bySource.get("/legal"));
  assert.equal(bySource.get("/imprint"), bySource.get("/legal"));
  assert.equal(bySource.get("/accessibility"), bySource.get("/legal"));
  assert.equal(bySource.get("/cookies"), "/privacy");
  assert.equal(bySource.get("/cookie-policy"), "/privacy");
  assert.equal(bySource.get("/cookies"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/legal"), "/terms");
  assert.equal(bySource.get("/legal/terms"), "/terms");
  assert.equal(bySource.get("/legal/terms"), bySource.get("/legal"));
  assert.equal(bySource.get("/sla"), "/terms");
  assert.equal(bySource.get("/sla"), bySource.get("/legal"));
  assert.equal(bySource.get("/security"), "/privacy");
  assert.equal(bySource.get("/trust"), "/privacy");
  assert.equal(bySource.get("/gdpr"), "/privacy");
  assert.equal(bySource.get("/ccpa"), "/privacy");
  assert.equal(bySource.get("/legal/privacy"), "/privacy");
  assert.equal(bySource.get("/legal/privacy"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/terms-and-conditions"), "/terms");
  assert.equal(bySource.get("/acceptable-use"), "/terms");
  assert.equal(bySource.get("/aup"), "/terms");
  assert.equal(bySource.get("/copyright"), "/terms");
  assert.equal(bySource.get("/trademarks"), "/terms");
  assert.equal(bySource.get("/terms-and-conditions"), bySource.get("/legal"));
  assert.equal(bySource.get("/acceptable-use"), bySource.get("/legal"));
  assert.equal(bySource.get("/aup"), bySource.get("/legal"));
  assert.equal(bySource.get("/copyright"), bySource.get("/legal"));
  assert.equal(bySource.get("/trademarks"), bySource.get("/legal"));
  assert.equal(bySource.get("/privacy-notice"), "/privacy");
  assert.equal(bySource.get("/legal/cookies"), "/privacy");
  assert.equal(bySource.get("/subprocessors"), "/privacy");
  assert.equal(bySource.get("/dpa"), "/privacy");
  assert.equal(bySource.get("/privacy-notice"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/legal/cookies"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/subprocessors"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/dpa"), bySource.get("/privacy-policy"));
  for (const source of ["/legal-notice", "/disclaimer", "/accessibility-statement", "/terms-of-use"]) {
    const redirect = legalRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/terms", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/terms", source);
    assert.equal(bySource.get(source), bySource.get("/legal"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
  }
  for (const source of [
    "/cookie-settings",
    "/do-not-sell",
    "/privacy-choices",
    "/your-privacy-choices",
    "/security-policy",
    "/responsible-disclosure",
    "/bug-bounty",
    "/vulnerability-disclosure",
    "/data-policy",
    "/data-processing",
  ]) {
    const redirect = legalRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/privacy", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/privacy", source);
    assert.equal(bySource.get(source), bySource.get("/privacy-policy"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
  }
  assert.equal(bySource.get("/legal-notice"), bySource.get("/legal"));
  assert.notEqual(bySource.get("/legal-notice"), bySource.get("/legal/privacy"));
  assert.equal(bySource.get("/accessibility-statement"), bySource.get("/accessibility"));
  assert.equal(bySource.get("/cookie-settings"), bySource.get("/cookies"));
  assert.equal(bySource.get("/security-policy"), bySource.get("/security"));
  assert.notEqual(bySource.get("/privacy-choices"), undefined);
  assert.equal(bySource.get("/privacy-choices"), bySource.get("/your-privacy-choices"));
  assert.equal(bySource.has("/security.txt"), false);
  assert.notEqual(bySource.get("/legal"), bySource.get("/legal/privacy"));
  assert.notEqual(bySource.get("/legal"), bySource.get("/legal/cookies"));
  assert.equal(bySource.has("/legal/privacy/extra"), false);
  assert.equal(bySource.has("/legal/terms/extra"), false);
  assert.equal(bySource.has("/legal/cookies/extra"), false);
  assert.equal(bySource.has("/terms-and-conditions/extra"), false);
  assert.equal(bySource.has("/aup/extra"), false);
  assert.equal(bySource.has("/dpa/extra"), false);
  assert.equal(bySource.has("/legal/other"), false);
  assert.equal(bySource.has("/security.txt"), false);
  assert.equal(bySource.has("/security/extra"), false);
  assert.equal(bySource.get("/terms-of-use"), "/terms");
  assert.equal(bySource.get("/terms-of-use"), bySource.get("/legal"));
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.has("/terms-of-use/extra"), false);
  assert.equal(bySource.get("/data-policy"), "/privacy");
  assert.equal(bySource.get("/data-processing"), "/privacy");
  assert.equal(bySource.get("/data-policy"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/data-processing"), bySource.get("/privacy-policy"));
  assert.equal(bySource.has("/data-policy/extra"), false);
  assert.equal(bySource.has("/data-processing/extra"), false);
  assert.equal(bySource.has("/privacy"), false);
  for (const source of [
    "/termsandconditions",
    "/tos-page",
    "/eula-page",
    "/dmca-policy",
    "/refund-policy",
    "/a11y",
    "/wcag",
  ]) {
    const redirect = legalRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/terms", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/terms", source);
    assert.equal(bySource.get(source), bySource.get("/legal"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  for (const source of [
    "/privacypolicy",
    "/cookie",
    "/cookies-settings",
    "/manage-cookies",
    "/consent",
    "/privacy-center",
  ]) {
    const redirect = legalRedirects().find((item) => item.source === source);
    assert.equal(redirect?.destination, "/privacy", source);
    assert.equal(redirect?.permanent, true, source);
    assert.equal(redirect?.permanent ? 308 : 307, 308, source);
    assert.equal(bySource.get(source), "/privacy", source);
    assert.equal(bySource.get(source), bySource.get("/privacy-policy"), source);
    assert.equal(bySource.has(`${source}/extra`), false, source);
    assert.equal(bySource.has(`${source}/`), false, source);
    assert.equal(source.slice(1).includes("/"), false, source);
  }
  assert.equal(bySource.get("/termsandconditions"), bySource.get("/terms-and-conditions"));
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.has("/terms-and-conditions"), true);
  assert.equal(bySource.get("/tos-page"), bySource.get("/tos"));
  assert.equal(bySource.get("/eula-page"), bySource.get("/eula"));
  assert.equal(bySource.get("/dmca-policy"), bySource.get("/dmca"));
  assert.equal(bySource.get("/refund-policy"), bySource.get("/refund"));
  assert.equal(bySource.get("/refund-policy"), bySource.get("/refunds"));
  assert.equal(bySource.get("/a11y"), bySource.get("/accessibility"));
  assert.equal(bySource.get("/wcag"), bySource.get("/accessibility"));
  assert.equal(bySource.has("/accessibility"), true);
  assert.equal(bySource.get("/privacypolicy"), bySource.get("/privacy-policy"));
  assert.equal(bySource.has("/privacy-policy"), true);
  assert.equal(bySource.get("/cookie"), bySource.get("/cookies"));
  assert.equal(bySource.has("/cookies"), true);
  assert.equal(bySource.has("/cookie"), true);
  assert.equal(bySource.get("/cookies-settings"), bySource.get("/cookie-settings"));
  assert.equal(bySource.get("/manage-cookies"), bySource.get("/cookies"));
  assert.equal(bySource.get("/consent"), bySource.get("/cookies"));
  assert.equal(bySource.get("/privacy-center"), bySource.get("/privacy-policy"));
  assert.equal(bySource.has("/subscribe"), false);
  assert.equal(bySource.has("/subscription"), false);
  assert.equal(bySource.has("/billing"), false);
  assert.equal(bySource.has("/upgrade"), false);
  assert.equal(bySource.has("/checkout"), false);
  const sources = new Set(legalRedirects().map((redirect) => redirect.source));
  for (const redirect of legalRedirects()) {
    assert.equal(sources.has(redirect.destination), false, redirect.source);
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.legalRedirects\(\)/);
  assert.doesNotMatch(config, /["']\/legal["']/);
  assert.doesNotMatch(config, /\/privacy-policy|\/tos|\/terms-of-service|\/eula|\/cookies|\/cookie-policy|\/refunds|\/refund|\/dmca|\/imprint|\/accessibility|\/trust|\/gdpr|\/ccpa|\/sla|\/legal\/privacy|\/legal\/terms|\/security(?!Headers)|\/terms-and-conditions|\/acceptable-use|\/aup|\/copyright|\/trademarks|\/privacy-notice|\/legal\/cookies|\/subprocessors|\/dpa|\/legal-notice|\/disclaimer|\/accessibility-statement|\/terms-of-use|\/cookie-settings|\/do-not-sell|\/your-privacy-choices|\/privacy-choices|\/security-policy|\/responsible-disclosure|\/bug-bounty|\/vulnerability-disclosure|\/data-policy|\/data-processing|\/termsandconditions|\/tos-page|\/eula-page|\/dmca-policy|\/refund-policy|\/a11y|\/wcag|\/privacypolicy|\/cookies-settings|\/manage-cookies|\/consent|\/privacy-center|\/cookie(?!s)/);
  assert.doesNotMatch(config, /\/terms/);
  assert.doesNotMatch(config, /\/privacy/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/legal|\/privacy-policy|\/terms-of-service|\/tos|\/eula|\/cookies|\/cookie-policy|\/refunds|\/refund|\/dmca|\/imprint|\/accessibility|\/security(?![\w.])|\/trust(?![\w])|\/gdpr(?![\w])|\/ccpa(?![\w])|\/sla(?![\w])|\/terms-and-conditions|\/acceptable-use|\/aup(?![\w])|\/copyright|\/trademarks|\/privacy-notice|\/subprocessors|\/dpa(?![\w])|\/legal-notice|\/disclaimer|\/accessibility-statement|\/terms-of-use|\/cookie-settings|\/do-not-sell|\/your-privacy-choices|\/privacy-choices|\/security-policy|\/responsible-disclosure|\/bug-bounty|\/vulnerability-disclosure|\/data-policy|\/data-processing|\/termsandconditions|\/tos-page|\/eula-page|\/dmca-policy|\/refund-policy|\/a11y|\/wcag|\/privacypolicy|\/cookies-settings|\/manage-cookies|\/consent|\/privacy-center|\/cookie(?!s)/);
  assert.doesNotMatch(proxy, /redirect/);

  assert.ok(PUBLIC_PAGE_PATHS.includes("/terms"));
  assert.ok(PUBLIC_PAGE_PATHS.includes("/privacy"));
  const terms = readRepo("app/terms/page.tsx");
  assert.match(terms, /publicPageMetadata\("\/terms"\)/);
  const privacy = readRepo("app/privacy/page.tsx");
  assert.match(privacy, /publicPageMetadata\("\/privacy"\)/);
  for (const page of [
    "app/legal/page.tsx",
    "app/legal/route.ts",
    "app/tos/page.tsx",
    "app/tos/route.ts",
    "app/terms-of-service/page.tsx",
    "app/terms-of-service/route.ts",
    "app/privacy-policy/page.tsx",
    "app/privacy-policy/route.ts",
    "app/eula/page.tsx",
    "app/eula/route.ts",
    "app/cookies/page.tsx",
    "app/cookies/route.ts",
    "app/cookie-policy/page.tsx",
    "app/cookie-policy/route.ts",
    "public/eula",
    "public/eula.html",
    "public/cookies",
    "public/cookies.html",
    "public/cookie-policy",
    "public/cookie-policy.html",
    "app/refund/page.tsx",
    "app/refund/route.ts",
    "app/refunds/page.tsx",
    "app/refunds/route.ts",
    "app/dmca/page.tsx",
    "app/dmca/route.ts",
    "app/imprint/page.tsx",
    "app/imprint/route.ts",
    "app/accessibility/page.tsx",
    "app/accessibility/route.ts",
    "public/refund",
    "public/refund.html",
    "public/refunds",
    "public/refunds.html",
    "public/dmca",
    "public/dmca.html",
    "public/imprint",
    "public/imprint.html",
    "public/accessibility",
    "public/accessibility.html",
    "app/legal/terms/page.tsx",
    "app/legal/terms/route.ts",
    "app/legal/privacy/page.tsx",
    "app/legal/privacy/route.ts",
    "app/sla/page.tsx",
    "app/sla/route.ts",
    "app/security/page.tsx",
    "app/security/route.ts",
    "app/trust/page.tsx",
    "app/trust/route.ts",
    "app/gdpr/page.tsx",
    "app/gdpr/route.ts",
    "app/ccpa/page.tsx",
    "app/ccpa/route.ts",
    "public/legal/terms",
    "public/legal/terms.html",
    "public/legal/privacy",
    "public/legal/privacy.html",
    "public/sla",
    "public/sla.html",
    "public/security",
    "public/security.html",
    "public/trust",
    "public/trust.html",
    "public/gdpr",
    "public/gdpr.html",
    "public/ccpa",
    "public/ccpa.html",
    "app/terms-and-conditions/page.tsx",
    "app/terms-and-conditions/route.ts",
    "app/acceptable-use/page.tsx",
    "app/acceptable-use/route.ts",
    "app/aup/page.tsx",
    "app/aup/route.ts",
    "app/copyright/page.tsx",
    "app/copyright/route.ts",
    "app/trademarks/page.tsx",
    "app/trademarks/route.ts",
    "app/privacy-notice/page.tsx",
    "app/privacy-notice/route.ts",
    "app/legal/cookies/page.tsx",
    "app/legal/cookies/route.ts",
    "app/subprocessors/page.tsx",
    "app/subprocessors/route.ts",
    "app/dpa/page.tsx",
    "app/dpa/route.ts",
    "public/terms-and-conditions",
    "public/terms-and-conditions.html",
    "public/acceptable-use",
    "public/acceptable-use.html",
    "public/aup",
    "public/aup.html",
    "public/copyright",
    "public/copyright.html",
    "public/trademarks",
    "public/trademarks.html",
    "public/privacy-notice",
    "public/privacy-notice.html",
    "public/legal/cookies",
    "public/legal/cookies.html",
    "public/subprocessors",
    "public/subprocessors.html",
    "public/dpa",
    "public/dpa.html",
    "app/legal-notice/page.tsx",
    "app/legal-notice/route.ts",
    "app/disclaimer/page.tsx",
    "app/disclaimer/route.ts",
    "app/accessibility-statement/page.tsx",
    "app/accessibility-statement/route.ts",
    "app/cookie-settings/page.tsx",
    "app/cookie-settings/route.ts",
    "app/do-not-sell/page.tsx",
    "app/do-not-sell/route.ts",
    "app/privacy-choices/page.tsx",
    "app/privacy-choices/route.ts",
    "app/your-privacy-choices/page.tsx",
    "app/your-privacy-choices/route.ts",
    "app/security-policy/page.tsx",
    "app/security-policy/route.ts",
    "app/responsible-disclosure/page.tsx",
    "app/responsible-disclosure/route.ts",
    "app/bug-bounty/page.tsx",
    "app/bug-bounty/route.ts",
    "app/vulnerability-disclosure/page.tsx",
    "app/vulnerability-disclosure/route.ts",
    "public/legal-notice",
    "public/legal-notice.html",
    "public/disclaimer",
    "public/disclaimer.html",
    "public/accessibility-statement",
    "public/accessibility-statement.html",
    "public/cookie-settings",
    "public/cookie-settings.html",
    "public/do-not-sell",
    "public/do-not-sell.html",
    "public/privacy-choices",
    "public/privacy-choices.html",
    "public/your-privacy-choices",
    "public/your-privacy-choices.html",
    "public/security-policy",
    "public/security-policy.html",
    "public/responsible-disclosure",
    "public/responsible-disclosure.html",
    "public/bug-bounty",
    "public/bug-bounty.html",
    "public/vulnerability-disclosure",
    "public/vulnerability-disclosure.html",
    "app/terms-of-use/page.tsx",
    "app/terms-of-use/route.ts",
    "app/data-policy/page.tsx",
    "app/data-policy/route.ts",
    "app/data-processing/page.tsx",
    "app/data-processing/route.ts",
    "public/terms-of-use",
    "public/terms-of-use.html",
    "public/data-policy",
    "public/data-policy.html",
    "public/data-processing",
    "public/data-processing.html",
    "app/termsandconditions/page.tsx",
    "app/termsandconditions/route.ts",
    "app/tos-page/page.tsx",
    "app/tos-page/route.ts",
    "app/eula-page/page.tsx",
    "app/eula-page/route.ts",
    "app/dmca-policy/page.tsx",
    "app/dmca-policy/route.ts",
    "app/refund-policy/page.tsx",
    "app/refund-policy/route.ts",
    "app/a11y/page.tsx",
    "app/a11y/route.ts",
    "app/wcag/page.tsx",
    "app/wcag/route.ts",
    "app/privacypolicy/page.tsx",
    "app/privacypolicy/route.ts",
    "app/cookie/page.tsx",
    "app/cookie/route.ts",
    "app/cookies-settings/page.tsx",
    "app/cookies-settings/route.ts",
    "app/manage-cookies/page.tsx",
    "app/manage-cookies/route.ts",
    "app/consent/page.tsx",
    "app/consent/route.ts",
    "app/privacy-center/page.tsx",
    "app/privacy-center/route.ts",
    "public/termsandconditions",
    "public/termsandconditions.html",
    "public/tos-page",
    "public/tos-page.html",
    "public/eula-page",
    "public/eula-page.html",
    "public/dmca-policy",
    "public/dmca-policy.html",
    "public/refund-policy",
    "public/refund-policy.html",
    "public/a11y",
    "public/a11y.html",
    "public/wcag",
    "public/wcag.html",
    "public/privacypolicy",
    "public/privacypolicy.html",
    "public/cookie",
    "public/cookie.html",
    "public/cookies-settings",
    "public/cookies-settings.html",
    "public/manage-cookies",
    "public/manage-cookies.html",
    "public/consent",
    "public/consent.html",
    "public/privacy-center",
    "public/privacy-center.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
