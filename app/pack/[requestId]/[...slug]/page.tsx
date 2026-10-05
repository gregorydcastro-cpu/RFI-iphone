import { loadLiveRoomPack } from "@/lib/livePack";
import { packSubpathDecision, queryToSearchParams } from "@/lib/fieldNotFound";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Props = {
  params: Promise<{ requestId: string; slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Unknown paths under a pack (`/sheets`, typos, old links).
 * Real routes (`/materials`, `/rfi/new`) stay on their own pages.
 * A pack that does not resolve uses the plain not-found card.
 */
export default async function PackUnknownSubpath({ params, searchParams }: Props) {
  const { requestId, slug } = await params;
  const query = await searchParams;
  const live = await loadLiveRoomPack({ requestId });
  const decision = packSubpathDecision({
    packId: requestId,
    slug,
    packFound: Boolean(live),
    search: queryToSearchParams(query),
  });
  if (decision.type === "not-found") notFound();
  redirect(decision.href);
}
