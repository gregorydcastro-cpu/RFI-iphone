import { InviteBlockedCard } from "@/components/InviteRedeemForm";
import { InviteChrome } from "@/components/InviteChrome";
import { inviteBlockedAction, inviteLanding } from "@/lib/authMessages";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

/**
 * Invalid invite token. Same blocked card as the landing page
 * (title, body, Sign in, Hear this) with HTTP 404.
 * Copy is rendered on the server so the card text is in the HTML.
 */
export default async function InviteNotFound() {
  const session = await readAppSession();
  const view = await getProcoreConnectionView(session);
  const landing = inviteLanding({
    status: "not_found",
    signedIn: Boolean(session),
    sessionEmail: session?.email ?? null,
  });
  if (landing.kind !== "blocked") return null;
  const action = inviteBlockedAction(landing, "");

  return (
    <InviteChrome view={view}>
      <InviteBlockedCard
        title={landing.title}
        body={landing.body}
        actionHref={action.href}
        actionLabel={action.label}
      />
    </InviteChrome>
  );
}
