"use client";

import type { MarkupSaveChip as MarkupSaveChipState } from "@/lib/markup";

const toneClass: Record<MarkupSaveChipState["tone"], string> = {
  saving: "border-cta bg-gline-ink text-paper",
  saved: "border-line bg-gline-ink text-paper",
  local: "border-tan/50 bg-gline-ink text-tan",
  failed: "border-cta bg-gline-ink text-cta",
};

export function MarkupSaveChip({
  chip,
  detail,
}: {
  chip: MarkupSaveChipState;
  detail?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex min-h-12 max-w-full flex-wrap items-center gap-x-2 border px-3 text-xs font-semibold tracking-wide uppercase ${toneClass[chip.tone]}`}
    >
      {chip.label}
      {detail ? (
        <span className="font-normal tracking-normal normal-case">{detail}</span>
      ) : null}
    </span>
  );
}
