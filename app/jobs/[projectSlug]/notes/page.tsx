import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { FieldFailureCard } from "@/components/FieldFailureCard";
import { FieldNoteFeed } from "@/components/FieldNoteFeed";
import { canWriteFieldLog } from "@/lib/invites";
import { isFieldNoteJob } from "@/lib/fieldNotes";
import { listFieldNotes } from "@/lib/fieldNotesStore";
import { getJob } from "@/lib/jobs";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { requireAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectSlug: string }>;
};

export default async function JobNotesPage({ params }: Props) {
  const { projectSlug } = await params;
  if (!isFieldNoteJob(projectSlug)) notFound();
  const job = getJob(projectSlug);
  if (!job) notFound();
  const next = `/jobs/${projectSlug}/notes`;
  const session = await requireAppSession(next);
  const view = await getProcoreConnectionView(session);
  const listed = await listFieldNotes(projectSlug);
  const canPull = view.role === "puller" && view.connected;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={canPull}
        procoreReconnect={view.reconnectNeeded}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <div>
          <Link
            href={`/jobs/${job.slug}`}
            className="text-sm font-semibold tracking-wide text-accent uppercase"
          >
            {job.name}
          </Link>
          <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">Notes</h1>
          <p className="mt-2 text-base text-tan">
            One list. Safety stays on top.
          </p>
        </div>
        {listed.ok ? (
          <FieldNoteFeed
            jobSlug={job.slug}
            jobName={job.name}
            notes={listed.notes}
            canWrite={canWriteFieldLog(view.role)}
          />
        ) : (
          <FieldFailureCard
            title="Notes did not load"
            message={listed.error}
            speak={`Notes did not load. ${listed.error}`}
            speakId="field-notes-load"
          />
        )}
      </main>
    </div>
  );
}
