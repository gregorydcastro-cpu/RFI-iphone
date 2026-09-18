"use client";

import type { MarkupTool, MarkupVector } from "@/lib/markup";
import { markupKindLabel } from "@/lib/markup";

const tools: { id: MarkupTool; label: string }[] = [
  { id: "pan", label: "Pan" },
  { id: "circle", label: "Circle" },
  { id: "box", label: "Box" },
  { id: "arrow", label: "Arrow" },
  { id: "text", label: "Note" },
];

type Props = {
  tool: MarkupTool;
  onTool: (tool: MarkupTool) => void;
  selected: MarkupVector | null;
  onCreateRfi: () => void;
  onDeleteSelected: () => void;
  disabled?: boolean;
};

export function MarkupToolbar({
  tool,
  onTool,
  selected,
  onCreateRfi,
  onDeleteSelected,
  disabled = false,
}: Props) {
  const createLabel = selected
    ? `Create RFI · ${markupKindLabel(selected.kind)}`
    : "Create RFI";

  return (
    <div className="pointer-events-auto absolute top-2 right-2 left-2 z-20 flex flex-wrap items-center gap-1.5">
      <div className="flex flex-wrap items-center gap-1 border border-line bg-gline-ink/95 p-1">
        {tools.map((entry) => {
          const active = tool === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => onTool(entry.id)}
              className={`min-h-12 min-w-12 px-3 text-xs font-semibold tracking-wide uppercase ${
                active
                  ? "bg-cta text-secondary"
                  : "bg-panel-2 text-paper hover:bg-accent-deep"
              } disabled:opacity-50`}
              aria-pressed={active}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled || !selected}
        onClick={onCreateRfi}
        className="min-h-12 flex-1 border border-cta bg-cta px-3 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:border-line disabled:bg-panel-2 disabled:text-tan sm:flex-none"
      >
        {createLabel}
      </button>
      {selected ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onDeleteSelected}
          className="min-h-12 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}
