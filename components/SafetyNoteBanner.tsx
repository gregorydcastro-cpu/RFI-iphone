"use client";

import { ReadAloudButton } from "@/components/ReadAloudButton";

type Props = {
  text: string;
  speakId?: string;
};

/** Pinned red count while a safety note on the job is still open. */
export function SafetyNoteBanner({ text, speakId = "safety-note-banner" }: Props) {
  return (
    <div
      role="status"
      className="sticky top-0 z-20 border border-cta bg-cta px-4 py-3 text-secondary shadow-lg"
    >
      <p className="text-base font-semibold">{text}</p>
      <ReadAloudButton
        id={speakId}
        text={text}
        label="Hear this"
        className="mt-2"
      />
    </div>
  );
}
