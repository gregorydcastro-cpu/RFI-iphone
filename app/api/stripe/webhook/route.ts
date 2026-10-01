import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  fetchBillingCustomerByStripeCustomerId,
  isBillingStorageConfigured,
  mapStripeSubscriptionStatus,
  mergeBillingCustomer,
  upsertBillingCustomer,
  type BillingCustomer,
  type BillingStatus,
} from "@/lib/billingCustomers";
import {
  asStripeId,
  getStripe,
  getStripeWebhookSecret,
  missingStripeWebhookEnv,
  stripeSoftFailBody,
  unixToIso,
} from "@/lib/stripe";
import {
  checkoutSessionSubscriptionId,
  createStripeEventMemory,
  invoiceSubscriptionId,
  isHandledStripeWebhookEvent,
  shouldApplySubscriptionSnapshot,
  statusAfterCheckout,
  safeLogToken,
  statusAfterInvoicePaid,
  stripeWebhookHandlerCode,
} from "@/lib/stripeWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Best-effort dedupe for redelivery to this warm instance. Ids are recorded
 * only after a successful response. The upsert is what makes a second
 * delivery safe on another instance.
 */
const eventMemory = createStripeEventMemory();

/**
 * Stripe webhook. Verifies the signature against the raw body, then upserts
 * billing_customers. Does not send email yet.
 *
 * Runtime stays nodejs so `request.text()` is the exact payload Stripe
 * signed. Do not switch this route to the edge runtime.
 *
 * Dashboard endpoint URL (www, not apex — Stripe does not follow 308s):
 * https://www.gcfieldlog.com/api/stripe/webhook
 *
 * Events: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted, invoice.paid.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(stripeSoftFailBody(missingStripeWebhookEnv()), {
      status: 503,
    });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing_signature" },
      { status: 400 },
    );
  }

  // Raw body. Signature verification needs the exact bytes Stripe signed.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const type =
      typeof error === "object" && error && "type" in error
        ? safeLogToken((error as { type?: unknown }).type)
        : error instanceof Error
          ? safeLogToken(error.name)
          : "unknown";
    console.error("[gcfieldlog] stripe webhook signature failed", { type });
    return NextResponse.json(
      { ok: false, error: "invalid_signature" },
      { status: 400 },
    );
  }

  if (event.id && eventMemory.has(event.id)) {
    console.info("[gcfieldlog] stripe webhook duplicate", {
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json({
      ok: true,
      duplicate: true,
      type: event.type,
    });
  }

  if (!isHandledStripeWebhookEvent(event.type)) {
    console.info("[gcfieldlog] stripe webhook ignored", {
      eventId: event.id,
      eventType: event.type,
    });
    if (event.id) eventMemory.add(event.id);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          stripe,
          event.data.object as Stripe.Checkout.Session,
          event.id,
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionSnapshot(
          stripe,
          event.data.object as Stripe.Subscription,
          {
            ended: false,
            eventId: event.id,
            eventType: event.type,
          },
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionSnapshot(
          stripe,
          event.data.object as Stripe.Subscription,
          {
            ended: true,
            eventId: event.id,
            eventType: event.type,
          },
        );
        break;
      case "invoice.paid":
        await handleInvoicePaid(
          stripe,
          event.data.object as Stripe.Invoice,
          event.id,
        );
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[gcfieldlog] stripe webhook handler failed", {
      code: stripeWebhookHandlerCode(error),
      eventId: event.id,
      eventType: event.type,
    });
    return NextResponse.json(
      { ok: false, error: "handler_failed" },
      { status: 500 },
    );
  }

  if (event.id) eventMemory.add(event.id);
  return NextResponse.json({ ok: true, type: event.type });
}

function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, error: "method_not_allowed" },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export function GET() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export function HEAD() {
  return methodNotAllowed();
}

async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  eventId: string,
): Promise<void> {
  const customerId = asStripeId(session.customer);
  const subscriptionId = checkoutSessionSubscriptionId(session);
  const email =
    session.customer_details?.email ?? session.customer_email ?? null;

  console.info("[gcfieldlog] stripe checkout.session.completed", {
    eventId,
    customerId,
    subscriptionId,
  });
  // TODO: send trial-started email (not in this PR)

  if (!customerId) return;
  const existing = await fetchBillingCustomerByStripeCustomerId(customerId);
  const fromSub = subscriptionId
    ? await loadSubscriptionFields(stripe, subscriptionId)
    : null;
  await persistCustomer(
    mergeBillingCustomer(existing, {
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId ?? fromSub?.subscriptionId ?? null,
      status: statusAfterCheckout(existing, fromSub?.status ?? null),
      trialEnd: fromSub?.trialEnd ?? null,
    }),
  );
}

async function handleSubscriptionSnapshot(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  options: { ended: boolean; eventId: string; eventType: string },
): Promise<void> {
  const customerId = asStripeId(subscription.customer);
  const status: BillingStatus = options.ended
    ? "canceled"
    : mapStripeSubscriptionStatus(subscription.status);
  console.info("[gcfieldlog] stripe subscription snapshot", {
    eventId: options.eventId,
    eventType: options.eventType,
    customerId,
    subscriptionId: subscription.id,
    status,
  });
  // TODO: send status-change email (not in this PR)

  if (!customerId) return;
  const existing = await fetchBillingCustomerByStripeCustomerId(customerId);
  if (
    !shouldApplySubscriptionSnapshot({
      existingSubscriptionId: existing?.stripeSubscriptionId,
      incomingSubscriptionId: subscription.id,
      incomingStatus: status,
      ended: options.ended,
    })
  ) {
    console.info("[gcfieldlog] stripe subscription snapshot skipped", {
      eventId: options.eventId,
      eventType: options.eventType,
      reason: "newer_subscription_on_file",
    });
    return;
  }

  const email = await loadCustomerEmail(stripe, customerId);
  await persistCustomer(
    mergeBillingCustomer(existing, {
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      status,
      trialEnd: unixToIso(subscription.trial_end),
    }),
  );
}

async function handleInvoicePaid(
  stripe: Stripe,
  invoice: Stripe.Invoice,
  eventId: string,
): Promise<void> {
  const customerId = asStripeId(invoice.customer);
  const subscriptionId = invoiceSubscriptionId(invoice);
  console.info("[gcfieldlog] stripe invoice.paid", {
    eventId,
    customerId,
    subscriptionId,
    invoiceId: invoice.id,
  });
  // TODO: send receipt email (not in this PR)

  if (!customerId) return;
  const existing = await fetchBillingCustomerByStripeCustomerId(customerId);
  const fromSub = subscriptionId
    ? await loadSubscriptionFields(stripe, subscriptionId)
    : null;
  const email =
    invoice.customer_email ?? (await loadCustomerEmail(stripe, customerId));
  await persistCustomer(
    mergeBillingCustomer(existing, {
      email,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId ?? fromSub?.subscriptionId ?? null,
      status: statusAfterInvoicePaid({
        existing,
        subscriptionId,
        fromSubscription: fromSub?.status ?? null,
      }),
      trialEnd: fromSub?.trialEnd ?? null,
    }),
  );
}

async function persistCustomer(input: BillingCustomer): Promise<void> {
  if (!isBillingStorageConfigured()) {
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
