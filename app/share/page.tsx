import { AppHeader } from "@/components/AppHeader";
import { SharePortal } from "@/components/SharePortal";
import { SHARE_CATALOG } from "@/lib/shareCatalog";
import { listSharePortal } from "@/lib/shareStore";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Share — GC Field Log",
  description:
    "Create share folders, pin Maple Point disciplines or room packs, and refresh pinned sheets.",
};

export default async function SharePage() {
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  const canRefresh = view.role === "puller";
  const snapshot = session ? await listSharePortal(session.userId) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={view.role === "puller" && view.connected}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Share
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">
          Share folders
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pin full disciplines (electrical, lighting, architectural) or Maple
          Point room packs for the crew viewer portal. Demo data is fictional
          only.{" "}
          <Link href="/account" className="text-accent underline">
            Account
          </Link>{" "}
          still holds Procore + billing.
        </p>
        <div className="mt-6">
          <SharePortal
            signedIn={view.signedIn}
            canRefresh={canRefresh}
            roleLabel={
              view.role === "puller"
                ? view.connected
                  ? "puller · Procore connected"
                  : "puller · Refresh all (metadata)"
                : view.signedIn
                  ? "view only"
                  : "signed out"
            }
            catalog={SHARE_CATALOG}
            initialFolders={snapshot?.folders ?? []}
            initialStorage={snapshot?.storage ?? "memory"}
          />
        </div>
      </main>
    </div>
  );
}
