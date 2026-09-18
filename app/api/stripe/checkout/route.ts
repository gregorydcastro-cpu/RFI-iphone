import { NextResponse } from "next/server";
import {
  fetchBillingCustomerByEmail,
  isBillingStorageConfigured,
} from "@/lib/billingCustomers";
import {
  STRIPE_TRIAL_PERIOD_DAYS,
  checkoutReturnOrigin,
  getStripe,
  getStripeCheckoutConfig,
} from "@/lib/stripe";
import { readStubSession } from "@/lib/stubSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  email?: unknown;
};

function asEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.includes("@") ? email : null;
}

/**
 * Create a Stripe Checkout Session (subscription + 60-day trial).
 * Cards, Apple Pay, and PayPal come from Dashboard payment methods —
 * this route does not pass payment_method_types. Crypto/stablecoin is
 * not enabled here.
 */
export async function POST(request: Request) {
  const config = getStripeCheckoutConfig();
  const stripe = getStripe();
  if (!config || !stripe) {
    return NextResponse.json(
      { ok: false, error: "billing_unconfigured" },
      { status: 503 },
    );
  }

  let json: CheckoutBody = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      json = (await request.json()) as CheckoutBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON" },
        { status: 400 },
      );
    }
  }

  const session = await readStubSession();
  const email = asEmail(json.email) ?? session?.email ?? null;

  let existingCustomerId: string | null = null;
  if (email && isBillingStorageConfigured()) {
    const existing = await fetchBillingCustomerByEmail(email);
    existingCustomerId = existing?.stripeCustomerId ?? null;
  }

  const origin = checkoutReturnOrigin(request);

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: config.priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: STRIPE_TRIAL_PERIOD_DAYS,
        metadata: session?.userId ? { user_id: session.userId } : undefined,
      },
      payment_method_collection: "always",
      allow_promotion_codes: true,
      success_url: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?checkout=canceled`,
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : email
          ? { customer_email: email }
          : {}),
      ...(session?.userId ? { client_reference_id: session.userId } : {}),
      metadata: session?.userId ? { user_id: session.userId } : undefined,
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { ok: false, error: "checkout_url_missing" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, url: checkoutSession.url });
  } catch (error) {
    const type =
      typeof error === "object" && error && "type" in error
        ? String((error as { type?: unknown }).type)
        : "stripe_error";
    console.error("[gcfieldlog] stripe checkout session create failed", {
      type,
    });
    return NextResponse.json(
      { ok: false, error: "checkout_failed" },
      { status: 502 },
    );
  }
}
