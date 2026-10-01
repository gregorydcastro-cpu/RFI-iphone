import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingCustomerUpsertRow,
  mergeBillingCustomer,
  type BillingCustomer,
} from "./billingCustomers.ts";

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

test("merge keeps stored email, subscription, and trial end when the event omits them", () => {
  const merged = mergeBillingCustomer(customer(), {
    email: null,
    stripeCustomerId: "cus_current",
    stripeSubscriptionId: null,
    status: "canceled",
    trialEnd: null,
  });
  assert.equal(merged.email, "crew@maplepoint.example");
  assert.equal(merged.stripeSubscriptionId, "sub_current");
  assert.equal(merged.status, "canceled");
  assert.equal(merged.trialEnd, "2026-12-01T00:00:00.000Z");
});

test("merge lets a new email and subscription replace the stored row", () => {
  const merged = mergeBillingCustomer(customer(), {
    email: "  Next@MaplePoint.example ",
    stripeCustomerId: "cus_current",
    stripeSubscriptionId: "sub_next",
    status: "trialing",
    trialEnd: "2027-01-01T00:00:00.000Z",
  });
  assert.equal(merged.email, "next@maplepoint.example");
  assert.equal(merged.stripeSubscriptionId, "sub_next");
  assert.equal(merged.status, "trialing");
  assert.equal(merged.trialEnd, "2027-01-01T00:00:00.000Z");
});

test("upsert row omits nulls and never sends user_id", () => {
  const row = billingCustomerUpsertRow(
    {
      email: "  ",
      stripeCustomerId: "cus_current",
      stripeSubscriptionId: null,
      status: "canceled",
      trialEnd: null,
    },
    "2026-10-01T00:00:00.000Z",
  );
  assert.deepEqual(row, {
    stripe_customer_id: "cus_current",
    status: "canceled",
    updated_at: "2026-10-01T00:00:00.000Z",
  });
  assert.equal("email" in row, false);
  assert.equal("stripe_subscription_id" in row, false);
  assert.equal("trial_end" in row, false);
  assert.equal("user_id" in row, false);

  const full = billingCustomerUpsertRow(
    customer({ email: "Crew@MaplePoint.example" }),
    "2026-10-01T00:00:00.000Z",
  );
  assert.equal(full.email, "crew@maplepoint.example");
  assert.equal(full.stripe_subscription_id, "sub_current");
  assert.equal(full.trial_end, "2026-12-01T00:00:00.000Z");
});
