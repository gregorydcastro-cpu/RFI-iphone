import { cache } from "react";
import type { Metadata } from "next";
import { getFieldRole } from "@/lib/auth.server";
import { RoomPackViewer } from "@/components/RoomPackViewer";
import { getJob } from "@/lib/jobs";
import { loadLiveRoomPack } from "@/lib/livePack";
import { getProcoreConnectionView } from "@/lib/procoreStatus";
import { opensSheetsSection } from "@/lib/fieldNotFound";
import { packPageFound } from "@/lib/packPageFound";
import { packDocumentTitle, privatePackMetadata } from "@/lib/siteMetadata";
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

const readFieldRole = cache(getFieldRole);

const loadPackPage = cache(async function loadPackPage(
  requestId: string,
  job: string,
  room: string,
) {
  const requestedJob = job ? getJob(job) : undefined;
  const live = await loadLiveRoomPack({
    requestId,
    job: requestedJob,
    room: room || undefined,
  });
  return { requestedJob, live };
});

/**
 * Signed-out visitors keep the shell title. A signed-in pack uses the job name.
 * A missing id does not call notFound() here; the page still returns the 404 card.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { requestId } = await params;
  const query = await searchParams;
  const role = await readFieldRole();
  if (!role.session) return privatePackMetadata();
  const { requestedJob, live } = await loadPackPage(
    requestId,
    query.job ?? "",
    query.room ?? "",
  );
  if (!packPageFound({ requestId, live }) || !live) return privatePackMetadata();
  return privatePackMetadata(
    packDocumentTitle(live.pack.project.name || requestedJob?.name),
  );
}

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
  const role = await readFieldRole();
  const signedIn = Boolean(role.session);
  const procore = await getProcoreConnectionView(role.session);
  const { requestedJob, live } = await loadPackPage(
    requestId,
    query.job ?? "",
    query.room ?? "",
  );
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
