/**
 * Signed-out top bar. Pricing and Login only.
 * Anchors work with JavaScript off.
 */
export function SignedOutBar({ homeHref = "/" }: { homeHref?: string }) {
  return (
    <header className="border-b border-line bg-primary">
      <div className="h-0.5 w-full bg-cta" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a
          href={homeHref}
          className="font-display min-w-0 text-xl tracking-wide text-secondary"
        >
          GC Field Log
        </a>
        <nav
          aria-label="Field Log"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold tracking-wide uppercase"
        >
          <a
            href="/pricing"
            className="inline-flex min-h-11 items-center text-secondary hover:text-cta"
          >
            Pricing
          </a>
          <span className="inline-flex min-h-11 items-center text-cta">Login</span>
        </nav>
      </div>
    </header>
  );
}
