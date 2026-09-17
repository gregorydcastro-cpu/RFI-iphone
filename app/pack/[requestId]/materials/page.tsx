import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

type Props = {
  params: Promise<{ requestId: string }>;
};

/** Future deep-link: `/pack/[requestId]/materials` — empty stub for MVP. */
export default async function MaterialsStubPage({ params }: Props) {
  const { requestId } = await params;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Coming soon
        </p>
        <h1 className="font-display text-3xl tracking-wide text-paper uppercase">
          Order materials
        </h1>
        <p className="text-sm text-muted">
          Material order for pack <span className="font-mono text-metal">{requestId}</span> is
          not wired yet. Counts will come from the takeoff panel on the pack.
        </p>
        <Link href={`/pack/${requestId}`} className="text-sm text-accent underline">
          Back to pack
        </Link>
      </main>
    </div>
  );
}
