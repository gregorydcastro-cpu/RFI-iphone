import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { InviteCreateForm } from "@/components/InviteCreateForm";
import { canMintInvites } from "@/lib/invites";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

/**
 * Minimal mint UI. Field Log owns the polished Invite button + picker.
 * This page is enough for a working PR.
 */
export default async function InviteCreatePage() {
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  const canMint = canMintInvites(view.role);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        {!view.signedIn ? (
          <p className="text-sm text-muted">
            <Link href="/?next=/invite" className="text-accent underline">
              Sign in
            </Link>{" "}
            as a puller / GC / foreman to create an invite link.
          </p>
        ) : !canMint ? (
          <p className="text-sm text-muted">
            View-only sessions cannot invite. Ask the GC or foreman for a
            full-crew invite, or sign in as a puller.
          </p>
        ) : (
          <InviteCreateForm />
        )}
      </main>
    </div>
  );
}
