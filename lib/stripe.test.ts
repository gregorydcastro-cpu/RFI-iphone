import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  DEFAULT_APP_ORIGIN,
  STRIPE_PRODUCTION_WEBHOOK_URL,
  STRIPE_TRIAL_PERIOD_DAYS,
  STRIPE_WEBHOOK_PATH,
  checkoutReturnOrigin,
  getStripe,
  getStripeCheckoutConfig,
  getStripePriceId,
  getStripePublishableKey,
  getStripeSecretKey,
  getStripeWebhookSecret,
  isStripeCheckoutConfigured,
} from "./stripe.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const inventedSecret = /\b(sk_live_|sk_test_|whsec_|pk_live_|pk_test_)[A-Za-z0-9]+/;

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_ID",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
] as const;

const previous: Record<(typeof ENV_KEYS)[number], string | undefined> = {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

afterEach(() => {
  for (const key of ENV_KEYS) restoreEnv(key, previous[key]);
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function clearStripeEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

function requestAt(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

function readRepo(relative: string): string {
  return readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

test("production webhook URL is www, not apex", () => {
  assert.equal(DEFAULT_APP_ORIGIN, "https://www.gcfieldlog.com");
  assert.equal(STRIPE_WEBHOOK_PATH, "/api/stripe/webhook");
  assert.equal(
    STRIPE_PRODUCTION_WEBHOOK_URL,
    "https://www.gcfieldlog.com/api/stripe/webhook",
  );
  assert.equal(STRIPE_TRIAL_PERIOD_DAYS, 60);
  assert.doesNotMatch(STRIPE_PRODUCTION_WEBHOOK_URL, /^https:\/\/gcfieldlog\.com\//);
});

test("checkout config is null when Stripe keys are unset (no invented secrets)", () => {
  clearStripeEnv();
  assert.equal(getStripeSecretKey(), undefined);
  assert.equal(getStripePriceId(), undefined);
  assert.equal(getStripeWebhookSecret(), undefined);
  assert.equal(getStripePublishableKey(), undefined);
  assert.equal(getStripeCheckoutConfig(), null);
  assert.equal(isStripeCheckoutConfigured(), false);
  assert.equal(getStripe(), null);
});

test("checkout is unconfigured unless both secret key and price id are set", () => {
  clearStripeEnv();
  process.env.STRIPE_SECRET_KEY = "placeholder-not-a-stripe-secret";
  assert.equal(isStripeCheckoutConfigured(), false);
  assert.equal(getStripeCheckoutConfig(), null);

  delete process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_PRICE_ID = "placeholder-not-a-price-id";
  assert.equal(isStripeCheckoutConfigured(), false);
  assert.equal(getStripeCheckoutConfig(), null);
});

test("checkout and webhook routes return billing_unconfigured 503 when keys are missing", () => {
  const checkout = readRepo("app/api/stripe/checkout/route.ts");
  const webhook = readRepo("app/api/stripe/webhook/route.ts");

  assert.match(checkout, /error:\s*"billing_unconfigured"/);
  assert.match(checkout, /status:\s*503/);
  assert.match(checkout, /getStripeCheckoutConfig\(\)/);
  assert.match(checkout, /getStripe\(\)/);

  assert.match(webhook, /error:\s*"billing_unconfigured"/);
  assert.match(webhook, /status:\s*503/);
  assert.match(webhook, /getStripeWebhookSecret\(\)/);
  assert.match(webhook, /https:\/\/www\.gcfieldlog\.com\/api\/stripe\/webhook/);

  const checkoutUnconfigured = checkout.indexOf('"billing_unconfigured"');
  const checkout503 = checkout.indexOf("status: 503");
  assert.ok(checkoutUnconfigured >= 0 && checkout503 > checkoutUnconfigured);

  const webhookUnconfigured = webhook.indexOf('"billing_unconfigured"');
  const webhook503 = webhook.indexOf("status: 503");
  assert.ok(webhookUnconfigured >= 0 && webhook503 > webhookUnconfigured);
});

test("SubscribeCta treats billing_unconfigured as missing Vercel keys, not a host allowlist", () => {
  const cta = readRepo("components/SubscribeCta.tsx");
  assert.match(cta, /Stripe keys are missing on Vercel/);
  assert.match(cta, /case "billing_unconfigured":/);
  assert.doesNotMatch(cta, /not configured on this host/);
  assert.doesNotMatch(cta, /this host yet/);
  assert.match(cta, /STRIPE_SECRET_KEY/);
  assert.match(cta, /STRIPE_PRICE_ID/);
});

test("go-live docs tell Greg to register the www webhook URL", () => {
  const live = readRepo("STRIPE_GO_LIVE.md");
  const readme = readRepo("README.md");
  assert.ok(live.includes(STRIPE_PRODUCTION_WEBHOOK_URL));
  assert.ok(readme.includes(STRIPE_PRODUCTION_WEBHOOK_URL));
  assert.match(live, /www, not apex/);
  assert.match(live, /does not follow redirects/);
  assert.match(readme, /missing keys, not a host allowlist/);
  assert.match(live, /Vercel Production is missing Stripe keys/);
});

test("smoke script still treats unconfigured checkout as 503 billing_unconfigured", () => {
  const smoke = readRepo("scripts/smoke-go-live.sh");
  assert.match(smoke, /503 billing_unconfigured/);
  assert.match(smoke, /\/api\/stripe\/checkout/);
  assert.ok(smoke.includes('BASE_URL="${BASE_URL:-https://www.gcfieldlog.com}"'));
});

test("checkoutReturnOrigin canonicalizes production to www", () => {
  assert.equal(
    checkoutReturnOrigin(
      requestAt("https://internal.example/api/stripe/checkout", {
        "x-forwarded-host": "www.gcfieldlog.com",
        "x-forwarded-proto": "https",
      }),
    ),
    DEFAULT_APP_ORIGIN,
  );
  assert.equal(
    checkoutReturnOrigin(
      requestAt("https://internal.example/api/stripe/checkout", {
        "x-forwarded-host": "gcfieldlog.com",
        "x-forwarded-proto": "https",
      }),
    ),
    DEFAULT_APP_ORIGIN,
  );
  assert.equal(
    checkoutReturnOrigin(
      requestAt("https://internal.example/api/stripe/checkout", {
        "x-forwarded-host": "gc-field-log.vercel.app",
        "x-forwarded-proto": "https",
      }),
    ),
    "https://gc-field-log.vercel.app",
  );
  assert.equal(
    checkoutReturnOrigin(requestAt("http://localhost:3000/api/stripe/checkout")),
    "http://localhost:3000",
  );
});

test("Stripe helpers and copy stay Maple Point / fictional and invent no keys", () => {
  const blob = [
    readRepo("lib/stripe.ts"),
    readRepo("STRIPE_GO_LIVE.md"),
    readRepo("components/SubscribeCta.tsx"),
    readRepo("app/api/stripe/checkout/route.ts"),
    readRepo("app/api/stripe/webhook/route.ts"),
  ].join("\n");
  assert.equal(forbidden.test(blob), false);
  assert.match(blob, /Maple Point/);
  assert.doesNotMatch(blob, inventedSecret);
});
