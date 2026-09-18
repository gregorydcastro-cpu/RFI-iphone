import Link from "next/link";
import type { FieldRoleName } from "@/lib/auth";

type Props = {
  signedIn?: boolean;
  role?: FieldRoleName | null;
  procoreConnected?: boolean;
};

export function AppHeader({
  signedIn = false,
  role = null,
  procoreConnected = false,
}: Props) {
  return (
    <header className="border-b border-line bg-primary">
      <div className="h-0.5 w-full bg-cta" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          href={signedIn ? "/jobs" : "/"}
          className="font-display min-w-0 text-xl tracking-wide text-secondary"
        >
          GC Field Log
        </Link>
        <nav
          aria-label="Field Log"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold tracking-wide uppercase"
        >
          {signedIn ? (
            <>
              <Link className="text-secondary hover:text-cta" href="/jobs">
                Jobs
              </Link>
              <span className="cursor-default text-tan/50" title="Later">
                Tools
              </span>
              <span className="cursor-default text-tan/50" title="Later">
                Time
              </span>
              <Link
                className="text-secondary hover:text-cta"
                href="/account"
              >
                Account
              </Link>
              {role ? (
                <span
                  className={
                    procoreConnected
                      ? "border border-cta/40 px-1.5 py-0.5 text-[10px] text-secondary"
                      : "border border-line px-1.5 py-0.5 text-[10px] text-tan"
                  }
                  title={
                    role === "puller"
                      ? procoreConnected
                        ? "Procore connected — can pull"
                        : "Puller — connect Procore to pull"
                      : "Read-only viewer — no Procore connect required"
                  }
                >
                  {role === "puller"
                    ? procoreConnected
                      ? "Procore connected"
                      : "Puller"
                    : "View only"}
                </span>
              ) : null}
              <Link
                className="text-accent-2 hover:text-secondary"
                href="/api/session/logout"
              >
                Sign out
              </Link>
            </>
          ) : (
            <span className="text-accent-2">Login</span>
          )}
        </nav>
      </div>
    </header>
  );
}
