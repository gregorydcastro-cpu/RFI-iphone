"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FieldRoleName } from "@/lib/auth";
import { canInviteCrew } from "@/lib/inviteRole";

type Props = {
  signedIn?: boolean;
  role?: FieldRoleName | null;
  procoreLinked?: boolean;
  procoreConnected?: boolean;
};

export function AppHeader({
  signedIn = false,
  role = null,
  procoreLinked = false,
  procoreConnected = false,
}: Props) {
  const pathname = usePathname();
  const resolvedRole: FieldRoleName | null =
    role ?? (signedIn ? (procoreLinked ? "puller" : "viewer") : null);
  const connected = procoreConnected || procoreLinked;
  const timeActive = pathname === "/time" || pathname.startsWith("/time/");
  const shareActive = pathname === "/share" || pathname.startsWith("/share/");
  const accountActive =
    pathname === "/account" || pathname.startsWith("/account/");

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
              <Link
                className={
                  timeActive
                    ? "text-cta"
                    : "text-secondary hover:text-cta"
                }
                href="/time"
              >
                Time
              </Link>
              <Link
                className={
                  shareActive
                    ? "text-cta"
                    : "text-secondary hover:text-cta"
                }
                href="/share"
              >
                Share
              </Link>
              <Link
                className={
                  accountActive
                    ? "text-cta"
                    : "text-secondary hover:text-cta"
                }
                href="/account"
              >
                Account
              </Link>
              {canInviteCrew(resolvedRole) ? (
                <Link
                  className="text-secondary hover:text-cta"
                  href="/account#invite"
                >
                  Invite
                </Link>
              ) : null}
              {resolvedRole ? (
                <span
                  className={
                    connected
                      ? "border border-cta/40 px-1.5 py-0.5 text-[10px] text-secondary"
                      : "border border-line px-1.5 py-0.5 text-[10px] text-tan"
                  }
                  title={
                    resolvedRole === "puller"
                      ? connected
                        ? "Procore connected — can pull"
                        : "Puller — connect Procore to pull"
                      : resolvedRole === "full"
                        ? "Full crew — markup and drafts, no Procore pull"
                        : "Read-only viewer — sheets and red room box only"
                  }
                >
                  {resolvedRole === "puller"
                    ? connected
                      ? "Procore connected"
                      : "Puller"
                    : resolvedRole === "full"
                      ? "Full"
                      : "View only"}
                </span>
              ) : null}
              <a
                className="text-accent-2 hover:text-secondary"
                href="/api/session/logout"
              >
                Sign out
              </a>
            </>
          ) : (
            <>
              <Link className="text-secondary hover:text-cta" href="/pricing">
                Pricing
              </Link>
              <span className="text-accent-2">Login</span>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
