import { ReadAloudButton } from "@/components/ReadAloudButton";
import { procoreReconnectHref } from "@/lib/procoreAuthHealth";
import {
  procoreErrorMessage,
  type ProcoreConnectionView,
} from "@/lib/procoreStatus";

type Props = {
  view: ProcoreConnectionView;
  compact?: boolean;
  returnPath?: string;
};

export function ProcoreConnectCard({
  view,
  compact = false,
  returnPath,
}: Props) {
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

  if (view.reconnectNeeded) {
    const spoken =
      "Procore needs a reconnect. Use the same Procore login. Saved packs stay available.";
    return (
      <section className="border border-tan/60 bg-panel p-4" role="status">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Procore
        </p>
        <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
          Reconnect Procore
        </h2>
        <p className="mt-2 text-sm text-paper">{spoken}</p>
        <a
          href={procoreReconnectHref(returnPath ?? "/account")}
          className="mt-4 inline-flex min-h-11 items-center bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
        >
          Reconnect Procore
        </a>
        <ReadAloudButton
          id="procore-reconnect"
          text={spoken}
          label="Hear this"
          className="mt-3"
        />
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
        {view.refreshDeferred ? (
          <p className="mt-2 text-sm text-paper">
            Procore did not answer a refresh. Saved packs stay available. Try
            the pull again in a moment.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-muted">
          {view.refreshDeferred
            ? "Tokens stay stored per user"
            : "Signed in with your Procore account. Tokens are stored per user"}
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
      {view.storageConfigured && !view.storageKeyValid ? (
        <p className="mt-2 text-sm text-cta">
          {view.storageKeyProblem ?? procoreErrorMessage("storage_key_invalid")}
        </p>
      ) : !view.storageConfigured ? (
        <p className="mt-2 text-sm text-cta">
          Token writes need{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>. The
          anon key cannot store other users’ tokens.
        </p>
      ) : null}
      {/* Full navigation to the Procore connect route handler. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/api/procore/connect"
        className="mt-4 inline-block bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Connect Procore
      </a>
    </section>
  );
}
