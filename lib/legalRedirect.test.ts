import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { legalRedirects } from "./legalRedirect.ts";
import { PUBLIC_PAGE_PATHS } from "./siteInfo.ts";

function readRepo(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legal aliases permanently move to /terms or /privacy (308), including /eula, /cookies, /cookie-policy, /refund, /refunds, /dmca, /imprint, /accessibility, /security, /trust, /gdpr, /ccpa, /legal/privacy, /legal/terms, and /sla", () => {
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
  ]);
  for (const redirect of legalRedirects()) {
    assert.equal(redirect.permanent, true);
    assert.ok(redirect.destination === "/terms" || redirect.destination === "/privacy");
    assert.doesNotMatch(redirect.source, /[:*]/);
    assert.equal(redirect.source.endsWith("/"), false, redirect.source);
    const nested = redirect.source.slice(1).includes("/");
    if (nested) {
      assert.ok(
        redirect.source === "/legal/privacy" || redirect.source === "/legal/terms",
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
  assert.notEqual(bySource.get("/legal"), bySource.get("/legal/privacy"));
  assert.equal(bySource.has("/legal/privacy/extra"), false);
  assert.equal(bySource.has("/legal/terms/extra"), false);
  assert.equal(bySource.has("/legal/other"), false);
  assert.equal(bySource.has("/security.txt"), false);
  assert.equal(bySource.has("/security/extra"), false);
  const sources = new Set(legalRedirects().map((redirect) => redirect.source));
  for (const redirect of legalRedirects()) {
    assert.equal(sources.has(redirect.destination), false, redirect.source);
  }

  const config = readRepo("next.config.ts");
  assert.match(config, /\.\.\.legalRedirects\(\)/);
  assert.doesNotMatch(config, /["']\/legal["']/);
  assert.doesNotMatch(config, /\/privacy-policy|\/tos|\/terms-of-service|\/eula|\/cookies|\/cookie-policy|\/refunds|\/refund|\/dmca|\/imprint|\/accessibility|\/trust|\/gdpr|\/ccpa|\/sla|\/legal\/privacy|\/legal\/terms|\/security(?!Headers)/);
  assert.doesNotMatch(config, /\/terms/);
  assert.doesNotMatch(config, /\/privacy/);

  const proxy = readRepo("proxy.ts");
  assert.doesNotMatch(proxy, /\/legal|\/privacy-policy|\/terms-of-service|\/tos|\/eula|\/cookies|\/cookie-policy|\/refunds|\/refund|\/dmca|\/imprint|\/accessibility|\/security(?![\w.])|\/trust(?![\w])|\/gdpr(?![\w])|\/ccpa(?![\w])|\/sla(?![\w])/);
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
  ]) {
    assert.equal(existsSync(new URL(`../${page}`, import.meta.url)), false, page);
  }
});
