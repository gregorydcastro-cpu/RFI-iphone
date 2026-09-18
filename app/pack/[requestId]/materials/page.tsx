import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { OrderMaterialsForm } from "@/components/OrderMaterialsForm";
import { getFieldRole } from "@/lib/auth.server";
import { authorFromSessionEmail } from "@/lib/crew";
import { loadPack } from "@/lib/loadPack";
import { loadLiveRoomPack } from "@/lib/livePack";
import { readStubSession } from "@/lib/stubSession";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string }>;
};

/**
 * Order materials — grab/order draft to the foreman. Never a Procore PO.
 * Counts come from pack takeoff (`by_room`, else `by_type`).
 */
export default async function MaterialsPage({ params }: Props) {
  const { requestId } = await params;
  const role = await getFieldRole();
  const session = await readStubSession();
  const live = await loadLiveRoomPack({ requestId });
  if (!live) notFound();

  const author = authorFromSessionEmail(session?.email);
  let takeoff = live.pack.takeoff;
  if (!takeoff?.by_room?.length && !takeoff?.by_type?.length) {
    const demo = await loadPack("maple-point");
    if (
      demo?.takeoff &&
      (live.pack.project.slug === "maple-point" ||
        live.pack.project.name === "Maple Point Medical Office" ||
        requestId.startsWith("maple-point"))
    ) {
      takeoff = demo.takeoff;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn procoreLinked={role.procoreLinked} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Draft to foreman
        </p>
        <h1 className="font-display text-3xl tracking-wide text-paper uppercase">
          Order materials
        </h1>
        <p className="text-sm text-muted">
          Takeoff list for {live.pack.room.name}. Send a draft to Pat Nguyen —
          not a purchase order in Procore.
        </p>
        <OrderMaterialsForm
          pack={live.pack}
          requestId={requestId}
          takeoff={takeoff}
          authorName={author.name}
          authorEmail={author.email}
        />
        <Link href={`/pack/${requestId}`} className="text-sm text-accent underline">
          Back to pack
        </Link>
      </main>
    </div>
  );
}
