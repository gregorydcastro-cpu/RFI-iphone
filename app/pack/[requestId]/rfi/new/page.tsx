import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

type Props = {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ sheet?: string }>;
};

/** Future deep-link: `/pack/[requestId]/rfi/new?sheet=` — empty stub for MVP. */
export default async function NewRfiStubPage({ params, searchParams }: Props) {
  const { requestId } = await params;
  const { sheet } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-6">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Coming soon
        </p>
        <h1 className="font-display text-3xl tracking-wide text-paper uppercase">
          Generate RFI
        </h1>
        <p className="text-sm text-muted">
          Draft to the foreman for pack <span className="font-mono text-metal">{requestId}</span>
          {sheet ? (
            <>
              {" "}
              on sheet <span className="font-mono text-metal">{sheet}</span>
            </>
          ) : null}
          . This is not a Procore submit.
        </p>
        <form className="space-y-3 border border-line bg-panel p-4 opacity-60">
          <label className="block text-sm text-muted">
            Title
            <input
              disabled
              className="mt-1 w-full border border-line bg-ink px-2 py-1 text-paper"
              placeholder="Question for the design team"
            />
          </label>
          <label className="block text-sm text-muted">
            Question
            <textarea
              disabled
              rows={4}
              className="mt-1 w-full border border-line bg-ink px-2 py-1 text-paper"
            />
          </label>
          <button
            type="button"
            disabled
            className="bg-accent-deep px-3 py-2 text-sm text-paper"
          >
            Save draft
          </button>
        </form>
        <Link href={`/pack/${requestId}`} className="text-sm text-accent underline">
          Back to pack
        </Link>
      </main>
    </div>
  );
}
