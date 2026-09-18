import { AppHeader } from "@/components/AppHeader";
import { ProcoreConnectCard } from "@/components/ProcoreConnectCard";
import { RequestPackForm } from "@/components/RequestPackForm";
import { getJob } from "@/lib/jobs";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { readStubSession } from "@/lib/stubSession";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ projectSlug: string }>;
};

export default async function JobPage({ params }: Props) {
  const { projectSlug } = await params;
  const job = getJob(projectSlug);
  if (!job) notFound();
  const view = await getProcoreConnectionView(await readStubSession());
  const canPull = view.role === "puller" && view.connected;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        signedIn
        role={view.role}
        procoreConnected={view.connected}
        procoreLinked={canPull}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-4 py-8 sm:px-6">
        {view.role === "puller" && !view.connected ? (
          <ProcoreConnectCard view={view} compact />
        ) : null}
        <RequestPackForm job={job} procoreLinked={canPull} />
      </main>
    </div>
  );
}
