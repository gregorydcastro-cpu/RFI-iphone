import { RoomPackViewer } from "@/components/RoomPackViewer";
import { loadPack } from "@/lib/loadPack";
import { notFound } from "next/navigation";

export default async function HomePage() {
  const pack = await loadPack("maple-point");
  if (!pack) notFound();
  return <RoomPackViewer pack={pack} />;
}
