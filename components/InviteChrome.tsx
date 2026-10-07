import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import type { ProcoreConnectionView } from "@/lib/procoreStatus";

/** Shared invite page shell so the not-found card matches the landing page. */
export function InviteChrome({
  view,
  children,
}: {
  view: Pick<
    ProcoreConnectionView,
    "signedIn" | "role" | "connected" | "reconnectNeeded"
  >;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
        procoreReconnect={view.reconnectNeeded}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
