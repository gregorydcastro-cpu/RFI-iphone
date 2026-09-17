import Link from "next/link";

type Props = {
  signedIn?: boolean;
};

export function AppHeader({ signedIn = false }: Props) {
  return (
    <header className="border-b border-line bg-gline-ink/90 backdrop-blur">
      <div className="h-0.5 w-full bg-accent" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href={signedIn ? "/jobs" : "/"} className="min-w-0">
          <p className="font-display text-[11px] font-medium tracking-[0.22em] text-accent uppercase">
            gcfieldlog.com
          </p>
          <p className="font-display truncate text-xl tracking-wide text-paper uppercase">
            GC Field Log
          </p>
        </Link>
        <nav className="flex items-center gap-3 text-xs font-semibold tracking-wide uppercase">
          {signedIn ? (
            <>
              <Link className="text-muted hover:text-paper" href="/jobs">
                Jobs
              </Link>
              <Link className="text-muted hover:text-paper" href="/">
                Sign out
              </Link>
            </>
          ) : (
            <span className="text-muted">Crew dashboard</span>
          )}
        </nav>
      </div>
    </header>
  );
}
