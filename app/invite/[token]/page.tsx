import { notFound, redirect } from "next/navigation";
import { InviteChrome } from "@/components/InviteChrome";
import { InviteRedeemForm } from "@/components/InviteRedeemForm";
import { inviteAcceptPath, signInContinuePath } from "@/lib/authMessages";
import { previewInvite } from "@/lib/inviteStore";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readAppSession, supabaseSessionCookiePresent } from "@/lib/session.server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

/**
 * Invite landing. Validates the token, then redeem writes the baked role
 * onto the signed-in Supabase user. Single-use (`used_at`).
 */
export default async function InviteLandingPage({ params }: Props) {
  const { token } = await params;
  const session = await readAppSession();
  if (!session && (await supabaseSessionCookiePresent())) {
    redirect(signInContinuePath(inviteAcceptPath(token), true));
  }
  const preview = await previewInvite(token);
  if (preview.status === "not_found") notFound();
  const view = await getProcoreConnectionView(session);

  return (
    <InviteChrome view={view}>
      <InviteRedeemForm
        token={token}
        status={preview.status}
        role={preview.role}
        inviteeEmail={preview.inviteeEmail}
        expiresAt={preview.expiresAt}
        sessionEmail={session?.email ?? null}
        signedIn={Boolean(session)}
      />
    </InviteChrome>
  );
}
