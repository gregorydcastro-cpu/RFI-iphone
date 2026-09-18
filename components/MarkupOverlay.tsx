"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  arrowHeadPoints,
  circleRadii,
  createMarkupFromGesture,
  createTextMarkup,
  findMarkupAt,
  type MarkupTool,
  type MarkupVector,
  type Point,
} from "@/lib/markup";

type DraftShape =
  | { kind: "box" | "circle" | "arrow"; start: Point; end: Point }
  | { kind: "text"; point: Point };

type Props = {
  items: MarkupVector[];
  selectedId: string | null;
  tool: MarkupTool;
  aspect: number;
  onSelect: (id: string | null) => void;
  onAdd: (item: MarkupVector) => void;
};

export function MarkupOverlay({
  items,
  selectedId,
  tool,
  aspect,
  onSelect,
  onAdd,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [notePoint, setNotePoint] = useState<Point | null>(null);
  const [noteText, setNoteText] = useState("");
  const drawing = tool !== "pan";

  const toPoint = useCallback((event: ReactPointerEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const w = rect.width || 1;
    const h = rect.height || 1;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / w)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / h)),
    };
  }, []);

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    const point = toPoint(event);
    if (tool === "pan") {
      const hit = findMarkupAt(items, point.x, point.y, aspect);
      onSelect(hit?.id ?? null);
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "text") {
      setDraft({ kind: "text", point });
      return;
    }
    setDraft({ kind: tool, start: point, end: point });
    onSelect(null);
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draft || draft.kind === "text") return;
    setDraft({ ...draft, end: toPoint(event) });
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    if (!draft) return;
    if (draft.kind === "text" && tool !== "text") {
      setDraft(null);
      return;
    }
    if (draft.kind !== "text" && draft.kind !== tool) {
      setDraft(null);
      return;
    }
    const point = toPoint(event);
    if (draft.kind === "text") {
      setNotePoint(draft.point);
      setNoteText("");
      setDraft(null);
      return;
    }
    const item = createMarkupFromGesture({
      kind: draft.kind,
      start: draft.start,
      end: point,
      aspect,
    });
    setDraft(null);
    if (item) {
      onAdd(item);
      onSelect(item.id);
    }
  }

  function commitNote() {
    if (!notePoint) return;
    const item = createTextMarkup({ point: notePoint, text: noteText });
    onAdd(item);
    onSelect(item.id);
    setNotePoint(null);
    setNoteText("");
  }

  const activeDraft =
    draft &&
    ((tool === "text" && draft.kind === "text") ||
      (tool !== "pan" && tool !== "text" && draft.kind === tool))
      ? draft
      : null;
  const preview =
    activeDraft && activeDraft.kind !== "text"
      ? previewItem(activeDraft, aspect)
      : null;
  const activeNote = tool === "text" ? notePoint : null;

  return (
    <>
      <svg
        ref={svgRef}
        className={`absolute inset-0 h-full w-full ${
          drawing ? "cursor-crosshair touch-none" : "pointer-events-none"
        }`}
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDraft(null)}
        aria-label="Sheet markup overlay"
      >
        {items.map((item) => (
          <MarkupShape
            key={item.id}
            item={item}
            aspect={aspect}
            selected={item.id === selectedId}
            interactive={!drawing}
            onSelect={() => onSelect(item.id)}
          />
        ))}
        {preview ? (
          <MarkupShape item={preview} aspect={aspect} selected preview />
        ) : null}
      </svg>
      {activeNote ? (
        <form
          className="absolute right-2 bottom-14 left-2 z-30 flex gap-2 border border-cta bg-gline-ink/95 p-2"
          onSubmit={(event) => {
            event.preventDefault();
            commitNote();
          }}
        >
          <input
            autoFocus
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            placeholder="Text note on this sheet"
            className="min-h-12 flex-1 border border-line bg-ink px-3 text-base text-paper outline-none focus:border-cta"
            aria-label="Markup text note"
          />
          <button
            type="submit"
            className="min-h-12 bg-cta px-3 text-xs font-semibold tracking-wide text-secondary uppercase"
          >
            Place
          </button>
          <button
            type="button"
            className="min-h-12 border border-line px-3 text-xs font-semibold tracking-wide text-tan uppercase"
            onClick={() => {
              setNotePoint(null);
              setNoteText("");
            }}
          >
            Cancel
          </button>
        </form>
      ) : null}
    </>
  );
}

function previewItem(
  draft: Extract<DraftShape, { kind: "box" | "circle" | "arrow" }>,
  aspect: number,
): MarkupVector {
  return (
    createMarkupFromGesture({
      kind: draft.kind,
      start: draft.start,
      end: draft.end,
      aspect,
      id: "preview",
    }) ?? {
      id: "preview",
      kind: "box",
      x: Math.min(draft.start.x, draft.end.x),
      y: Math.min(draft.start.y, draft.end.y),
      w: Math.max(0.001, Math.abs(draft.end.x - draft.start.x)),
      h: Math.max(0.001, Math.abs(draft.end.y - draft.start.y)),
    }
  );
}

function MarkupShape({
  item,
  aspect,
  selected = false,
  preview = false,
  interactive = false,
  onSelect,
}: {
  item: MarkupVector;
  aspect: number;
  selected?: boolean;
  preview?: boolean;
  interactive?: boolean;
  onSelect?: () => void;
}) {
  const stroke = selected ? "#f5f1eb" : "#e10600";
  const fill =
    item.kind === "text"
      ? selected
        ? "rgba(225, 6, 0, 0.85)"
        : "rgba(225, 6, 0, 0.72)"
      : selected
        ? "rgba(225, 6, 0, 0.22)"
        : "rgba(225, 6, 0, 0.12)";
  const dash = preview ? "0.02 0.015" : undefined;
  const events = interactive ? "auto" : undefined;

  if (item.kind === "box") {
    return (
      <rect
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 0.012 : 0.008}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
        pointerEvents={events}
        onPointerDown={
          interactive
            ? (event) => {
                event.stopPropagation();
                onSelect?.();
              }
            : undefined
        }
      />
    );
  }

  if (item.kind === "circle") {
    const { rx, ry } = circleRadii(item, aspect);
    return (
      <ellipse
        cx={item.cx}
        cy={item.cy}
        rx={rx}
        ry={ry}
        fill={fill}
        stroke={stroke}
        strokeWidth={selected ? 0.012 : 0.008}
        strokeDasharray={dash}
        vectorEffect="non-scaling-stroke"
        pointerEvents={events}
        onPointerDown={
          interactive
            ? (event) => {
                event.stopPropagation();
                onSelect?.();
              }
            : undefined
        }
      />
    );
  }

  if (item.kind === "arrow") {
    return (
      <g
        pointerEvents={events}
        onPointerDown={
          interactive
            ? (event) => {
                event.stopPropagation();
                onSelect?.();
              }
            : undefined
        }
      >
        <line
          x1={item.x1}
          y1={item.y1}
          x2={item.x2}
          y2={item.y2}
          stroke={stroke}
          strokeWidth={selected ? 0.014 : 0.01}
          strokeDasharray={dash}
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points={arrowHeadPoints(item, aspect)}
          fill={stroke}
          stroke="none"
        />
      </g>
    );
  }

  const label = item.text.trim() || "Note";
  return (
    <g
      pointerEvents={events}
      onPointerDown={
        interactive
          ? (event) => {
              event.stopPropagation();
              onSelect?.();
            }
          : undefined
      }
    >
      <rect
        x={item.x}
        y={item.y}
        width={Math.min(0.42, Math.max(0.16, label.length * 0.012))}
        height={0.045}
        fill={fill}
        stroke={stroke}
        strokeWidth={0.006}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={item.x + 0.008}
        y={item.y + 0.03}
        fill="#f5f1eb"
        fontSize="0.028"
        fontFamily="system-ui, sans-serif"
      >
        {label.slice(0, 28)}
      </text>
    </g>
  );
}
