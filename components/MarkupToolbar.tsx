"use client";

import { useEffect, useState } from "react";
import {
  markupKindLabel,
  type MarkupStorageKind,
  type MarkupTool,
  type MarkupVector,
} from "@/lib/markup";
import {
  markupSaveSurface,
  type MarkupSaveFail,
} from "@/lib/markupSaveField";
import { MarkupFieldBanner, MarkupFieldEmptyState } from "./MarkupFieldBanner";
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
  saveFail?: MarkupSaveFail | null;
  saveRetryable?: boolean;
  saveEmpty?: boolean;
  onRetrySave?: () => void;
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
  saveFail = null,
  saveRetryable = true,
  saveEmpty = false,
  onRetrySave,
  onCreateRfi,
  onDeleteSelected,
  onUndo,
  onClearAll,
  disabled = false,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const surface = markupSaveSurface({
    saving,
    itemCount,
    storage,
    persistFailed,
    fail: saveFail,
    retryable: saveRetryable,
    settledEmpty: saveEmpty,
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
    <div className="pointer-events-auto absolute top-2 right-2 left-2 z-20 flex flex-col gap-1.5">
      <div className="flex items-center gap-1 overflow-x-auto border border-line bg-gline-ink/95 p-1">
        {tools.map((entry) => {
          const active = tool === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              onClick={() => onTool(entry.id)}
              className={`min-h-12 min-w-12 shrink-0 px-3 text-xs font-semibold tracking-wide uppercase ${
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
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {surface.kind === "saving" ||
        surface.kind === "saved" ||
        surface.kind === "local" ? (
          <MarkupSaveChip chip={{ label: surface.label, tone: surface.tone }} />
        ) : null}
        {itemCount > 0 && confirmClear ? (
          <>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setConfirmClear(false);
                onClearAll();
              }}
              className="min-h-12 min-w-12 shrink-0 border border-cta bg-cta px-3 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-50"
            >
              Confirm clear
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmClear(false)}
              className="min-h-12 min-w-12 shrink-0 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2 disabled:opacity-50"
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
              className="min-h-12 min-w-12 shrink-0 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-paper uppercase hover:bg-panel-2 disabled:opacity-50"
            >
              Undo last
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmClear(true)}
              className="min-h-12 min-w-12 shrink-0 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2 disabled:opacity-50"
            >
              Clear all
            </button>
          </>
        ) : null}
        {selected ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onDeleteSelected}
            className="min-h-12 shrink-0 border border-line bg-gline-ink/95 px-3 text-xs font-semibold tracking-wide text-tan uppercase hover:bg-panel-2 disabled:opacity-50"
          >
            Delete
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled || !selected}
          onClick={onCreateRfi}
          className="sticky right-0 z-10 ml-auto min-h-12 shrink-0 border border-cta bg-cta px-3 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:border-line disabled:bg-panel-2 disabled:text-tan"
        >
          {createLabel}
        </button>
      </div>
      {surface.kind === "error" ? (
        <MarkupFieldBanner
          title={surface.title}
          message={surface.message}
          speak={surface.speak}
          speakId="markup-save-error"
          onRetry={surface.retry ? onRetrySave : undefined}
          retryDisabled={saving}
          retryLabel={saving ? "Saving…" : "Retry"}
        />
      ) : null}
      {surface.kind === "empty" ? (
        <MarkupFieldEmptyState
          title={surface.title}
          message={surface.message}
          speak={surface.speak}
          speakId="markup-save-empty"
        />
      ) : null}
    </div>
  );
}
