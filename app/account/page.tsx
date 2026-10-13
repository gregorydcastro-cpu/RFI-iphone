import { AccountSignInShell } from "@/components/AccountSignInShell";
import { ACCOUNT_PAGE_TITLE, ACCOUNT_SIGN_IN_COPY } from "@/lib/accountGate";
import { readAppSession, supabaseSessionCookiePresent } from "@/lib/session.server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: ACCOUNT_PAGE_TITLE,
  description: ACCOUNT_SIGN_IN_COPY,
  robots: { index: false, follow: false },
};

/** Signed-out account. A real session is rewritten to the dashboard. */
export default async function AccountPage() {
  const session = await readAppSession();
  if (session) redirect("/account/board");
  const sessionEnded = await supabaseSessionCookiePresent();
  return <AccountSignInShell sessionEnded={sessionEnded} />;
}
