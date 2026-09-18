import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProcoreConnectCard } from "@/components/ProcoreConnectCard";
import { VoiceCommandBar } from "@/components/VoiceCommandBar";
import { DEMO_JOBS } from "@/lib/jobs";
import { getProcoreConnectionView, procoreErrorMessage } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ procore?: string; reason?: string }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const query = await searchParams;
  const session = await readStubSession();
  const view = await getProcoreConnectionView(session);
  const error = query.procore === "error" ? procoreErrorMessage(query.reason) : null;
  const canPull = view.role === "puller" && view.connected;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={canPull}
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Select a job
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">
          Field jobs
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Fictional demo jobs only. Pick a job, then {canPull ? "pull" : "open"} a
          room pack.
          {view.role === "puller"
            ? view.connected
              ? " Procore is connected for this puller."
              : " Pullers must Connect Procore to pull with their own account."
            : " This session is view only — it cannot trigger a Procore pull."}
        </p>
        {query.procore === "connected" ? (
          <p className="mt-4 text-sm text-accent-2" role="status">
            Procore connected. Tokens are stored for this user only.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-cta" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 max-w-lg space-y-4">
          <ProcoreConnectCard view={view} compact />
          <VoiceCommandBar
            mode="jobs"
            jobs={DEMO_JOBS}
            procoreLinked={canPull}
          />
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {DEMO_JOBS.map((job) => (
            <li key={job.slug}>
              <Link
                href={`/jobs/${job.slug}`}
                className="block border border-line bg-panel p-4 transition hover:border-accent"
              >
                <p className="font-display text-lg tracking-wide text-paper">
                  {job.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {job.city} · {job.phase}
                </p>
                <p className="mt-3 font-mono text-xs text-metal">{job.roomsHint}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
