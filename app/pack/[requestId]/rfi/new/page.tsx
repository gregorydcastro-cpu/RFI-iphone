import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { GenerateRfiForm } from "@/components/GenerateRfiForm";
import { getFieldRole } from "@/lib/auth.server";
import { authorFromSessionEmail } from "@/lib/crew";
import { loadLiveRoomPack } from "@/lib/livePack";
import { readStubSession } from "@/lib/stubSession";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{
    sheet?: string;
    markup?: string;
    item?: string;
    subject?: string;
    question?: string;
    location?: string;
    kind?: string;
  }>;
};

/**
 * Generate RFI — draft packet to the foreman. Never a Procore submit.
 * Prefills job, room, and `?sheet=` pin from the pack. `?markup=` / `?item=`
 * come from one-tap Create RFI on a selected vector overlay.
 */
export default async function NewRfiPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const query = await searchParams;
  const role = await getFieldRole();
  const session = await readStubSession();
  if (role.role === "viewer") {
    redirect(`/pack/${requestId}`);
  }
  const live = await loadLiveRoomPack({ requestId });
  if (!live) notFound();

  const author = authorFromSessionEmail(session?.email);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn procoreLinked={role.procoreLinked} />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4 sm:p-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Draft to foreman
        </p>
        <h1 className="font-display text-3xl tracking-wide text-paper uppercase">
          Generate RFI
        </h1>
        <p className="text-sm text-muted">
          Journeyman draft for {live.pack.project.name}. Pat Nguyen files it.
          This is not a Procore RFI.
        </p>
        <GenerateRfiForm
          pack={live.pack}
          requestId={requestId}
          sheetQuery={query.sheet}
          markupQuery={query.markup}
          markupItemQuery={query.item}
          initialSubject={query.subject}
          initialQuestion={query.question}
          initialLocation={query.location}
          markupKindQuery={query.kind}
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
