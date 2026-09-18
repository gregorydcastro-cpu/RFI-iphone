import type { ProcoreConnectionView } from "@/lib/procoreStatus";

type Props = {
  view: ProcoreConnectionView;
  compact?: boolean;
};

export function ProcoreConnectCard({ view, compact = false }: Props) {
  if (!view.signedIn || view.role !== "puller") {
    if (compact) return null;
    if (view.role === "full") {
      return (
        <section className="border border-line bg-panel p-4">
          <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
            Procore
          </p>
          <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
            Full crew
          </h2>
          <p className="mt-2 text-sm text-muted">
            Full crew can markup and draft to the foreman. Connect Procore
            stays with pullers.
          </p>
        </section>
      );
    }
    return (
      <section className="border border-line bg-panel p-4">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Procore
        </p>
        <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
          View only
        </h2>
        <p className="mt-2 text-sm text-muted">
          Read-only viewers open packs without connecting Procore. Sign in
          as a puller to connect your own Procore account.
        </p>
      </section>
    );
  }

  if (view.connected) {
    return (
      <section className="border border-line bg-panel p-4">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Procore
        </p>
        <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
          Connected
        </h2>
        <p className="mt-2 text-sm text-muted">
          Signed in with your Procore account. Tokens are stored per user
          {view.email ? (
            <>
              {" "}
              (<span className="text-paper">{view.email}</span>)
            </>
          ) : null}
          . Company id is resolved per project from Procore — never hardcoded.
          End users do not use the developer portal.
        </p>
        <form action="/api/procore/disconnect" method="post" className="mt-4">
          <button
            type="submit"
            className="border border-line px-4 py-2 text-xs font-semibold tracking-wide text-muted uppercase hover:border-cta hover:text-secondary"
          >
            Disconnect Procore
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="border border-line bg-panel p-4">
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Procore
      </p>
      <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
        Connect Procore
      </h2>
      <p className="mt-2 text-sm text-muted">
        Pullers sign in with their own Procore credentials and approve this
        app. Tokens stay on the server, one row per user.
      </p>
      {!view.oauthConfigured ? (
        <p className="mt-2 text-sm text-cta">
          Set <code className="font-mono">PROCORE_CLIENT_ID</code> and{" "}
          <code className="font-mono">PROCORE_CLIENT_SECRET</code> on Vercel
          (server-only, not NEXT_PUBLIC) before connecting.
        </p>
      ) : null}
      {!view.storageConfigured ? (
        <p className="mt-2 text-sm text-cta">
          Token writes need{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>. The
          anon key cannot store other users’ tokens.
        </p>
      ) : null}
      <a
        href="/api/procore/connect"
        className="mt-4 inline-block bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Connect Procore
      </a>
    </section>
  );
}
