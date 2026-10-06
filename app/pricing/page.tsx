import { AppHeader } from "@/components/AppHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SubscribeCta } from "@/components/SubscribeCta";
import { BILLING_OPENS_SOON } from "@/lib/billingPublicCopy";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { publicPageMetadata } from "@/lib/siteMetadata";
import {
  logStripeEnvGap,
  STRIPE_TRIAL_PERIOD_DAYS,
  stripeReadiness,
} from "@/lib/stripe";
import { readAppSession } from "@/lib/session.server";

export const metadata = publicPageMetadata("/pricing");

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function PricingPage({ searchParams }: Props) {
  const query = await searchParams;
  const session = await readAppSession();
  const view = await getProcoreConnectionView(session);
  const readiness = stripeReadiness();
  const configured = readiness.checkoutConfigured;
  if (readiness.missing.length > 0) {
    logStripeEnvGap("pricing", readiness.missing);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
        procoreReconnect={view.reconnectNeeded}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Billing
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">
          Crew subscription
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          {configured ? (
            <>
              {STRIPE_TRIAL_PERIOD_DAYS}-day free trial, then the monthly price
              set in Stripe. Checkout always collects a payment method (card,
              Apple Pay, or PayPal when those are enabled in the Dashboard) so
              the trial converts automatically. Promotion codes are accepted on
              Checkout.
            </>
          ) : (
            BILLING_OPENS_SOON
          )}
        </p>
        {query.checkout === "success" ? (
          <p className="mt-4 text-sm text-accent-2" role="status">
            Checkout complete. Your trial is active while Stripe confirms the
            subscription.
          </p>
        ) : null}
        {query.checkout === "canceled" ? (
          <p className="mt-4 text-sm text-muted" role="status">
            Checkout canceled. No charge was made.
          </p>
        ) : null}
        <section
          className="mt-8 border border-line bg-panel p-6"
          data-billing-checkout={configured ? "true" : "false"}
          data-billing-webhook={readiness.webhookConfigured ? "true" : "false"}
        >
          <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
            Monthly
          </p>
          <h2 className="font-display mt-1 text-2xl tracking-wide text-paper">
            GC Field Log
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
            <li>{STRIPE_TRIAL_PERIOD_DAYS} days free, then paid monthly</li>
            <li>Payment method on file — trial auto-converts</li>
            <li>Hosted Checkout: cards, Apple Pay, PayPal</li>
          </ul>
          <SubscribeCta
            configured={configured}
            defaultEmail={session?.email ?? ""}
          />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
