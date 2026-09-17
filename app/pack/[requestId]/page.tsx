import { RoomPackViewer } from "@/components/RoomPackViewer";
import { getJob } from "@/lib/jobs";
import { loadPack } from "@/lib/loadPack";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ job?: string; room?: string; accepted?: string }>;
};

/**
 * Primary room-pack route.
 * Unknown requestIds still fall back to the local Maple Point pack.
 * When the Procore webhook accepted the request, `accepted=1` shows a poll stub
 * without replacing that demo fallback.
 */
export default async function PackPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const query = await searchParams;
  const pack = await loadPack(requestId);
  const demoPack = pack ?? (await loadPack("maple-point"));
  if (!demoPack) notFound();

  const requestedJob = query.job ? getJob(query.job) : undefined;
  const webhookAccepted = query.accepted === "1";

  return (
    <RoomPackViewer
      pack={demoPack}
      requestId={requestId}
      requestedRoom={query.room}
      requestedJobName={requestedJob?.name}
      demoFallback={!pack}
      webhookAccepted={webhookAccepted}
    />
  );
}
