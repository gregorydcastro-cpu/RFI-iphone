import { TimeSignInShell } from "@/components/TimeSignInShell";
import { readAppSession, supabaseSessionCookiePresent } from "@/lib/session.server";
import { TIME_CLOCK_SIGN_IN_COPY, TIME_SIGNED_OUT_TITLE } from "@/lib/timeGate";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: TIME_SIGNED_OUT_TITLE,
  description: TIME_CLOCK_SIGN_IN_COPY,
  robots: { index: false, follow: false },
};

export default async function TimePage() {
  const session = await readAppSession();
  if (session) redirect("/time/board");
  const sessionEnded = await supabaseSessionCookiePresent();
  return <TimeSignInShell sessionEnded={sessionEnded} />;
}
