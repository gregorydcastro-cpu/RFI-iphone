// FOR GREG'S REVIEW — draft, not legal advice

import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";
import { supportCopy } from "@/lib/legalCopy";
import { readAppSession } from "@/lib/session.server";

const copy = supportCopy();

export const metadata: Metadata = {
  title: `${copy.title} — GC Field Log`,
  description: copy.description,
};

export const dynamic = "force-dynamic";

/** Public. Signed-out visitors stay on this page. */
export default async function SupportPage() {
  const session = await readAppSession();
  return (
    <LegalDocument
      copy={copy}
      signedIn={Boolean(session)}
      role={session?.role ?? null}
    />
  );
}
