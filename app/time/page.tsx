import { TimeSignInShell } from "@/components/TimeSignInShell";
import { readAppSession, supabaseSessionCookiePresent } from "@/lib/session.server";
import { TIME_CLOCK_SIGN_IN_COPY, TIME_SIGNED_OUT_TITLE } from "@/lib/timeGate";
import type { Metadata } from "next";

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

export default async function TimePage() {
  const session = await readAppSession();
  if (!session) {
    const sessionEnded = await supabaseSessionCookiePresent();
    return <TimeSignInShell sessionEnded={sessionEnded} />;
  }

  const { SignedInTimePage } = await import("./SignedInTime");
  return <SignedInTimePage session={session} />;
}
