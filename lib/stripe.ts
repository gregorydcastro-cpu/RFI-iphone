/**
 * Server-only Stripe helpers. Secret keys stay on the server.
 * NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is Dashboard-only for this PR
 * (hosted Checkout does not need Stripe.js).
 */

import Stripe from "stripe";
import { readEnv } from "./env";

export const STRIPE_TRIAL_PERIOD_DAYS = 60;
export const DEFAULT_APP_ORIGIN = "https://gcfieldlog.com";

export type StripeCheckoutConfig = {
  secretKey: string;
  priceId: string;
  publishableKey?: string;
};

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string | undefined {
  return readEnv("STRIPE_SECRET_KEY");
}

export function getStripePriceId(): string | undefined {
  return readEnv("STRIPE_PRICE_ID");
}

export function getStripeWebhookSecret(): string | undefined {
  return readEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePublishableKey(): string | undefined {
  return readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

export function getStripeCheckoutConfig(): StripeCheckoutConfig | null {
  const secretKey = getStripeSecretKey();
  const priceId = getStripePriceId();
  if (!secretKey || !priceId) return null;
  return {
    secretKey,
    priceId,
    publishableKey: getStripePublishableKey(),
  };
}

export function isStripeCheckoutConfigured(): boolean {
  return getStripeCheckoutConfig() !== null;
}

/** Lazy so Next.js can import this module during builds without a secret. */
export function getStripe(): Stripe | null {
  const secretKey = getStripeSecretKey();
  if (!secretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

/**
 * success_url / cancel_url host. Production is always gcfieldlog.com.
 * Localhost and Vercel previews use the incoming request origin so
 * Checkout can return to the same host.
 */
export function checkoutReturnOrigin(request: Request): string {
  try {
    const url = new URL(request.url);
    const host = (
      request.headers.get("x-forwarded-host") ?? url.host
    )
      .split(",")[0]
      ?.trim();
    const proto = (
      request.headers.get("x-forwarded-proto") ??
      url.protocol.replace(/:$/, "")
    )
      .split(",")[0]
      ?.trim();
    if (!host || !proto) return DEFAULT_APP_ORIGIN;
    const hostname = host.toLowerCase();
    if (hostname === "gcfieldlog.com" || hostname === "www.gcfieldlog.com") {
      return DEFAULT_APP_ORIGIN;
    }
    if (hostname.includes("localhost") || hostname.endsWith(".vercel.app")) {
      return `${proto}://${host}`;
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_APP_ORIGIN;
}

export function asStripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "object" && typeof value.id === "string") {
    return value.id;
  }
  return null;
}

export function unixToIso(seconds: number | null | undefined): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}
