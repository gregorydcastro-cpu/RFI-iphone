import { AppHeader } from "@/components/AppHeader";
import { TimeBoard } from "@/components/TimeBoard";
import type { AppSession } from "@/lib/session";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { getTimeSnapshot } from "@/lib/timeStore";
import { notFound } from "next/navigation";

/** Punch clock for a signed-in session. Roster loads here, after auth. */
export async function SignedInTimePage({ session }: { session: AppSession }) {
  const view = await getProcoreConnectionView(session);
  const snapshot = await getTimeSnapshot();
  if (!snapshot) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={view.role === "puller" && view.connected}
        procoreReconnect={view.reconnectNeeded}
      />
      <TimeBoard
        initial={snapshot}
        sessionEmail={session.email}
        signedIn
        sessionEnded={false}
      />
    </div>
  );
}
