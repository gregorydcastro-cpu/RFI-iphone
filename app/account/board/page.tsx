import { ACCOUNT_PAGE_TITLE } from "@/lib/accountGate";
import { readAppSession } from "@/lib/session.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: ACCOUNT_PAGE_TITLE,
  description: "Procore connection, share folders, and billing for this account.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ procore?: string; reason?: string }>;
};

/** Dashboard. Reachable from signed-in /account. Signed-out requests go back to the shell. */
export default async function AccountBoardPage({ searchParams }: Props) {
  const session = await readAppSession();
  if (!session) redirect("/account");
  const { SignedInAccountPage } = await import("../SignedInAccount");
  return <SignedInAccountPage session={session} searchParams={searchParams} />;
}
