import Link from "next/link";

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ sheet?: string }>;
};

/** Future deep-link: `/pack/[requestId]/rfi/new?sheet=` — empty stub for MVP. */
export default async function NewRfiStubPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const { sheet } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 p-6">
      <p className="text-xs font-medium tracking-wide text-amber-700 uppercase">
        Coming soon
      </p>
      <h1 className="text-2xl font-semibold">Generate RFI</h1>
      <p className="text-sm text-zinc-600">
        Draft to the foreman for pack <span className="font-mono">{requestId}</span>
        {sheet ? (
          <>
            {" "}
            on sheet <span className="font-mono">{sheet}</span>
          </>
        ) : null}
        . This is not a Procore submit.
      </p>
      <form className="space-y-3 rounded-md border border-zinc-200 bg-white p-4 opacity-60">
        <label className="block text-sm">
          Title
          <input
            disabled
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
            placeholder="Question for the design team"
          />
        </label>
        <label className="block text-sm">
          Question
          <textarea
            disabled
            rows={4}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <button
          type="button"
          disabled
          className="rounded bg-zinc-900 px-3 py-2 text-sm text-white"
        >
          Save draft
        </button>
      </form>
      <Link href={`/pack/${requestId}`} className="text-sm text-zinc-700 underline">
        Back to pack
      </Link>
    </main>
  );
}
