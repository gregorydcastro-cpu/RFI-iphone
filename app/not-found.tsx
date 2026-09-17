import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center gap-3 p-6">
      <h1 className="text-2xl font-semibold">Pack not found</h1>
      <p className="text-sm text-zinc-600">
        Place JSON at <code className="font-mono">public/packs/&lt;requestId&gt;.json</code>{" "}
        or open the Maple Point demo.
      </p>
      <Link href="/" className="text-sm text-zinc-900 underline">
        Maple Point demo
      </Link>
    </main>
  );
}
