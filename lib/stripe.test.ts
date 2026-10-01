import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  BILLING_UNCONFIGURED_MESSAGE,
  billingUnconfiguredBody,
  formatBillingUnconfigured,
} from "./billingMessages.ts";
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
  missingStripeCheckoutEnv,
  missingStripeProductionEnv,
  missingStripeWebhookEnv,
  stripeEnvPresence,
  stripeReadiness,
  stripeSoftFailBody,
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
  const status = readRepo("app/api/stripe/status/route.ts");

  assert.match(checkout, /stripeSoftFailBody\(missingStripeCheckoutEnv\(\)\)/);
  assert.match(checkout, /status:\s*503/);
  assert.match(checkout, /getStripeCheckoutConfig\(\)/);
  assert.match(checkout, /getStripe\(\)/);

  assert.match(webhook, /stripeSoftFailBody\(missingStripeWebhookEnv\(\)\)/);
  assert.match(webhook, /status:\s*503/);
  assert.match(webhook, /getStripeWebhookSecret\(\)/);
  assert.match(webhook, /https:\/\/www\.gcfieldlog\.com\/api\/stripe\/webhook/);

  const checkoutUnconfigured = checkout.indexOf("stripeSoftFailBody(");
  const checkout503 = checkout.indexOf("status: 503");
  assert.ok(checkoutUnconfigured >= 0 && checkout503 > checkoutUnconfigured);

  const webhookUnconfigured = webhook.indexOf("stripeSoftFailBody(");
  const webhook503 = webhook.indexOf("status: 503");
  assert.ok(webhookUnconfigured >= 0 && webhook503 > webhookUnconfigured);

  assert.match(status, /stripeReadiness\(\)/);
  assert.match(status, /Cache-Control/);
  assert.doesNotMatch(status, /getStripeSecretKey|getStripePriceId|getStripeWebhookSecret|secretKey/);
});

test("billing_unconfigured body names Production env and drops anything that is not a key name", () => {
  clearStripeEnv();
  assert.deepEqual(missingStripeCheckoutEnv(), [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_ID",
  ]);
  assert.deepEqual(missingStripeWebhookEnv(), [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]);
  assert.deepEqual(missingStripeProductionEnv(), [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_ID",
    "STRIPE_WEBHOOK_SECRET",
  ]);

  const body = billingUnconfiguredBody(missingStripeCheckoutEnv());
  assert.equal(body.ok, false);
  assert.equal(body.error, "billing_unconfigured");
  assert.deepEqual(body.missing, ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"]);
  assert.match(body.message, /STRIPE_SECRET_KEY/);
  assert.match(body.message, /STRIPE_PRICE_ID/);
  assert.match(body.message, /Production/);
  assert.match(body.message, /Not a host allowlist/);
  assert.doesNotMatch(body.message, /STRIPE_WEBHOOK_SECRET/);

  const poisoned = billingUnconfiguredBody([
    "STRIPE_SECRET_KEY",
    "not-a-key",
    "STRIPE_SECRET_KEY=placeholder",
  ]);
  assert.deepEqual(poisoned.missing, ["STRIPE_SECRET_KEY"]);
  assert.doesNotMatch(JSON.stringify(poisoned), /placeholder/);
  assert.doesNotMatch(JSON.stringify(poisoned), inventedSecret);

  assert.equal(formatBillingUnconfigured(), BILLING_UNCONFIGURED_MESSAGE);
  assert.match(BILLING_UNCONFIGURED_MESSAGE, /STRIPE_WEBHOOK_SECRET/);

  process.env.STRIPE_SECRET_KEY = "placeholder-not-a-stripe-secret";
  process.env.STRIPE_PRICE_ID = "placeholder-not-a-price-id";
  assert.deepEqual(missingStripeCheckoutEnv(), []);
  assert.equal(isStripeCheckoutConfigured(), true);
  assert.deepEqual(missingStripeProductionEnv(), ["STRIPE_WEBHOOK_SECRET"]);
  assert.match(
    formatBillingUnconfigured(missingStripeProductionEnv()),
    /STRIPE_WEBHOOK_SECRET/,
  );

  const partial = stripeSoftFailBody(missingStripeProductionEnv());
  assert.equal(partial.checkoutConfigured, true);
  assert.equal(partial.webhookConfigured, false);
  assert.deepEqual(partial.missing, ["STRIPE_WEBHOOK_SECRET"]);
  assert.doesNotMatch(JSON.stringify(partial), /placeholder/);
});

test("stripe readiness is booleans and env names, never key material", () => {
  clearStripeEnv();
  process.env.STRIPE_SECRET_KEY = "   ";
  process.env.STRIPE_PRICE_ID = "";
  assert.equal(stripeReadiness().checkoutConfigured, false);
  assert.deepEqual(stripeReadiness().missing, [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRICE_ID",
    "STRIPE_WEBHOOK_SECRET",
  ]);

  clearStripeEnv();
  const secret = ["sk", "test", "notarealsecretvalue"].join("_");
  const price = ["price", "notarealpriceidvalue"].join("_");
  const signing = ["whsec", "notarealsigningsecret"].join("_");
  process.env.STRIPE_SECRET_KEY = secret;
  process.env.STRIPE_PRICE_ID = price;
  const partial = stripeReadiness();
  assert.equal(partial.ok, true);
  assert.equal(partial.checkoutConfigured, true);
  assert.equal(partial.webhookConfigured, false);
  assert.equal(isStripeCheckoutConfigured(), true);
  assert.deepEqual(partial.present, {
    STRIPE_SECRET_KEY: true,
    STRIPE_PRICE_ID: true,
    STRIPE_WEBHOOK_SECRET: false,
  });
  assert.deepEqual(partial.missing, ["STRIPE_WEBHOOK_SECRET"]);
  assert.equal(stripeEnvPresence().STRIPE_WEBHOOK_SECRET, false);
  const partialJson = JSON.stringify(partial);
  assert.doesNotMatch(partialJson, inventedSecret);
  assert.equal(partialJson.includes(secret), false);
  assert.equal(partialJson.includes(price), false);
  assert.equal(partialJson.includes("sk_"), false);
  assert.equal(partialJson.includes("price_"), false);

  process.env.STRIPE_WEBHOOK_SECRET = signing;
  const ready = stripeReadiness();
  assert.equal(ready.checkoutConfigured, true);
  assert.equal(ready.webhookConfigured, true);
  assert.deepEqual(ready.missing, []);
  assert.deepEqual(ready.present, {
    STRIPE_SECRET_KEY: true,
    STRIPE_PRICE_ID: true,
    STRIPE_WEBHOOK_SECRET: true,
  });
  const readyJson = JSON.stringify(ready);
  assert.doesNotMatch(readyJson, inventedSecret);
  assert.equal(readyJson.includes(secret), false);
  assert.equal(readyJson.includes(price), false);
  assert.equal(readyJson.includes(signing), false);
  assert.equal(readyJson.includes("whsec_"), false);

  const soft = stripeSoftFailBody(["STRIPE_SECRET_KEY", "leaked-value"]);
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  const unset = stripeSoftFailBody(["not-a-key", secret]);
  assert.equal(unset.checkoutConfigured, false);
  assert.equal(unset.webhookConfigured, false);
  assert.deepEqual(unset.missing, []);
  assert.doesNotMatch(JSON.stringify(unset), inventedSecret);
  assert.equal(JSON.stringify(soft).includes("leaked-value"), false);
});

test("SubscribeCta treats billing_unconfigured as coming soon, not a host allowlist", () => {
  const cta = readRepo("components/SubscribeCta.tsx");
  const pricing = readRepo("app/pricing/page.tsx");
  const account = readRepo("app/account/page.tsx");
  assert.match(cta, /Billing isn't live yet/);
  assert.match(cta, /Checkout is coming soon/);
  assert.match(cta, /Checkout stayed closed/);
  assert.match(cta, /case "billing_unconfigured":/);
  assert.match(cta, /kind: "held"/);
  assert.match(cta, /formatBillingUnconfigured/);
  assert.match(cta, /not missing Production env/);
  assert.match(cta, /Checkout is ready/);
  assert.doesNotMatch(cta, /disabled=\{!configured/);
  assert.doesNotMatch(cta, /not configured on this host/);
  assert.doesNotMatch(cta, /this host yet/);
  assert.match(pricing, /Billing isn't live yet/);
  assert.match(pricing, /stripeReadiness/);
  assert.match(pricing, /data-billing-checkout/);
  assert.match(pricing, /data-billing-webhook/);
  assert.match(pricing, /missing=\{missingStripeEnv\}/);
  assert.match(account, /Billing isn't live yet/);
  assert.match(account, /data-billing-checkout/);
  assert.match(account, /data-billing-webhook/);
  assert.match(account, /STRIPE_WEBHOOK_SECRET/);
  assert.match(account, /formatBillingUnconfigured/);
});

test("go-live docs tell Greg to register the www webhook URL", () => {
  const live = readRepo("STRIPE_GO_LIVE.md");
  const readme = readRepo("README.md");
  assert.ok(live.includes(STRIPE_PRODUCTION_WEBHOOK_URL));
  assert.ok(readme.includes(STRIPE_PRODUCTION_WEBHOOK_URL));
  assert.match(live, /www, not apex/);
  assert.match(live, /does not follow redirects/);
  assert.match(readme, /missing keys, not a host allowlist/);
  assert.match(readme, /Vercel Production env Greg must set/);
  assert.match(readme, /GET \/api\/stripe\/status/);
  assert.match(live, /Production env Greg must set \(names only\)/);
  assert.match(live, /GET \/api\/stripe\/status/);
  assert.match(live, /Vercel Production is missing Stripe keys/);
  assert.match(live, /## One-pass \(live keys on Production\)/);
  assert.match(live, /NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/);
  assert.match(live, /Redeploy Production/);
  assert.match(live, /still-unconfigured vs live/);
  assert.match(live, /customer\.subscription\.deleted/);
  assert.match(live, /method_not_allowed/);
  assert.match(live, /storage_unconfigured/);
  assert.match(readme, /customer\.subscription\.deleted/);
});

test("smoke script still treats unconfigured checkout as 503 billing_unconfigured", () => {
  const smoke = readRepo("scripts/smoke-go-live.sh");
  assert.match(smoke, /503 billing_unconfigured/);
  assert.match(smoke, /\/api\/stripe\/status/);
  assert.match(smoke, /checkoutConfigured/);
  assert.match(smoke, /webhookConfigured/);
  assert.match(smoke, /data-billing-checkout/);
  assert.match(smoke, /data-billing-webhook/);
  assert.match(smoke, /no Checkout Session created/);
  assert.match(smoke, /\/api\/stripe\/checkout/);
  assert.match(smoke, /\/api\/stripe\/webhook/);
  assert.match(smoke, /400 missing_signature/);
  assert.match(smoke, /405 method_not_allowed/);
  assert.match(smoke, /customer\.subscription\.deleted/);
  assert.match(smoke, /never signs/);
  assert.match(smoke, /STRIPE_SECRET_KEY, STRIPE_PRICE_ID/);
  assert.ok(smoke.includes('BASE_URL="${BASE_URL:-https://www.gcfieldlog.com}"'));
});

test("webhook route stays on nodejs, rejects other methods, and handles subscription end", () => {
  const webhook = readRepo("app/api/stripe/webhook/route.ts");
  assert.match(webhook, /export const runtime = "nodejs"/);
  assert.doesNotMatch(webhook, /runtime = "edge"/);
  assert.match(webhook, /request\.text\(\)/);
  assert.match(webhook, /method_not_allowed/);
  assert.match(webhook, /status:\s*405/);
  assert.match(webhook, /customer\.subscription\.deleted/);
  assert.match(webhook, /storage_unconfigured/);
  assert.match(webhook, /upsert_failed/);
  assert.match(webhook, /stripeWebhookHandlerCode/);
  assert.match(webhook, /invoiceSubscriptionId/);
  assert.match(webhook, /duplicate/);
  assert.match(webhook, /stripeSoftFailBody\(missingStripeWebhookEnv\(\)\)/);
  const unconfigured = webhook.indexOf("stripeSoftFailBody(");
  const verify = webhook.indexOf("constructEvent");
  assert.ok(unconfigured >= 0 && verify > unconfigured);
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
    readRepo("lib/billingMessages.ts"),
    readRepo("app/pricing/page.tsx"),
    readRepo("app/account/page.tsx"),
    readRepo("app/api/stripe/checkout/route.ts"),
    readRepo("app/api/stripe/webhook/route.ts"),
    readRepo("app/api/stripe/status/route.ts"),
    readRepo("lib/stripeWebhook.ts"),
    readRepo("lib/billingCustomers.ts"),
  ].join("\n");
  assert.equal(forbidden.test(blob), false);
  assert.match(blob, /Maple Point/);
  assert.doesNotMatch(blob, inventedSecret);
});
