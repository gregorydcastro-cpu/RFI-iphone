"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import {
  bboxFromPoints,
  highlightForSheet,
  type OversizedRoomBox,
  type ResolvedHighlight,
} from "@/lib/highlight";
import {
  buildMarkupRfiPrefill,
  writeMarkupRfiPrefill,
  type MarkupTool,
  type MarkupVector,
} from "@/lib/markup";
import type { Layout } from "@/lib/pack";
import { MarkupOverlay } from "./MarkupOverlay";
import { MarkupToolbar } from "./MarkupToolbar";
import { useMarkupOverlay } from "./useMarkupOverlay";

type Props = {
  pdfUrl: string;
  highlight?: OversizedRoomBox | ResolvedHighlight | null;
  layout?: Layout;
  sheetId?: string;
  sheetRev?: string;
  primarySheetId?: string;
  requestId?: string;
  roomName?: string;
  roomNumber?: string;
  readOnly?: boolean;
};

export function SheetViewer({
  pdfUrl,
  highlight,
  layout,
  sheetId,
  sheetRev,
  primarySheetId,
  requestId,
  roomName,
  roomNumber,
  readOnly = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1224 / 792);
  const [pagePts, setPagePts] = useState<{ width: number; height: number }>();
  const [tool, setTool] = useState<MarkupTool>("pan");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const router = useRouter();
  const markupEnabled = Boolean(requestId && sheetId);
  const markup = useMarkupOverlay(requestId ?? "", sheetId ?? "", {
    readOnly,
  });

  const overlay = useMemo(() => {
    if (layout && sheetId) {
      return highlightForSheet(layout, sheetId, pagePts, { primarySheetId });
    }
    return highlight ?? null;
  }, [highlight, layout, pagePts, primarySheetId, sheetId]);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!pdfUrl || !canvas) return;
    const abort = new AbortController();

    async function render() {
      setReady(false);
      setError(null);
      const response = await fetch(pdfUrl, {
        signal: abort.signal,
        credentials: "same-origin",
      });
      if (!response.ok) {
        const type = response.headers.get("content-type") ?? "";
        if (type.includes("application/json")) {
          const body = (await response.json()) as { error?: string };
          throw new Error(
            body.error?.trim() || `Could not load sheet (${response.status})`,
          );
        }
        throw new Error(`Could not load sheet (${response.status})`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        bytes.byteLength < 5 ||
        bytes[0] !== 0x25 ||
        bytes[1] !== 0x50 ||
        bytes[2] !== 0x44 ||
        bytes[3] !== 0x46
      ) {
        throw new Error("Sheet response was not a PDF");
      }
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const loadingTask = pdfjs.getDocument({ data: bytes });
      const doc = await loadingTask.promise;
      if (cancelled) return;
      const page = await doc.getPage(1);
      const pageSize = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 2 });
      if (cancelled || !canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setPagePts({ width: pageSize.width, height: pageSize.height });
      setAspect(viewport.width / viewport.height);
      await page.render({ canvas, viewport }).promise;
      if (!cancelled) {
        setReady(true);
        transformRef.current?.resetTransform();
      }
    }

    void render().catch((err: unknown) => {
      if (cancelled) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (err instanceof Error && err.name === "AbortError") return;
      setReady(true);
      setError(err instanceof Error ? err.message : "Could not render sheet");
    });

    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [pdfUrl]);

  const missingPdf = !pdfUrl;
  const selected: MarkupVector | null =
    markup.items.find((item) => item.id === selectedId) ?? null;
  const drawing = tool !== "pan";

  function handleAdd(item: MarkupVector) {
    markup.setItems((current) => [...current, item]);
    setSelectedId(item.id);
  }

  function handleDeleteSelected() {
    if (!selectedId) return;
    markup.setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  }

  async function handleCreateRfi() {
    if (!requestId || !sheetId || !selected) return;
    const saved = await markup.flush();
    const overlayId = saved.id || markup.overlayId;
    const prefill = buildMarkupRfiPrefill({
      requestId,
      overlayId,
      item: selected,
      sheetId,
      sheetRev: sheetRev ?? "",
      roomName: roomName ?? "",
      roomNumber,
      vectors: saved.vectors,
    });
    writeMarkupRfiPrefill(prefill);
    const params = new URLSearchParams({
      sheet: sheetId,
      markup: overlayId,
      item: selected.id,
      subject: prefill.subject,
      question: prefill.question,
      location: prefill.location,
      kind: prefill.kind,
    });
    router.push(`/pack/${requestId}/rfi/new?${params.toString()}`);
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-charcoal">
      {markupEnabled && !readOnly ? (
        <MarkupToolbar
          tool={tool}
          onTool={setTool}
          selected={selected}
          onCreateRfi={handleCreateRfi}
          onDeleteSelected={handleDeleteSelected}
          disabled={!ready}
        />
      ) : null}
      <TransformWrapper
        ref={transformRef}
        minScale={0.4}
        maxScale={8}
        initialScale={1}
        centerOnInit
        fitOnInit
        limitToBounds={false}
        wheel={{ disabled: true }}
        panning={{ disabled: !readOnly && drawing }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: !readOnly && drawing, mode: "zoomIn", step: 0.7 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            <TransformComponent
              wrapperClass="!h-full !w-full"
              contentClass="!flex !h-full !w-full !items-center !justify-center"
            >
              <div
                className="relative w-[min(100%,1100px)] shadow-md"
                style={{ aspectRatio: `${aspect}` }}
              >
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full bg-white"
                />
                {overlay ? <HighlightOverlay highlight={overlay} /> : null}
                {markupEnabled ? (
                  <MarkupOverlay
                    items={markup.items}
                    selectedId={readOnly ? null : selectedId}
                    tool={readOnly ? "pan" : tool}
                    aspect={aspect}
                    onSelect={readOnly ? () => undefined : setSelectedId}
                    onAdd={readOnly ? () => undefined : handleAdd}
                  />
                ) : null}
              </div>
            </TransformComponent>
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 border border-line bg-gline-ink/90 p-1 text-paper">
              <button
                type="button"
                className="min-h-10 min-w-10 px-2 py-1 text-sm hover:bg-accent"
                onClick={() => zoomOut()}
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="min-h-10 min-w-10 px-2 py-1 text-sm hover:bg-accent"
                onClick={() => zoomIn()}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="min-h-10 px-2 py-1 text-xs hover:bg-accent"
                onClick={() => resetTransform()}
              >
                Reset
              </button>
            </div>
          </>
        )}
      </TransformWrapper>
      <p className="pointer-events-none absolute right-3 bottom-3 bg-gline-ink/80 px-2 py-1 text-[11px] text-metal">
        {readOnly
          ? "View only · pinch or +/− to zoom · drag to pan"
          : drawing
            ? tool === "text"
              ? "Tap the sheet to place a note"
              : "Drag on the sheet · vector overlay (not a photo bake)"
            : selected
              ? "Markup selected · Create RFI sends a draft to the foreman"
              : "Pinch or +/− to zoom · drag to pan · tap a markup to select"}
      </p>
      {!ready && !error && !missingPdf ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-charcoal/80 text-sm text-muted">
          Loading sheet…
        </div>
      ) : null}
      {error || missingPdf ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-ink/80 px-4 py-2 text-center text-xs text-accent">
          {missingPdf ? "No PDF attached for this sheet" : error}
        </div>
      ) : null}
    </div>
  );
}

function HighlightOverlay({
  highlight,
}: {
  highlight: OversizedRoomBox | ResolvedHighlight;
}) {
  const bbox =
    highlight.type === "bbox"
      ? highlight.bbox
      : bboxFromPoints(highlight.points);
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect
        x={bbox.x}
        y={bbox.y}
        width={bbox.w}
        height={bbox.h}
        fill="rgba(225, 6, 0, 0.16)"
        stroke="#e10600"
        strokeWidth="0.012"
      />
    </svg>
  );
}
