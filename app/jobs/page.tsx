import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProcoreConnectCard } from "@/components/ProcoreConnectCard";
import { VoiceCommandBar } from "@/components/VoiceCommandBar";
import { DEMO_JOBS } from "@/lib/jobs";
import { TIME_JOB_SLUG } from "@/lib/time";
import { getProcoreConnectionView, procoreErrorMessage } from "@/lib/procoreStatus";
import { requireAppSession } from "@/lib/session.server";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ procore?: string; reason?: string }>;
};

export default async function JobsPage({ searchParams }: Props) {
  const query = await searchParams;
  const session = await requireAppSession("/jobs");
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
        <div className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
          <Link
            href="/time"
            className="border-l-4 border-l-cta border-y border-r border-line bg-panel p-4 hover:border-cta"
          >
            <p className="text-xs font-semibold tracking-wide text-accent uppercase">
              On site
            </p>
            <p className="font-display mt-1 text-2xl tracking-wide text-paper">
              Punch in
            </p>
            <p className="mt-1 text-base text-muted">
              Punch in or out for Maple Point.
            </p>
          </Link>
          <a
            href="#jobs"
            className="border border-line bg-panel p-4 hover:border-accent"
          >
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">
              Then
            </p>
            <p className="font-display mt-1 text-2xl tracking-wide text-paper">
              Open a job
            </p>
            <p className="mt-1 text-base text-muted">
              Pick a job below for the room pack.
            </p>
          </a>
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Fictional demo jobs only.
          {view.role === "puller"
            ? view.connected
              ? " Procore is connected for this puller."
              : " Pullers must Connect Procore to pull with their own account."
            : view.role === "full"
              ? " Full crew can open packs. Pull stays with a connected puller."
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
        <ul id="jobs" className="mt-8 grid scroll-mt-4 grid-cols-1 gap-4 sm:grid-cols-2">
          {DEMO_JOBS.map((job) => (
            <li key={job.slug} className="flex flex-col border border-line bg-panel">
              <Link
                href={`/jobs/${job.slug}`}
                className="block flex-1 p-4 transition hover:border-accent"
              >
                <p className="font-display text-lg tracking-wide text-paper">
                  {job.name}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {job.city} · {job.phase}
                </p>
                <p className="mt-3 font-mono text-xs text-metal">{job.roomsHint}</p>
                <p className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold tracking-wide text-paper uppercase">
                  Open job
                </p>
              </Link>
              {job.slug === TIME_JOB_SLUG ? (
                <Link
                  href="/time"
                  className="inline-flex min-h-12 items-center border-t border-line px-4 text-sm font-semibold tracking-wide text-accent uppercase hover:text-cta"
                >
                  Punch in
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
