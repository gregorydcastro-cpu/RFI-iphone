import assert from "node:assert/strict";
import { test } from "node:test";
import type { BillingCustomer } from "./billingCustomers.ts";
import {
  STRIPE_HANDLED_WEBHOOK_EVENTS,
  checkoutSessionSubscriptionId,
  createStripeEventMemory,
  invoiceSubscriptionId,
  isHandledStripeWebhookEvent,
  safeLogToken,
  shouldApplySubscriptionSnapshot,
  statusAfterCheckout,
  statusAfterInvoicePaid,
  stripeWebhookHandlerCode,
} from "./stripeWebhook.ts";

const inventedSecret =
  /\b(sk_live_|sk_test_|whsec_|pk_live_|pk_test_)[A-Za-z0-9]+/;

function customer(
  overrides: Partial<BillingCustomer> = {},
): BillingCustomer {
  return {
    email: "crew@maplepoint.example",
    stripeCustomerId: "cus_current",
    stripeSubscriptionId: "sub_current",
    status: "active",
    trialEnd: "2026-12-01T00:00:00.000Z",
    ...overrides,
  };
}

test("handled webhook events include subscription end", () => {
  assert.deepEqual(STRIPE_HANDLED_WEBHOOK_EVENTS, [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
  ]);
  assert.equal(isHandledStripeWebhookEvent("customer.subscription.deleted"), true);
  assert.equal(isHandledStripeWebhookEvent("invoice.payment_failed"), false);
});

test("event memory records only what the caller adds and drops the oldest", () => {
  const memory = createStripeEventMemory(2);
  assert.equal(memory.has("evt_1"), false);
  assert.equal(memory.has(""), false);
  memory.add("evt_1");
  memory.add("evt_1");
  assert.equal(memory.has("evt_1"), true);
  memory.add("evt_2");
  memory.add("evt_3");
  assert.equal(memory.has("evt_1"), false);
  assert.equal(memory.has("evt_2"), true);
  assert.equal(memory.has("evt_3"), true);
});

test("a canceled snapshot for a different subscription does not clobber the current one", () => {
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: "sub_current",
      incomingSubscriptionId: "sub_old",
      incomingStatus: "canceled",
      ended: true,
    }),
    false,
  );
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: "sub_current",
      incomingSubscriptionId: "sub_old",
      incomingStatus: "canceled",
      ended: false,
    }),
    false,
  );
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: "sub_current",
      incomingSubscriptionId: "sub_current",
      incomingStatus: "canceled",
      ended: true,
    }),
    true,
  );
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: "sub_old",
      incomingSubscriptionId: "sub_new",
      incomingStatus: "trialing",
      ended: false,
    }),
    true,
  );
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: "sub_current",
      incomingSubscriptionId: "sub_new",
      incomingStatus: "active",
      ended: false,
    }),
    true,
  );
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: "sub_current",
      incomingSubscriptionId: "sub_old",
      incomingStatus: "past_due",
      ended: false,
    }),
    false,
  );
  assert.equal(
    shouldApplySubscriptionSnapshot({
      existingSubscriptionId: null,
      incomingSubscriptionId: "sub_new",
      incomingStatus: "canceled",
      ended: true,
    }),
    true,
  );
});

test("checkout and invoice status keep a stored trial when retrieve fails", () => {
  const trialing = customer({ status: "trialing" });
  assert.equal(statusAfterCheckout(null, null), "trialing");
  assert.equal(statusAfterCheckout(trialing, null), "trialing");
  assert.equal(statusAfterCheckout(customer(), null), "active");
  assert.equal(statusAfterCheckout(customer(), "past_due"), "past_due");

  assert.equal(
    statusAfterInvoicePaid({
      existing: trialing,
      subscriptionId: "sub_current",
      fromSubscription: null,
    }),
    "trialing",
  );
  assert.equal(
    statusAfterInvoicePaid({
      existing: customer({ status: "past_due" }),
      subscriptionId: "sub_current",
      fromSubscription: null,
    }),
    "active",
  );
  assert.equal(
    statusAfterInvoicePaid({
      existing: trialing,
      subscriptionId: "sub_current",
      fromSubscription: "active",
    }),
    "active",
  );
  assert.equal(
    statusAfterInvoicePaid({
      existing: null,
      subscriptionId: null,
      fromSubscription: null,
    }),
    "active",
  );
});

test("handler codes are an allowlist and drop secret-shaped text", () => {
  assert.equal(
    stripeWebhookHandlerCode(new Error("storage_unconfigured")),
    "storage_unconfigured",
  );
  assert.equal(
    stripeWebhookHandlerCode(new Error("upsert_failed")),
    "upsert_failed",
  );
  assert.equal(
    stripeWebhookHandlerCode(new Error("lookup_failed")),
    "lookup_failed",
  );
  const leaked = ["sk", "live", "notasecret"].join("_");
  assert.equal(stripeWebhookHandlerCode(new Error(leaked)), "handler_error");
  assert.equal(stripeWebhookHandlerCode({ type: "StripeCardError" }), "StripeCardError");
  assert.equal(safeLogToken("StripeSignatureVerificationError"), "StripeSignatureVerificationError");
  assert.equal(safeLogToken(leaked), "unknown");
  const signingPrefix = ["whsec", "notasecret"].join("_");
  assert.equal(safeLogToken(signingPrefix), "unknown");
  assert.equal(safeLogToken("bad type"), "unknown");
  assert.doesNotMatch(
    [
      stripeWebhookHandlerCode(new Error(leaked)),
      safeLogToken(leaked),
      safeLogToken(signingPrefix),
    ].join("\n"),
    inventedSecret,
  );
});

test("invoice subscription id survives API version shapes", () => {
  assert.equal(
    invoiceSubscriptionId({
      parent: { subscription_details: { subscription: "sub_parent" } },
    }),
    "sub_parent",
  );
  assert.equal(
    invoiceSubscriptionId({
      parent: {
        subscription_details: { subscription: { id: "sub_expanded" } },
      },
    }),
    "sub_expanded",
  );
  assert.equal(
    invoiceSubscriptionId({ subscription: "sub_legacy" }),
    "sub_legacy",
  );
  assert.equal(
    invoiceSubscriptionId({
      lines: {
        data: [
          {
            parent: {
              subscription_item_details: { subscription: "sub_line" },
            },
          },
        ],
      },
    }),
    "sub_line",
  );
  assert.equal(
    invoiceSubscriptionId({
      lines: {
        data: [
          {
            parent: {
              invoice_item_details: { subscription: "sub_item" },
            },
          },
        ],
      },
    }),
    "sub_item",
  );
  assert.equal(
    invoiceSubscriptionId({
      lines: { data: [{ subscription: "sub_line_legacy" }] },
    }),
    "sub_line_legacy",
  );
  assert.equal(invoiceSubscriptionId({ parent: { type: "quote_details" } }), null);
  assert.equal(invoiceSubscriptionId(null), null);
});

test("checkout session subscription id accepts a string or expanded object", () => {
  assert.equal(
    checkoutSessionSubscriptionId({ subscription: "sub_checkout" }),
    "sub_checkout",
  );
  assert.equal(
    checkoutSessionSubscriptionId({ subscription: { id: "sub_expanded" } }),
    "sub_expanded",
  );
  assert.equal(checkoutSessionSubscriptionId({ subscription: null }), null);
  assert.equal(checkoutSessionSubscriptionId({}), null);
});
