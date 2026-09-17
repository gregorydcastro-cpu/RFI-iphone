import { RoomPackViewer } from "@/components/RoomPackViewer";
import { loadPack } from "@/lib/loadPack";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ job?: string; room?: string }>;
};

/**
 * Primary room-pack route.
 * Unknown demo requestIds fall back to the local Maple Point pack.
 * Production will poll Drive `{project_slug}/{request_id}.json` (v1).
 */
export default async function PackPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const query = await searchParams;
  const pack = await loadPack(requestId);
  const demoPack = pack ?? (await loadPack("maple-point"));
  if (!demoPack) notFound();

  return (
    <RoomPackViewer
      pack={demoPack}
      requestId={requestId}
      requestedRoom={query.room}
      demoFallback={!pack}
    />
  );
}
