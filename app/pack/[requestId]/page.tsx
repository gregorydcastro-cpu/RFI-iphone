import { getFieldRole } from "@/lib/auth.server";
import { RoomPackViewer } from "@/components/RoomPackViewer";
import { getJob } from "@/lib/jobs";
import { loadLiveRoomPack } from "@/lib/livePack";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { opensSheetsSection } from "@/lib/fieldNotFound";
import { packPageFound } from "@/lib/packPageFound";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{
    job?: string;
    room?: string;
    section?: string | string[];
  }>;
};

/**
 * Primary room-pack route (website live view).
 * Always re-reads the latest `public.room_packs` row (no-store).
 * Pullers additionally POST a refresh that tries Procore REST first,
 * then the bot. Demo job ids still open the local Maple Point pack.
 * Any other unknown id renders the Pack not found card.
 */
export default async function PackPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const query = await searchParams;
  const role = await getFieldRole();
  const signedIn = Boolean(role.session);
  const procore = await getProcoreConnectionView(role.session);
  const requestedJob = query.job ? getJob(query.job) : undefined;
  const live = await loadLiveRoomPack({
    requestId,
    job: requestedJob,
    room: query.room,
  });
  if (!packPageFound({ requestId, live }) || !live) notFound();

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
      signedIn={signedIn}
      sessionEnded={role.sessionEnded}
      procoreLinked={signedIn && role.procoreLinked}
      procoreReconnect={procore.reconnectNeeded}
      role={signedIn ? role.role : null}
      readOnly={!signedIn || role.role === "viewer"}
      openSheets={opensSheetsSection(query.section)}
    />
  );
}
