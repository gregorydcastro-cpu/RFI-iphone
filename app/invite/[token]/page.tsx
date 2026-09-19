import { AppHeader } from "@/components/AppHeader";
import { InviteRedeemForm } from "@/components/InviteRedeemForm";
import { previewInvite } from "@/lib/inviteStore";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

/**
 * Invite landing. Validates the token, then redeem sets the stub session
 * to the baked role. Single-use (`used_at`).
 */
export default async function InviteLandingPage({ params }: Props) {
  const { token } = await params;
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  const preview = await previewInvite(token);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <InviteRedeemForm
          token={token}
          status={preview.status}
          role={preview.role}
          inviteeEmail={preview.inviteeEmail}
          expiresAt={preview.expiresAt}
          sessionEmail={session?.email ?? null}
        />
      </main>
    </div>
  );
}
