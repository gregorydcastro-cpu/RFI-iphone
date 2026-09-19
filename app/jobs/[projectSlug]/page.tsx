import { AppHeader } from "@/components/AppHeader";
import { ProcoreConnectCard } from "@/components/ProcoreConnectCard";
import { RequestPackForm } from "@/components/RequestPackForm";
import { getJob } from "@/lib/jobs";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { requireAppSession } from "@/lib/session.server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectSlug: string }>;
  searchParams: Promise<{ room?: string }>;
};

export default async function JobPage({ params, searchParams }: Props) {
  const { projectSlug } = await params;
  const query = await searchParams;
  const job = getJob(projectSlug);
  if (!job) notFound();
  const session = await requireAppSession(`/jobs/${projectSlug}`);
  const view = await getProcoreConnectionView(session);
  const canPull = view.role === "puller" && view.connected;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn={view.signedIn}
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={canPull}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-8 sm:px-6">
        {view.role === "puller" && !view.connected ? (
          <ProcoreConnectCard view={view} compact />
        ) : null}
        <RequestPackForm
          job={job}
          procoreLinked={canPull}
          initialRoom={query.room}
        />
      </main>
    </div>
  );
}
