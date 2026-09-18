import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getFieldRole } from "@/lib/auth.server";
import { DEMO_JOBS } from "@/lib/jobs";

export default async function JobsPage() {
  const role = await getFieldRole();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn procoreLinked={role.procoreLinked} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Select a job
        </p>
        <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">
          Field jobs
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Fictional demo jobs only. Pick a job, then{" "}
          {role.procoreLinked ? "pull" : "open"} a room pack.
          {!role.procoreLinked
            ? " This session is view only — it cannot trigger a Procore pull."
            : " Linked Procore account can pull a fresh pack."}
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
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
