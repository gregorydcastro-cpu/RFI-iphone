import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SECURITY_HEADERS } from "./securityHeaders.ts";

function header(name: string): string {
  const found = SECURITY_HEADERS.find((item) => item.key === name);
  assert.ok(found, name);
  return found.value;
}

test("baseline headers cover sniffing, referrer, framing, and device permissions", () => {
  assert.deepEqual(
    SECURITY_HEADERS.map((item) => item.key),
    [
      "X-Content-Type-Options",
      "Referrer-Policy",
      "X-Frame-Options",
      "Content-Security-Policy",
      "Permissions-Policy",
    ],
  );
  assert.equal(header("X-Content-Type-Options"), "nosniff");
  assert.equal(header("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(header("X-Frame-Options"), "DENY");
  assert.equal(header("Content-Security-Policy"), "frame-ancestors 'none'");
  assert.equal(
    header("Permissions-Policy"),
    "camera=(self), microphone=(self), geolocation=(self)",
  );
});

test("framing denial is not a script policy, and payment stays at the browser default", () => {
  const csp = header("Content-Security-Policy");
  assert.equal(csp, "frame-ancestors 'none'");
  assert.doesNotMatch(csp, /script-src|default-src|connect-src|style-src|frame-src/);
  const permissions = header("Permissions-Policy");
  assert.match(permissions, /camera=\(self\)/);
  assert.match(permissions, /microphone=\(self\)/);
  assert.match(permissions, /geolocation=\(self\)/);
  assert.doesNotMatch(permissions, /payment/);
});

test("next config applies the baseline headers on every route", () => {
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /SECURITY_HEADERS/);
  assert.match(config, /async headers\(\)/);
  assert.match(config, /source:\s*"\/:path\*"/);
});
