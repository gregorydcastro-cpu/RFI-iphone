import { readAppSession } from "@/lib/session.server";
import { TIME_CLOCK_SIGN_IN_COPY, TIME_SIGNED_OUT_TITLE } from "@/lib/timeGate";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const session = await readAppSession();
  if (!session) {
    return {
      title: TIME_SIGNED_OUT_TITLE,
      description: TIME_CLOCK_SIGN_IN_COPY,
      robots: { index: false, follow: false },
    };
  }
  return {
    title: "Time — GC Field Log",
    description:
      "Maple Point crew punch-in with GPS geofence, plus foreman week view.",
  };
}

/** Clock UI. Reachable from signed-in /time. Signed-out requests go back to the shell. */
export default async function TimeBoardPage() {
  const session = await readAppSession();
  if (!session) redirect("/time");
  const { SignedInTimePage } = await import("../SignedInTime");
  return <SignedInTimePage session={session} />;
}
