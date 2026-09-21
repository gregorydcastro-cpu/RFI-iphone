"use client";

import { useEffect, useState } from "react";
import {
  markupKindLabel,
  markupSaveChip,
  type MarkupSaveChip as MarkupSaveChipState,
  type MarkupStorageKind,
  type MarkupTool,
  type MarkupVector,
} from "@/lib/markup";
import { MarkupSaveChip } from "./MarkupSaveChip";

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
  itemCount: number;
  storage: MarkupStorageKind;
  saving: boolean;
  persistFailed: boolean;
  onCreateRfi: () => void;
  onDeleteSelected: () => void;
  onUndo: () => void;
  onClearAll: () => void;
  disabled?: boolean;
};

export function MarkupToolbar({
  tool,
  onTool,
  selected,
  itemCount,
  storage,
  saving,
  persistFailed,
  onCreateRfi,
  onDeleteSelected,
  onUndo,
  onClearAll,
  disabled = false,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const chip: MarkupSaveChipState = markupSaveChip({
    storage,
    saving,
    persistFailed,
  });
  const createLabel = selected
    ? `Create RFI · ${markupKindLabel(selected.kind)}`
    : "Create RFI";

  if (itemCount === 0 && confirmClear) setConfirmClear(false);

  useEffect(() => {
    if (!confirmClear) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setConfirmClear(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmClear]);

  return (
    <div className="pointer-events-auto absolute top-2 right-2 left-2 z-20 flex flex-wrap items-center gap-1.5">
      <MarkupSaveChip chip={chip} />
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
      {itemCount > 0 && confirmClear ? (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setConfirmClear(false);
              onClearAll();
            }}
            className="min-h-12 min-w-12 border border-cta bg-cta px-3 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-50"
          >
            Confirm clear
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setConfirmClear(false)}
            className="min-h-12 min-w-12 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2 disabled:opacity-50"
          >
            Cancel
          </button>
        </>
      ) : null}
      {itemCount > 0 && !confirmClear ? (
        <>
          <button
            type="button"
            disabled={disabled}
            onClick={onUndo}
            className="min-h-12 min-w-12 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-paper uppercase hover:bg-panel-2 disabled:opacity-50"
          >
            Undo last
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setConfirmClear(true)}
            className="min-h-12 min-w-12 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2 disabled:opacity-50"
          >
            Clear all
          </button>
        </>
      ) : null}
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
          className="min-h-12 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2 disabled:opacity-50"
        >
          Delete
        </button>
      ) : null}
    </div>
  );
}
