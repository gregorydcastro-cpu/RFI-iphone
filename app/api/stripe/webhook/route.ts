import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  isBillingStorageConfigured,
  mapStripeSubscriptionStatus,
  upsertBillingCustomer,
  type BillingStatus,
} from "@/lib/billingCustomers";
import {
  asStripeId,
  getStripe,
  getStripeWebhookSecret,
  unixToIso,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.updated",
  "invoice.paid",
]);

/**
 * Stripe webhook. Verifies the signature, then upserts billing_customers.
 * Does not send email yet.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "billing_unconfigured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing_signature" },
      { status: 400 },
    );
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const type =
      typeof error === "object" && error && "type" in error
        ? String((error as { type?: unknown }).type)
        : error instanceof Error
          ? error.name
          : "unknown";
    console.error("[gcfieldlog] stripe webhook signature failed", { type });
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 400 },
    );
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    console.info("[gcfieldlog] stripe webhook ignored", { type: event.type });
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          stripe,
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          stripe,
          event.data.object as Stripe.Subscription,
        );
        break;
      case "invoice.paid":
        await handleInvoicePaid(stripe, event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (error) {
    const type =
      typeof error === "object" && error && "type" in error
        ? String((error as { type?: unknown }).type)
        : "handler_error";
    console.error("[gcfieldlog] stripe webhook handler failed", {
      type,
      event: event.type,
    });
    return NextResponse.json({ ok: false, error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: event.type });
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const customerId = asStripeId(session.customer);
  const subscriptionId = asStripeId(session.subscription);
  const email =
    session.customer_details?.email ?? session.customer_email ?? null;

  console.info("[gcfieldlog] stripe checkout.session.completed", {
    customerId,
    subscriptionId,
  });
  // TODO: send trial-started email (not in this PR)

  if (!customerId) return;
  const fromSub = subscriptionId
    ? await loadSubscriptionFields(stripe, subscriptionId)
    : null;
  await persistCustomer({
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    status: fromSub?.status ?? "trialing",
    trialEnd: fromSub?.trialEnd ?? null,
  });
}

async function handleSubscriptionUpdated(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = asStripeId(subscription.customer);
  console.info("[gcfieldlog] stripe customer.subscription.updated", {
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
  });
  // TODO: send status-change email (not in this PR)

  if (!customerId) return;
  const email = await loadCustomerEmail(stripe, customerId);
  await persistCustomer({
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: mapStripeSubscriptionStatus(subscription.status),
    trialEnd: unixToIso(subscription.trial_end),
  });
}

async function handleInvoicePaid(
  stripe: Stripe,
  invoice: Stripe.Invoice,
): Promise<void> {
  const customerId = asStripeId(invoice.customer);
  const subscriptionId = invoiceSubscriptionId(invoice);
  console.info("[gcfieldlog] stripe invoice.paid", {
    customerId,
    subscriptionId,
    invoiceId: invoice.id,
  });
  // TODO: send receipt email (not in this PR)

  if (!customerId) return;
  const fromSub = subscriptionId
    ? await loadSubscriptionFields(stripe, subscriptionId)
    : null;
  const email =
    invoice.customer_email ?? (await loadCustomerEmail(stripe, customerId));
  await persistCustomer({
    email,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId ?? fromSub?.subscriptionId ?? null,
    status: fromSub?.status ?? "active",
    trialEnd: fromSub?.trialEnd ?? null,
  });
}

async function persistCustomer(input: {
  email: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  status: BillingStatus;
  trialEnd: string | null;
}): Promise<void> {
  if (!isBillingStorageConfigured()) {
    console.error("[gcfieldlog] billing_customers storage unconfigured");
    throw new Error("storage_unconfigured");
  }
  const ok = await upsertBillingCustomer(input);
  if (!ok) {
    throw new Error("upsert_failed");
  }
}

async function loadSubscriptionFields(
  stripe: Stripe,
  subscriptionId: string,
): Promise<{
  subscriptionId: string;
  status: BillingStatus;
  trialEnd: string | null;
} | null> {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      subscriptionId: subscription.id,
      status: mapStripeSubscriptionStatus(subscription.status),
      trialEnd: unixToIso(subscription.trial_end),
    };
  } catch {
    console.error("[gcfieldlog] stripe subscription retrieve failed");
    return null;
  }
}

async function loadCustomerEmail(
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if ("deleted" in customer && customer.deleted) return null;
    return typeof customer.email === "string" ? customer.email : null;
  } catch {
    return null;
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = asStripeId(
    invoice.parent?.subscription_details?.subscription,
  );
  if (fromParent) return fromParent;
  const record = invoice as unknown as { subscription?: unknown };
  return asStripeId(
    record.subscription as string | { id: string } | null | undefined,
  );
}
