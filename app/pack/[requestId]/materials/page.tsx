import Link from "next/link";

type Props = {
  params: Promise<{ requestId: string }>;
};

/** Future deep-link: `/pack/[requestId]/materials` — empty stub for MVP. */
export default async function MaterialsStubPage({ params }: Props) {
  const { requestId } = await params;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-6">
      <p className="text-xs font-medium tracking-wide text-amber-700 uppercase">
        Coming soon
      </p>
      <h1 className="text-2xl font-semibold">Order materials</h1>
      <p className="text-sm text-zinc-600">
        Material order for pack <span className="font-mono">{requestId}</span> is
        not wired yet. Counts will come from the takeoff panel on the pack.
      </p>
      <Link href={`/pack/${requestId}`} className="text-sm text-zinc-700 underline">
        Back to pack
      </Link>
    </main>
  );
}
