import { AppHeader } from "@/components/AppHeader";
import { TimeBoard } from "@/components/TimeBoard";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";
import { getTimeSnapshot } from "@/lib/timeStore";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Time — GC Field Log",
  description:
    "Maple Point crew punch-in with GPS geofence, plus foreman week view.",
};

export default async function TimePage() {
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  const snapshot = await getTimeSnapshot();
  if (!snapshot) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={Boolean(session)}
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={view.role === "puller" && view.connected}
      />
      <TimeBoard
        initial={snapshot}
        sessionEmail={session?.email ?? null}
        signedIn={Boolean(session)}
      />
    </div>
  );
}
