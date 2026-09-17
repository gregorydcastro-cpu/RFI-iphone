import { AppHeader } from "@/components/AppHeader";
import { RequestPackForm } from "@/components/RequestPackForm";
import { getJob } from "@/lib/jobs";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ projectSlug: string }>;
};

export default async function JobPage({ params }: Props) {
  const { projectSlug } = await params;
  const job = getJob(projectSlug);
  if (!job) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        <RequestPackForm job={job} />
      </main>
    </div>
  );
}
