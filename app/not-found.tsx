import { AppHeader } from "@/components/AppHeader";
import { getFieldRole } from "@/lib/auth.server";
import Link from "next/link";

export default async function NotFound() {
  const role = await getFieldRole();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader signedIn procoreLinked={role.procoreLinked} />
      <main className="mx-auto flex min-h-0 max-w-lg flex-1 flex-col items-start justify-center gap-3 p-6">
        <h1 className="font-display text-3xl tracking-wide text-paper uppercase">
          Not found
        </h1>
        <p className="text-sm text-muted">
          Unknown job or pack. Demo packs live at{" "}
          <code className="font-mono text-metal">public/packs/&lt;requestId&gt;.json</code>
          . Unknown request IDs still open the Maple Point sample from a pack
          URL.
        </p>
        <Link href="/jobs" className="text-sm text-accent underline">
          Back to jobs
        </Link>
      </main>
    </div>
  );
}
