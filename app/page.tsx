import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/LoginForm";
import { SiteFooter } from "@/components/SiteFooter";
import { safeNextPath, staleSessionClearPath } from "@/lib/authMessages";
import { publicPageMetadata } from "@/lib/siteMetadata";
import { readAppSession, supabaseSessionCookiePresent } from "@/lib/session.server";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";

export const metadata = publicPageMetadata("/");

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    next?: string;
    auth?: string;
    reason?: string;
    cleared?: string;
  }>;
};

export default async function LoginPage({ searchParams }: Props) {
  // Request-time headers so Auth env is not snapshotted at build.
  // Host is not a gate — vercel.app and custom domains share keys-only.
  await headers();
  const query = await searchParams;
  const next = safeNextPath(query.next);
  const session = await readAppSession();
  if (session) {
    redirect(next);
  }
  // Auth cookie with no session looks signed-in on the next gated page.
  // Clear it once, then show login. `cleared=1` stops a redirect loop.
  if (query.cleared !== "1" && (await supabaseSessionCookiePresent())) {
    redirect(
      staleSessionClearPath({
        next: query.next,
        auth: query.auth,
        reason: query.reason,
      }),
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <Suspense
          fallback={
            <div
              className="h-[32rem] w-full max-w-md border-l-4 border-l-cta border-y border-r border-line bg-panel"
              aria-hidden
            />
          }
        >
          <LoginForm authConfigured={isSupabaseAuthConfigured()} />
        </Suspense>
        <p className="mt-6 max-w-md text-center text-base text-paper">
          After sign-in, punch in or open a job.
        </p>
        <div className="mt-3 grid w-full max-w-md grid-cols-2 gap-3">
          <Link
            href="/?next=/time"
            className="flex min-h-14 items-center justify-center bg-cta px-3 text-center text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
          >
            Punch in
          </Link>
          <Link
            href="/?next=/jobs"
            className="flex min-h-14 items-center justify-center border border-line bg-panel px-3 text-center text-sm font-semibold tracking-wide text-paper uppercase hover:border-cta"
          >
            Open a job
          </Link>
        </div>
        <p className="mt-3 max-w-md text-center text-sm text-muted">
          Maple Point and the other jobs here are fictional.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
