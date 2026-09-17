import { redirect } from "next/navigation";
import { makeRequestId } from "@/lib/jobs";

type Props = {
  params: Promise<{ projectSlug: string; room: string }>;
};

/**
 * Optional URL alias: `/jobs/[projectSlug]/rooms/[room]` → pack viewer.
 */
export default async function JobRoomAliasPage({ params }: Props) {
  const { projectSlug, room } = await params;
  const requestId = makeRequestId(projectSlug, room);
  redirect(`/pack/${requestId}?job=${projectSlug}&room=${room}`);
}
