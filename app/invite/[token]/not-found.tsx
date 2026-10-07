import { InviteChrome } from "@/components/InviteChrome";
import { InviteRedeemForm } from "@/components/InviteRedeemForm";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

/**
 * Invalid invite token. Same blocked card as the landing page
 * (title, body, Sign in, Hear this) with HTTP 404.
 */
export default async function InviteNotFound() {
  const session = await readAppSession();
  const view = await getProcoreConnectionView(session);
  return (
    <InviteChrome view={view}>
      <InviteRedeemForm
        token=""
        status="not_found"
        role={null}
        inviteeEmail={null}
        expiresAt={null}
        sessionEmail={session?.email ?? null}
        signedIn={Boolean(session)}
      />
    </InviteChrome>
  );
}
