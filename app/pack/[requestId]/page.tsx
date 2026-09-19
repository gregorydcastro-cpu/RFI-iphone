import { getFieldRole } from "@/lib/auth.server";
import { RoomPackViewer } from "@/components/RoomPackViewer";
import { getJob } from "@/lib/jobs";
import { loadLiveRoomPack } from "@/lib/livePack";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{
    job?: string;
    room?: string;
  }>;
};

/**
 * Primary room-pack route (website live view).
 * Always re-reads the latest `public.room_packs` row (no-store).
 * Pullers additionally POST a refresh that tries Procore REST first,
 * then the bot. Unknown IDs still fall back to the local Maple Point
 * pack when live data is missing.
 */
export default async function PackPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const query = await searchParams;
  const role = await getFieldRole();
  const requestedJob = query.job ? getJob(query.job) : undefined;
  const live = await loadLiveRoomPack({
    requestId,
    job: requestedJob,
    room: query.room,
  });
  if (!live) notFound();

  return (
    <RoomPackViewer
      pack={live.pack}
      requestId={requestId}
      requestedRoom={query.room}
      requestedJobName={requestedJob?.name}
      projectSlug={requestedJob?.slug}
      demoFallback={live.demoFallback}
      supabaseConfigured={live.supabaseConfigured}
      source={live.source}
      pull={live.pull}
      procoreLinked={role.procoreLinked}
      role={role.role}
      readOnly={role.role === "viewer"}
    />
  );
}
