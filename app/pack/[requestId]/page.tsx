import { RoomPackViewer } from "@/components/RoomPackViewer";
import {
  getJob,
  jobFromRequestId,
  roomFromRequestId,
} from "@/lib/jobs";
import { refreshLiveRoomPack, loadLiveRoomPack } from "@/lib/livePack";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{
    job?: string;
    room?: string;
    accepted?: string;
    poll?: string;
  }>;
};

/**
 * Website live pack view. Always re-pulls via the Procore webhook when
 * those env keys are set — local JSON is not the live source of truth.
 */
export default async function PackPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const query = await searchParams;
  const job =
    (query.job ? getJob(query.job) : undefined) ?? jobFromRequestId(requestId);
  const room =
    query.room ?? (job ? roomFromRequestId(requestId, job) : undefined);

  const live = job
    ? await refreshLiveRoomPack({
        requestId,
        job,
        room: room ?? "room",
      })
    : await loadLiveRoomPack({ requestId, room });

  if (!live) notFound();

  return (
    <RoomPackViewer
      pack={live.pack}
      requestId={requestId}
      requestedRoom={query.room ?? room}
      requestedJobName={job?.name}
      projectSlug={job?.slug}
      demoFallback={live.demoFallback}
      liveConfigured={live.liveConfigured}
      source={live.source}
    />
  );
}
