import assert from "node:assert/strict";
import { test } from "node:test";
import { accessTokenNeedsRefresh } from "./procoreTokenExpiry.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("access tokens refresh ~2 minutes before expiry", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  assert.equal(accessTokenNeedsRefresh(null, now), false);
  assert.equal(accessTokenNeedsRefresh("not-a-date", now), false);
  assert.equal(
    accessTokenNeedsRefresh("2026-09-18T13:30:00.000Z", now),
    false,
  );
  assert.equal(
    accessTokenNeedsRefresh("2026-09-18T12:01:00.000Z", now),
    true,
  );
  assert.equal(
    accessTokenNeedsRefresh("2026-09-18T11:59:00.000Z", now),
    true,
  );
});

test("token helper copy stays Maple Point / fictional only", () => {
  assert.equal(forbidden.test("Maple Point Medical Office refresh_token"), false);
});
