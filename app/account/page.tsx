import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProcoreConnectCard } from "@/components/ProcoreConnectCard";
import { getProcoreConnectionView, procoreErrorMessage } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ procore?: string; reason?: string }>;
};

export default async function AccountPage({ searchParams }: Props) {
  const query = await searchParams;
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  const error =
    query.procore === "error" ? procoreErrorMessage(query.reason) : null;

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
          <p className="mt-4 text-sm text-muted">
            <Link href="/" className="text-accent underline">
              Sign in
            </Link>{" "}
            first (stub session), then connect Procore if you pull packs.
          </p>
        ) : (
          <dl className="mt-4 space-y-1 text-sm text-muted">
            <div>
              Email{" "}
              <span className="text-paper">{view.email}</span>
            </div>
            <div>
              Role{" "}
              <span className="text-paper">
                {view.role === "puller" ? "puller" : "view only"}
              </span>
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
        <section className="mt-8 max-w-lg border border-line bg-panel p-4">
          <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
            Billing
          </p>
          <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
            Subscription
          </h2>
          <p className="mt-2 text-sm text-muted">
            60-day free trial on Stripe-hosted Checkout, then monthly. Cards,
            Apple Pay, and PayPal when those methods are on in the Dashboard.
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
