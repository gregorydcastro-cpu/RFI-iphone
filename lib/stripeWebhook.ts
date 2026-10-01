/**
 * Pure Stripe webhook helpers. Payloads are parsed defensively because
 * Dashboard endpoints keep their own API version: pre-basil invoices put the
 * subscription id on `invoice.subscription`, basil and later put it on
 * `invoice.parent.subscription_details.subscription`. Checkout Session still
 * exposes `subscription` as a string or an expanded object.
 *
 * No secret values. Event ids and safe error codes only.
 */

import type { BillingCustomer, BillingStatus } from "./billingCustomers.ts";
import { asStripeId } from "./stripe.ts";


export const STRIPE_HANDLED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
] as const;

export type StripeHandledWebhookEvent =
  (typeof STRIPE_HANDLED_WEBHOOK_EVENTS)[number];

const SAFE_HANDLER_CODES = new Set([
  "storage_unconfigured",
  "upsert_failed",
  "lookup_failed",
]);

const SAFE_ERROR_TYPE = /^[A-Za-z0-9_]+$/;

export function isHandledStripeWebhookEvent(
  type: string,
): type is StripeHandledWebhookEvent {
  return (STRIPE_HANDLED_WEBHOOK_EVENTS as readonly string[]).includes(type);
}

/**
 * Same-instance dedupe for Stripe redelivery. Record an id only after a 2xx
 * decision. A failed handler must stay out of the set so Stripe's retry runs.
 * Cross-instance safety is the billing_customers upsert, not this buffer.
 */
export type StripeEventMemory = {
  has(eventId: string): boolean;
  add(eventId: string): void;
};

export function createStripeEventMemory(limit = 200): StripeEventMemory {
  const order: string[] = [];
  const seen = new Set<string>();
  return {
    has(eventId: string) {
      return eventId.length > 0 && seen.has(eventId);
    },
    add(eventId: string) {
      if (!eventId || seen.has(eventId)) return;
      seen.add(eventId);
      order.push(eventId);
      while (order.length > limit) {
        const removed = order.shift();
        if (removed) seen.delete(removed);
      }
    },
  };
}

/**
 * A cancel or delete for a subscription id that is no longer the row's
 * current subscription must not clobber a newer subscription.
 */
export function shouldApplySubscriptionSnapshot(input: {
  existingSubscriptionId: string | null | undefined;
  incomingSubscriptionId: string | null | undefined;
  incomingStatus: BillingStatus;
  ended: boolean;
}): boolean {
  const existing = input.existingSubscriptionId?.trim() || null;
  const incoming = input.incomingSubscriptionId?.trim() || null;
  if (!existing || !incoming || existing === incoming) return true;
  // Another subscription is already stored. Only a live replacement
  // (trialing or active) may take over. A cancel, delete, or past_due
  // for the previous subscription must not clobber the current one.
  if (input.ended) return false;
  return input.incomingStatus === "trialing" || input.incomingStatus === "active";
}

/** Prefer the live subscription. If retrieve failed, keep the stored status. */
export function statusAfterCheckout(
  existing: BillingCustomer | null,
  fromSubscription: BillingStatus | null,
): BillingStatus {
  if (fromSubscription) return fromSubscription;
  return existing?.status ?? "trialing";
}

/**
 * A paid invoice should not force `active` over `trialing` when the
 * subscription retrieve failed — trial invoices are paid at $0.
 * `past_due` and `canceled` still move to active: a payment landed.
 */
export function statusAfterInvoicePaid(input: {
  existing: BillingCustomer | null;
  subscriptionId: string | null;
  fromSubscription: BillingStatus | null;
}): BillingStatus {
  if (input.fromSubscription) return input.fromSubscription;
  const existing = input.existing;
  if (!existing) return "active";
  const sameSubscription =
    !input.subscriptionId ||
    !existing.stripeSubscriptionId ||
    existing.stripeSubscriptionId === input.subscriptionId;
  if (!sameSubscription) return "active";
  if (existing.status === "trialing") return "trialing";
  if (existing.status === "past_due" || existing.status === "canceled") {
    return "active";
  }
  return existing.status;
}

/** Identifier safe to print. Anything else becomes `unknown` so values cannot leak. */
export function safeLogToken(value: unknown): string {
  if (typeof value !== "string" || !SAFE_ERROR_TYPE.test(value)) return "unknown";
  if (looksLikeSecret(value)) return "unknown";
  return value;
}

function looksLikeSecret(value: string): boolean {
  const lower = value.toLowerCase();
  if (lower.includes("whsec_")) return true;
  if (lower.includes("service_role")) return true;
  if (lower.startsWith("eyj")) return true;
  const parts = lower.split("_");
  if (parts.length < 3) return false;
  const kind = parts[0];
  const mode = parts[1];
  const secretKind = kind === "sk" || kind === "pk" || kind === "rk";
  const secretMode = mode === "live" || mode === "test";
  return secretKind && secretMode;
}

/** Log code only. Unknown messages stay `handler_error` so secrets cannot leak. */
export function stripeWebhookHandlerCode(error: unknown): string {
  if (error instanceof Error && SAFE_HANDLER_CODES.has(error.message)) {
    return error.message;
  }
  if (error && typeof error === "object" && "type" in error) {
    const type = safeLogToken((error as { type?: unknown }).type);
    if (type !== "unknown") return type;
  }
  return "handler_error";
}

export function checkoutSessionSubscriptionId(session: unknown): string | null {
  const record = asRecord(session);
  if (!record) return null;
  return idFrom(record.subscription);
}

/**
 * Subscription id from an Invoice payload across API versions.
 * Order: current parent, legacy top-level, then invoice line parents.
 */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  const record = asRecord(invoice);
  if (!record) return null;

  const parent = asRecord(record.parent);
  const details = asRecord(parent?.subscription_details);
  const fromParent = idFrom(details?.subscription);
  if (fromParent) return fromParent;

  const legacy = idFrom(record.subscription);
  if (legacy) return legacy;

  const lines = asRecord(record.lines);
  const data = lines?.data;
  if (!Array.isArray(data)) return null;
  for (const line of data) {
    const id = lineSubscriptionId(line);
    if (id) return id;
  }
  return null;
}

function lineSubscriptionId(line: unknown): string | null {
  const record = asRecord(line);
  if (!record) return null;
  const parent = asRecord(record.parent);
  const itemDetails = asRecord(parent?.subscription_item_details);
  const fromItem = idFrom(itemDetails?.subscription);
  if (fromItem) return fromItem;
  const invoiceItem = asRecord(parent?.invoice_item_details);
  const fromInvoiceItem = idFrom(invoiceItem?.subscription);
  if (fromInvoiceItem) return fromInvoiceItem;
  return idFrom(record.subscription);
}

function idFrom(value: unknown): string | null {
  if (typeof value === "string" || value == null) {
    return asStripeId(value as string | null | undefined);
  }
  if (typeof value === "object" && !Array.isArray(value) && "id" in value) {
    return asStripeId(value as { id: string });
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
