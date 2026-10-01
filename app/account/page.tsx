import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { InviteCrewCard } from "@/components/InviteCrewCard";
import { NotifyEmailForm } from "@/components/NotifyEmailForm";
import { ProcoreConnectCard } from "@/components/ProcoreConnectCard";
import { formatBillingUnconfigured } from "@/lib/billingMessages";
import { loadAccountNotifyEmail } from "@/lib/accountNotifyEmail";
import { canManageNotifyEmail } from "@/lib/accountRole";
import { canInviteCrew, fieldRoleLabel } from "@/lib/inviteRole";
import { signedOutGate } from "@/lib/authMessages";
import { getProcoreConnectionView, procoreErrorMessage } from "@/lib/procoreStatus";
import { readAppSession, supabaseSessionCookiePresent } from "@/lib/session.server";
import { stripeReadiness } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ procore?: string; reason?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const query = await searchParams;
  const session = await readAppSession();
  const sessionEnded = !session && (await supabaseSessionCookiePresent());
  const view = await getProcoreConnectionView(session);
  const signedOut = signedOutGate({
    next: "/account",
    sessionEnded,
    detail: "to open this account, then connect Procore if you pull packs.",
  });
  const notify = session && canManageNotifyEmail(session.role)
    ? await loadAccountNotifyEmail(session.userId)
    : null;
  const error =
    query.procore === "error" ? procoreErrorMessage(query.reason) : null;
  const billing = stripeReadiness();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Account
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">
          Procore connection
        </h1>
        {!view.signedIn ? (
          <div className="mt-4">
            <p className="text-base text-paper">
              {signedOut.lead}{" "}
              <Link href={signedOut.href} className="font-semibold text-accent underline">
                Sign in
              </Link>{" "}
              to open this account, then connect Procore if you pull packs.
            </p>
            <ReadAloudButton
              id="account-signed-out"
              text={signedOut.text}
              label="Hear this"
              className="mt-3"
            />
          </div>
        ) : (
          <dl className="mt-4 space-y-1 text-sm text-muted">
            <div>
              Email{" "}
              <span className="text-paper">{view.email}</span>
            </div>
            <div>
              Role{" "}
              <span className="text-paper">{fieldRoleLabel(view.role)}</span>
            </div>
            <div className="font-mono text-xs text-metal">{view.userId}</div>
          </dl>
        )}
        {query.procore === "connected" ? (
          <p className="mt-4 text-sm text-accent-2" role="status">
            Procore connected. Your tokens are stored separately from other
            users.
          </p>
        ) : null}
        {query.procore === "disconnected" ? (
          <p className="mt-4 text-sm text-accent-2" role="status">
            Procore disconnected for this user.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-cta" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 max-w-lg">
          <ProcoreConnectCard view={view} />
        </div>
        {notify ? (
          <div className="mt-8">
            <NotifyEmailForm
              initialEmail={notify.notify_email}
              storage={notify.storage}
            />
          </div>
        ) : view.signedIn ? (
          <p className="mt-8 max-w-lg text-sm text-muted">
            Sign in as a puller / foreman to set the revision bump notify
            email for the job you are running.
          </p>
        ) : null}
        {canInviteCrew(view.role) ? (
          <div className="mt-8">
            <InviteCrewCard canInvite />
          </div>
        ) : null}
        <section className="mt-8 max-w-lg border border-line bg-panel p-4">
          <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
            Share
          </p>
          <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
            Viewer portal folders
          </h2>
          <p className="mt-2 text-sm text-muted">
            Create share folders, pin electrical / lighting / architectural or
            Maple Point room packs, and run puller-gated Refresh all.
          </p>
          <Link
            href="/share"
            className="mt-4 inline-block bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
          >
            Open share folders
          </Link>
        </section>
        <section
          className="mt-8 max-w-lg border border-line bg-panel p-4"
          data-billing-checkout={billing.checkoutConfigured ? "true" : "false"}
          data-billing-webhook={billing.webhookConfigured ? "true" : "false"}
        >
          <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
            Billing
          </p>
          <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
            Subscription
          </h2>
          <p className="mt-2 text-sm text-muted">
            {billing.checkoutConfigured
              ? billing.webhookConfigured
                ? "60-day free trial on Stripe-hosted Checkout, then monthly. Cards, Apple Pay, and PayPal when those methods are on in the Dashboard."
                : "Checkout can open. STRIPE_WEBHOOK_SECRET is still unset on Vercel Production, so subscription updates wait until that name is set."
              : `Billing isn't live yet. Pricing shows the crew plan until Checkout opens. ${formatBillingUnconfigured(billing.missing)}`}
          </p>
          <Link
            href="/pricing"
            className="mt-4 inline-block bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
          >
            Go to pricing
          </Link>
        </section>
      </main>
    </div>
  );
}
