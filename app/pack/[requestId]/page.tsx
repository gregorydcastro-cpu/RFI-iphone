import { RoomPackViewer } from "@/components/RoomPackViewer";
import { loadPack } from "@/lib/loadPack";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ requestId: string }>;
};

/**
 * Primary room-pack route.
 * TODO: optional alias `/jobs/[projectSlug]/rooms/[room]` can resolve a
 * project slug + room number to this same `requestId` viewer.
 */
export default async function PackPage({ params }: Props) {
  const { requestId } = await params;
  const pack = await loadPack(requestId);
  if (!pack) notFound();
  return <RoomPackViewer pack={pack} />;
}
