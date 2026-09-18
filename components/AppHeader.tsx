"use client";

import Link from "next/link";
import { procoreLinkedCookie, type FieldRoleName } from "@/lib/auth";

type Props = {
  signedIn?: boolean;
  procoreLinked?: boolean;
};

export function AppHeader({ signedIn = false, procoreLinked = false }: Props) {
  const role: FieldRoleName = procoreLinked ? "puller" : "viewer";

  function clearRoleCookie() {
    document.cookie = procoreLinkedCookie(false);
  }

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
              <span
                className={
                  procoreLinked
                    ? "border border-cta/40 px-1.5 py-0.5 text-[10px] text-secondary"
                    : "border border-line px-1.5 py-0.5 text-[10px] text-tan"
                }
                title={
                  procoreLinked
                    ? "Linked Procore account — can pull packs"
                    : "Read-only viewer — cannot pull packs"
                }
              >
                {role === "puller" ? "Puller" : "View only"}
              </span>
              <Link
                className="text-accent-2 hover:text-secondary"
                href="/"
                onClick={clearRoleCookie}
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
