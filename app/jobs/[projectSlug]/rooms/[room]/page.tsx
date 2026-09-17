import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ projectSlug: string; room: string }>;
};

/**
 * Optional URL alias stub.
 * TODO: resolve project slug + room to a pack `requestId` instead of a
 * hardcoded Maple Point demo redirect.
 */
export default async function JobRoomAliasPage({ params }: Props) {
  const { projectSlug } = await params;
  if (projectSlug === "maple-point") {
    redirect("/pack/maple-point");
  }
  redirect("/");
}
