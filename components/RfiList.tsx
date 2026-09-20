"use client";

import { ReadAloudButton } from "@/components/ReadAloudButton";
import { VoiceSetupNote } from "@/components/VoiceSetupNote";
import { rfiSpeakText } from "@/lib/rfiDictation";
import type { Rfi } from "@/lib/pack";

const STATUS_CLASS: Record<string, string> = {
  open: "border-cta/60 bg-accent-1/40 text-secondary",
  answered: "border-accent-3/50 bg-panel-2 text-accent-3",
  closed: "border-line bg-ink text-tan",
};

type Props = {
  rfis: Rfi[];
};

function speakOne(rfi: Rfi): string {
  return rfiSpeakText({
    number: rfi.number,
    title: rfi.title,
    status: rfi.status,
  });
}

function speakAll(rfis: Rfi[]): string {
  if (!rfis.length) return "No RFIs linked to this room.";
  return rfis
    .map((rfi, index) => `${index + 1}. ${speakOne(rfi)}`)
    .join(" ");
}

export function RfiList({ rfis }: Props) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xs tracking-[0.18em] text-muted uppercase">
          RFIs
        </h2>
        {rfis.length ? (
          <ReadAloudButton
            id="pack-rfis-all"
            text={speakAll(rfis)}
            label="Read all"
          />
        ) : null}
      </div>
      <VoiceSetupNote />
      {rfis.length === 0 ? (
        <p className="text-sm text-muted">No RFIs linked to this room.</p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-ink">
          {rfis.map((rfi) => (
            <li key={rfi.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-metal">{rfi.number}</p>
                  {rfi.url ? (
                    <a
                      href={rfi.url}
                      className="text-sm font-medium text-paper underline-offset-2 hover:underline"
                    >
                      {rfi.title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-paper">{rfi.title}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                    STATUS_CLASS[rfi.status] ?? "border-line bg-panel text-muted"
                  }`}
                >
                  {rfi.status}
                </span>
              </div>
              <div className="mt-2">
                <ReadAloudButton
                  id={`pack-rfi-${rfi.id}`}
                  text={speakOne(rfi)}
                  label="Speak"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
