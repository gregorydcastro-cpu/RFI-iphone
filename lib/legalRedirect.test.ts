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
      source: "/terms-conditions",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/termsconditions",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/user-agreement",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/license-agreement",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/legal-terms",
      destination: "/terms",
      permanent: true,
    },

    {
      source: "/privacy-and-terms",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/legal-page",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-page",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/tos-privacy",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/license",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/licenses",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/open-source",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/termsofservice",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/termsofuse",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/impressum",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/opensource",
      destination: "/terms",
      permanent: true,
    },

    {
      source: "/acceptable-use-policy",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/eula-agreement",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/copyright-policy",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/disclaimer-page",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/license-page",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/copyright-notice",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/trademark",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/legal.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/tos.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/eula.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-of-service.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/acceptableuse",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/end-user-license-agreement",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-of-services",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms.htm",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/tos.htm",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/termsandconditions.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/terms-of-use.html",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/termss",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/legal.htm",
      destination: "/terms",
      permanent: true,
    },
    {
      source: "/eula.htm",
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
    {
      source: "/privacy-statement",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/data-protection",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/gdpr-privacy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-notice",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-preferences",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/opt-out",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/ccpa-opt-out",
      destination: "/privacy",
      permanent: true,
    },

    {
      source: "/cookie-policy-page",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-request",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-page",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-policy-page",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/security-page",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/security-center",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/trust-page",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookiepolicy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/donotsell",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/optout",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacynotice",
      destination: "/privacy",
      permanent: true,
    },

    {
      source: "/cookies-policy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-consent",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/do-not-sell-my-info",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-settings",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-policy.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-policy.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookies.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacypolicy.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/your-privacy-rights",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy.htm",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privcy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-notice.html",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacypolcy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privacy-policy.htm",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privay",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/privecy",
      destination: "/privacy",
      permanent: true,
    },
    {
      source: "/cookie-policy.htm",
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
  for (const source of [
    "/terms-conditions",
    "/termsconditions",
    "/user-agreement",
    "/license-agreement",
    "/legal-terms",
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
    "/privacy-statement",
    "/data-protection",
    "/gdpr-privacy",
    "/cookie-notice",
    "/cookie-preferences",
    "/opt-out",
    "/ccpa-opt-out",
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
  assert.equal(bySource.get("/terms-conditions"), bySource.get("/terms-and-conditions"));
  assert.equal(bySource.has("/terms-and-conditions"), true);
  assert.equal(bySource.get("/termsconditions"), bySource.get("/termsandconditions"));
  assert.equal(bySource.has("/termsandconditions"), true);
  assert.equal(bySource.get("/legal-terms"), bySource.get("/legal"));
  assert.equal(bySource.has("/legal/terms"), true);
  assert.equal(bySource.get("/privacy-statement"), bySource.get("/privacy-policy"));
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.get("/data-protection"), bySource.get("/data-policy"));
  assert.equal(bySource.get("/gdpr-privacy"), bySource.get("/gdpr"));
  assert.equal(bySource.get("/cookie-notice"), bySource.get("/cookies"));
  assert.equal(bySource.get("/cookie-preferences"), bySource.get("/cookie-settings"));
  assert.equal(bySource.get("/opt-out"), bySource.get("/privacy-policy"));
  assert.equal(bySource.has("/opt-out"), true);
  assert.equal(bySource.get("/ccpa-opt-out"), bySource.get("/ccpa"));
  assert.equal(bySource.has("/ccpa"), true);
  for (const source of [
    "/privacy-and-terms",
    "/legal-page",
    "/terms-page"
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
    "/cookie-policy-page",
    "/privacy-request",
    "/privacy-page",
    "/privacy-policy-page",
    "/security-page",
    "/security-center",
    "/trust-page"
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
  assert.equal(bySource.get("/privacy-and-terms"), bySource.get("/legal"));
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.get("/legal-page"), bySource.get("/legal"));
  assert.equal(bySource.has("/legal"), true);
  assert.equal(bySource.get("/terms-page"), bySource.get("/tos-page"));
  assert.equal(bySource.has("/tos-page"), true);
  assert.equal(bySource.get("/cookie-policy-page"), bySource.get("/cookie-policy"));
  assert.equal(bySource.get("/privacy-request"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/privacy-page"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/privacy-policy-page"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/security-page"), bySource.get("/security"));
  assert.equal(bySource.has("/security-policy-page"), false);
  assert.equal(bySource.get("/security-center"), bySource.get("/security"));
  assert.equal(bySource.get("/trust-page"), bySource.get("/trust"));
  assert.equal(bySource.has("/trust-center"), false);
  for (const source of ["/tos-privacy", "/license", "/licenses", "/open-source"]) {
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
  assert.equal(bySource.get("/tos-privacy"), bySource.get("/tos"));
  assert.equal(bySource.has("/tos"), true);
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.get("/license"), bySource.get("/license-agreement"));
  assert.equal(bySource.get("/licenses"), bySource.get("/license"));
  assert.equal(bySource.has("/license-agreement"), true);
  assert.equal(bySource.get("/open-source"), bySource.get("/license"));
  assert.equal(bySource.has("/license/extra"), false);
  assert.equal(bySource.has("/licenses/extra"), false);
  assert.equal(bySource.has("/tos-privacy/extra"), false);
  for (const source of ["/termsofservice", "/termsofuse", "/impressum", "/opensource"]) {
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
  for (const source of ["/cookiepolicy", "/donotsell", "/optout", "/privacynotice"]) {
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
  assert.equal(bySource.get("/termsofservice"), bySource.get("/terms-of-service"));
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.has("/terms-of-service"), true);
  assert.equal(bySource.get("/termsofuse"), bySource.get("/terms-of-use"));
  assert.equal(bySource.get("/impressum"), bySource.get("/imprint"));
  assert.equal(bySource.get("/opensource"), bySource.get("/open-source"));
  assert.equal(bySource.has("/open-source"), true);
  assert.equal(bySource.get("/cookiepolicy"), bySource.get("/cookie-policy"));
  assert.equal(bySource.has("/cookie"), true);
  assert.equal(bySource.get("/donotsell"), bySource.get("/do-not-sell"));
  assert.equal(bySource.get("/optout"), bySource.get("/opt-out"));
  assert.equal(bySource.get("/privacynotice"), bySource.get("/privacy-notice"));
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.has("/termsofservice/extra"), false);
  assert.equal(bySource.has("/privacynotice/extra"), false);

  for (const source of [
    "/acceptable-use-policy",
    "/eula-agreement",
    "/copyright-policy",
    "/disclaimer-page",
    "/license-page",
    "/copyright-notice",
    "/trademark",
    "/terms.html",
    "/legal.html",
    "/tos.html",
    "/eula.html",
    "/terms-of-service.html",
    "/acceptableuse",
    "/end-user-license-agreement",
    "/terms-of-services",
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
    "/cookies-policy",
    "/cookie-consent",
    "/do-not-sell-my-info",
    "/privacy.html",
    "/privacy-settings",
    "/privacy-policy.html",
    "/cookie-policy.html",
    "/cookies.html",
    "/privacypolicy.html",
    "/your-privacy-rights",
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
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.get("/acceptable-use-policy"), bySource.get("/acceptable-use"));
  assert.equal(bySource.has("/acceptable-use"), true);
  assert.equal(bySource.get("/eula-agreement"), bySource.get("/eula"));
  assert.equal(bySource.has("/license-agreement"), true);
  assert.equal(bySource.get("/copyright-policy"), bySource.get("/copyright"));
  assert.equal(bySource.get("/disclaimer-page"), bySource.get("/disclaimer"));
  assert.equal(bySource.get("/license-page"), bySource.get("/license"));
  assert.equal(bySource.get("/copyright-notice"), bySource.get("/copyright"));
  assert.equal(bySource.has("/legal-notice"), true);
  assert.equal(bySource.get("/trademark"), bySource.get("/trademarks"));
  assert.equal(bySource.get("/terms.html"), bySource.get("/tos"));
  assert.equal(bySource.get("/cookies-policy"), bySource.get("/cookie-policy"));
  assert.equal(bySource.has("/cookies"), true);
  assert.equal(bySource.get("/cookie-consent"), bySource.get("/consent"));
  assert.equal(bySource.has("/cookie"), true);
  assert.equal(bySource.get("/do-not-sell-my-info"), bySource.get("/do-not-sell"));
  assert.equal(bySource.get("/privacy.html"), bySource.get("/privacy-policy"));
  assert.equal(bySource.get("/privacy-settings"), bySource.get("/cookie-settings"));
  assert.equal(bySource.has("/gdpr.html"), false);
  assert.equal(bySource.has("/data-privacy"), false);
  assert.equal(bySource.has("/gdpr-notice"), false);
  assert.equal(bySource.has("/cpra"), false);
  assert.equal(bySource.has("/report-vulnerability"), false);
  assert.equal(bySource.has("/security-policy-page"), false);
  assert.equal(bySource.has("/acceptable-use-policy/extra"), false);
  assert.equal(bySource.has("/privacy.html/extra"), false);
  for (const source of ["/terms.htm", "/tos.htm"]) {
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
  for (const source of ["/privacy.htm", "/cookie.html", "/privcy"]) {
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
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.has("/refund.html"), false);
  assert.equal(bySource.has("/refund"), true);
  assert.equal(bySource.has("/refunds"), true);
  assert.equal(bySource.has("/accessibility.html"), false);
  assert.equal(bySource.has("/accessibility"), true);
  assert.equal(bySource.get("/terms.htm"), bySource.get("/terms.html"));
  assert.equal(bySource.has("/terms.html"), true);
  assert.equal(bySource.get("/tos.htm"), bySource.get("/tos"));
  assert.equal(bySource.has("/tos.html"), true);
  assert.equal(bySource.get("/privacy.htm"), bySource.get("/privacy.html"));
  assert.equal(bySource.has("/privacy.html"), true);
  assert.equal(bySource.get("/cookie.html"), bySource.get("/cookie"));
  assert.equal(bySource.has("/cookies.html"), true);
  assert.equal(bySource.has("/cookies"), true);
  assert.equal(bySource.has("/security.html"), false);
  assert.equal(bySource.has("/security"), true);
  assert.equal(bySource.has("/security-policy"), true);
  assert.equal(bySource.has("/security-policy-page"), false);
  assert.equal(bySource.has("/security.txt"), false);
  assert.equal(bySource.get("/privcy"), bySource.get("/privacy.htm"));
  assert.equal(bySource.has("/gdpr.html"), false);
  for (const source of [
    "/termsandconditions.html",
    "/terms-of-use.html",
    "/termss",
    "/legal.htm",
    "/eula.htm",
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
    "/privacy-notice.html",
    "/privacypolcy",
    "/privacy-policy.htm",
    "/privay",
    "/privecy",
    "/cookie-policy.htm",
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
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.get("/termsandconditions.html"), bySource.get("/termsandconditions"));
  assert.equal(bySource.has("/terms.html"), true);
  assert.equal(bySource.get("/terms-of-use.html"), bySource.get("/terms-of-use"));
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.get("/termss"), "/terms");
  assert.equal(bySource.has("/terms"), false);
  assert.equal(bySource.get("/legal.htm"), bySource.get("/legal.html"));
  assert.equal(bySource.has("/legal"), true);
  assert.equal(bySource.get("/eula.htm"), bySource.get("/eula.html"));
  assert.equal(bySource.has("/eula"), true);
  assert.equal(bySource.get("/privacy-notice.html"), bySource.get("/privacy-notice"));
  assert.equal(bySource.has("/privacy.html"), true);
  assert.equal(bySource.get("/privacypolcy"), bySource.get("/privacypolicy"));
  assert.equal(bySource.has("/privacypolicy"), true);
  assert.equal(bySource.get("/privacy-policy.htm"), bySource.get("/privacy-policy.html"));
  assert.equal(bySource.has("/privacy.htm"), true);
  assert.equal(bySource.get("/privay"), bySource.get("/privcy"));
  assert.equal(bySource.get("/privecy"), bySource.get("/privay"));
  assert.equal(bySource.has("/privacy"), false);
  assert.equal(bySource.get("/cookie-policy.htm"), bySource.get("/cookie-policy.html"));
  assert.equal(bySource.has("/cookie.html"), true);
  assert.equal(bySource.has("/ccpa.html"), false);
  assert.equal(bySource.get("/ccpa"), "/privacy");
  assert.equal(bySource.has("/user-agreement.html"), false);
  assert.equal(bySource.has("/privacypolicy.htm"), false);
  assert.equal(bySource.has("/cookiepolicy.html"), false);
  assert.equal(bySource.has("/cookies.htm"), false);
  assert.equal(bySource.has("/cookeis"), false);
  assert.equal(bySource.has("/cookes"), false);
  for (const path of [
    "/unsubscribe",
    "/subscribe",
    "/subscription",
    "/upgrade",
    "/billing",
    "/checkout",
    "/pay",
    "/payment",
    "/payments",
    "/invoice",
    "/invoices",
    "/schedule",
    "/affiliates",
    "/security-policy-page",
    "/gdpr.html",
    "/data-privacy",
    "/security.html",
    "/accessibility.html",
    "/refund.html",
    "/try.html",
    "/status.html",
    "/blog.html",
    "/integrations.html",
    "/trial.html",
    "/free-trial.html",
    "/ccpa.html",
    "/gdpr-notice",
    "/cpra",
    "/report-vulnerability",
  ]) {
    assert.equal(bySource.has(path), false, path);
  }
  assert.equal(bySource.has("/security-policy"), true);
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
  assert.doesNotMatch(config, /\/privacy-policy|\/tos|\/terms-of-service|\/eula|\/cookies|\/cookie-policy|\/refunds|\/refund|\/dmca|\/imprint|\/accessibility|\/trust|\/gdpr|\/ccpa|\/sla|\/legal\/privacy|\/legal\/terms|\/security(?!Headers)|\/terms-and-conditions|\/acceptable-use|\/aup|\/copyright|\/trademarks|\/privacy-notice|\/legal\/cookies|\/subprocessors|\/dpa|\/legal-notice|\/disclaimer|\/accessibility-statement|\/terms-of-use|\/cookie-settings|\/do-not-sell|\/your-privacy-choices|\/privacy-choices|\/security-policy|\/responsible-disclosure|\/bug-bounty|\/vulnerability-disclosure|\/data-policy|\/data-processing|\/termsandconditions|\/tos-page|\/eula-page|\/dmca-policy|\/refund-policy|\/a11y|\/wcag|\/privacypolicy|\/cookies-settings|\/manage-cookies|\/consent|\/privacy-center|\/cookie(?!s)|\/terms-conditions|\/termsconditions|\/user-agreement|\/license-agreement|\/legal-terms|\/privacy-statement|\/data-protection|\/gdpr-privacy|\/cookie-notice|\/cookie-preferences|\/ccpa-opt-out|\/opt-out|\/privacy-and-terms|\/legal-page|\/terms-page|\/cookie-policy-page|\/privacy-request|\/privacy-page|\/privacy-policy-page|\/security-page|\/security-center|\/trust-page|\/tos-privacy|\/license|\/licenses|\/open-source|\/termsofservice|\/termsofuse|\/impressum|\/opensource|\/cookiepolicy|\/donotsell|\/optout|\/privacynotice|\/acceptable-use-policy|\/eula-agreement|\/copyright-policy|\/disclaimer-page|\/license-page|\/copyright-notice|\/trademark|\/terms\.html|\/cookies-policy|\/cookie-consent|\/do-not-sell-my-info|\/privacy\.html|\/privacy-settings|\/legal\.html|\/tos\.html|\/eula\.html|\/terms-of-service\.html|\/acceptableuse|\/end-user-license-agreement|\/terms-of-services|\/privacy-policy\.html|\/cookie-policy\.html|\/cookies\.html|\/gdpr\.html|\/privacypolicy\.html|\/data-privacy|\/your-privacy-rights|\/refund\.html|\/accessibility\.html|\/terms\.htm|\/tos\.htm|\/privacy\.htm|\/cookie\.html|\/security\.html|\/privcy|\/termsandconditions\.html|\/terms-of-use\.html|\/termss|\/legal\.htm|\/eula\.htm|\/privacy-notice\.html|\/privacypolcy|\/privacy-policy\.htm|\/privay|\/privecy|\/cookie-policy\.htm|\/ccpa\.html/);
  assert.doesNotMatch(config, /\/terms/);
  assert.doesNotMatch(config, /\/privacy/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/legal|\/privacy-policy|\/terms-of-service|\/tos|\/eula|\/cookies|\/cookie-policy|\/refunds|\/refund|\/dmca|\/imprint|\/accessibility|\/security(?![\w.])|\/trust(?![\w])|\/gdpr(?![\w])|\/ccpa(?![\w])|\/sla(?![\w])|\/terms-and-conditions|\/acceptable-use|\/aup(?![\w])|\/copyright|\/trademarks|\/privacy-notice|\/subprocessors|\/dpa(?![\w])|\/legal-notice|\/disclaimer|\/accessibility-statement|\/terms-of-use|\/cookie-settings|\/do-not-sell|\/your-privacy-choices|\/privacy-choices|\/security-policy|\/responsible-disclosure|\/bug-bounty|\/vulnerability-disclosure|\/data-policy|\/data-processing|\/termsandconditions|\/tos-page|\/eula-page|\/dmca-policy|\/refund-policy|\/a11y|\/wcag|\/privacypolicy|\/cookies-settings|\/manage-cookies|\/consent|\/privacy-center|\/cookie(?!s)|\/terms-conditions|\/termsconditions|\/user-agreement|\/license-agreement|\/legal-terms|\/privacy-statement|\/data-protection|\/gdpr-privacy|\/cookie-notice|\/cookie-preferences|\/ccpa-opt-out|\/opt-out|\/privacy-and-terms|\/legal-page|\/terms-page|\/cookie-policy-page|\/privacy-request|\/privacy-page|\/privacy-policy-page|\/security-page|\/security-center|\/trust-page|\/tos-privacy|\/license|\/licenses|\/open-source|\/termsofservice|\/termsofuse|\/impressum|\/opensource|\/cookiepolicy|\/donotsell|\/optout|\/privacynotice|\/acceptable-use-policy|\/eula-agreement|\/copyright-policy|\/disclaimer-page|\/license-page|\/copyright-notice|\/trademark|\/terms\.html|\/cookies-policy|\/cookie-consent|\/do-not-sell-my-info|\/privacy\.html|\/privacy-settings|\/legal\.html|\/tos\.html|\/eula\.html|\/terms-of-service\.html|\/acceptableuse|\/end-user-license-agreement|\/terms-of-services|\/privacy-policy\.html|\/cookie-policy\.html|\/cookies\.html|\/gdpr\.html|\/privacypolicy\.html|\/data-privacy|\/your-privacy-rights|\/refund\.html|\/accessibility\.html|\/terms\.htm|\/tos\.htm|\/privacy\.htm|\/cookie\.html|\/security\.html|\/privcy|\/termsandconditions\.html|\/terms-of-use\.html|\/termss|\/legal\.htm|\/eula\.htm|\/privacy-notice\.html|\/privacypolcy|\/privacy-policy\.htm|\/privay|\/privecy|\/cookie-policy\.htm|\/ccpa\.html/);
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
    "app/terms-conditions/page.tsx",
    "app/terms-conditions/route.ts",
    "app/termsconditions/page.tsx",
    "app/termsconditions/route.ts",
    "app/user-agreement/page.tsx",
    "app/user-agreement/route.ts",
    "app/license-agreement/page.tsx",
    "app/license-agreement/route.ts",
    "app/legal-terms/page.tsx",
    "app/legal-terms/route.ts",
    "app/privacy-statement/page.tsx",
    "app/privacy-statement/route.ts",
    "app/data-protection/page.tsx",
    "app/data-protection/route.ts",
    "app/gdpr-privacy/page.tsx",
    "app/gdpr-privacy/route.ts",
    "app/cookie-notice/page.tsx",
    "app/cookie-notice/route.ts",
    "app/cookie-preferences/page.tsx",
    "app/cookie-preferences/route.ts",
    "app/opt-out/page.tsx",
    "app/opt-out/route.ts",
    "app/ccpa-opt-out/page.tsx",
    "app/ccpa-opt-out/route.ts",
    "public/terms-conditions",
    "public/terms-conditions.html",
    "public/termsconditions",
    "public/termsconditions.html",
    "public/user-agreement",
    "public/user-agreement.html",
    "public/license-agreement",
    "public/license-agreement.html",
    "public/legal-terms",
    "public/legal-terms.html",
    "public/privacy-statement",
    "public/privacy-statement.html",
    "public/data-protection",
    "public/data-protection.html",
    "public/gdpr-privacy",
    "public/gdpr-privacy.html",
    "public/cookie-notice",
    "public/cookie-notice.html",
    "public/cookie-preferences",
    "public/cookie-preferences.html",
    "public/opt-out",
    "public/opt-out.html",
    "public/ccpa-opt-out",
    "public/ccpa-opt-out.html",
    "app/security-policy-page/page.tsx",
    "app/security-policy-page/route.ts",
    "public/security-policy-page",
    "public/security-policy-page.html",
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
  for (const name of [
    "privacy-and-terms",
    "legal-page",
    "terms-page",
    "cookie-policy-page",
    "privacy-request",
    "privacy-page",
    "privacy-policy-page",
    "security-page",
    "security-center",
    "trust-page",
    "tos-privacy",
    "license",
    "licenses",
    "open-source",
    "termsofservice",
    "termsofuse",
    "impressum",
    "opensource",
    "cookiepolicy",
    "donotsell",
    "optout",
    "privacynotice",
    "acceptable-use-policy",
    "eula-agreement",
    "copyright-policy",
    "disclaimer-page",
    "license-page",
    "copyright-notice",
    "trademark",
    "terms.html",
    "cookies-policy",
    "cookie-consent",
    "do-not-sell-my-info",
    "privacy.html",
    "privacy-settings",
    "legal.html",
    "tos.html",
    "eula.html",
    "terms-of-service.html",
    "acceptableuse",
    "end-user-license-agreement",
    "terms-of-services",
    "privacy-policy.html",
    "cookie-policy.html",
    "cookies.html",
    "privacypolicy.html",
    "your-privacy-rights",
    "refund.html",
    "accessibility.html",
    "terms.htm",
    "tos.htm",
    "privacy.htm",
    "cookie.html",
    "security.html",
    "privcy",
    "termsandconditions.html",
    "terms-of-use.html",
    "termss",
    "legal.htm",
    "eula.htm",
    "privacy-notice.html",
    "privacypolcy",
    "privacy-policy.htm",
    "privay",
    "privecy",
    "cookie-policy.htm",
    "ccpa.html",
    "trial.html",
    "free-trial.html",
  ]) {
    for (const page of [
      `app/${name}/page.tsx`,
      `app/${name}/route.ts`,
      `public/${name}`,
      `public/${name}.html`,
    ]) {
      assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
    }
  }
});
