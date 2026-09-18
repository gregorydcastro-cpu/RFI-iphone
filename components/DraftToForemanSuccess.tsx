import Link from "next/link";
import type { ReactNode } from "react";
import { DEMO_FOREMAN } from "@/lib/crew";

type Props = {
  heading: string;
  packetLabel: string;
  jobName: string;
  roomName: string;
  pin?: string;
  authorLabel: string;
  backHref: string;
  children?: ReactNode;
};

export function DraftToForemanSuccess({
  heading,
  packetLabel,
  jobName,
  roomName,
  pin,
  authorLabel,
  backHref,
  children,
}: Props) {
  return (
    <div
      role="status"
      className="space-y-4 border border-cta/50 bg-panel p-4 shadow-[0_0_0_1px_rgb(225_6_0_/_0.2)]"
    >
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Draft to foreman
      </p>
      <h2 className="font-display text-2xl tracking-wide text-paper uppercase">
        {heading}
      </h2>
      <p className="text-sm text-muted">
        {packetLabel} sent to{" "}
        <span className="font-medium text-paper">{DEMO_FOREMAN.name}</span> (
        {DEMO_FOREMAN.role}). Not filed in Procore.
      </p>
      <dl className="space-y-1 text-sm text-muted">
        <div>
          Job <span className="text-paper">{jobName}</span>
        </div>
        <div>
          Room <span className="text-paper">{roomName}</span>
        </div>
        {pin ? (
          <div>
            Sheet{" "}
            <span className="font-mono text-metal">{pin}</span>
          </div>
        ) : null}
        <div>
          From <span className="text-paper">{authorLabel}</span>
        </div>
        <div>
          To{" "}
          <span className="text-paper">
            {DEMO_FOREMAN.name} · {DEMO_FOREMAN.email}
          </span>
        </div>
      </dl>
      {children}
      <Link
        href={backHref}
        className="inline-flex min-h-12 w-full items-center justify-center bg-cta px-4 py-3 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Back to pack
      </Link>
    </div>
  );
}
