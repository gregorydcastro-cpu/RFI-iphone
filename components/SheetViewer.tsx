"use client";

import { useEffect, useRef, useState } from "react";
import {
  TransformComponent,
  TransformWrapper,
  type ReactZoomPanPinchContentRef,
} from "react-zoom-pan-pinch";
import type { ResolvedHighlight } from "@/lib/highlight";

type Props = {
  pdfUrl: string;
  highlight: ResolvedHighlight | null;
};

export function SheetViewer({ pdfUrl, highlight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1224 / 792);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    async function render() {
      setReady(false);
      setError(null);
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const loadingTask = pdfjs.getDocument({ url: pdfUrl });
      const doc = await loadingTask.promise;
      if (cancelled) return;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      if (cancelled || !canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setAspect(viewport.width / viewport.height);
      await page.render({ canvas, viewport }).promise;
      if (!cancelled) {
        setReady(true);
        transformRef.current?.resetTransform();
      }
    }

    render().catch((err: unknown) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : "Could not render sheet");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  return (
    <div className="relative h-full min-h-[280px] w-full overflow-hidden bg-zinc-300">
      <TransformWrapper
        ref={transformRef}
        minScale={0.4}
        maxScale={8}
        initialScale={1}
        centerOnInit
        fitOnInit
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        doubleClick={{ mode: "zoomIn", step: 0.7 }}
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
                {ready && highlight ? <HighlightOverlay highlight={highlight} /> : null}
              </div>
            </TransformComponent>
            <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md bg-zinc-950/80 p-1 text-white shadow">
              <button
                type="button"
                className="rounded px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => zoomOut()}
                aria-label="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-sm hover:bg-white/10"
                onClick={() => zoomIn()}
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs hover:bg-white/10"
                onClick={() => resetTransform()}
              >
                Reset
              </button>
            </div>
          </>
        )}
      </TransformWrapper>
      <p className="pointer-events-none absolute right-3 bottom-3 rounded bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-100">
        Scroll to zoom · drag to pan
      </p>
      {!ready && !error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-300/80 text-sm text-zinc-700">
          Loading sheet…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-200 px-4 text-center text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function HighlightOverlay({ highlight }: { highlight: ResolvedHighlight }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden
    >
      {highlight.type === "polygon" ? (
        <polygon
          points={highlight.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="rgba(245, 158, 11, 0.32)"
          stroke="#d97706"
          strokeWidth="0.006"
        />
      ) : (
        <rect
          x={highlight.bbox.x}
          y={highlight.bbox.y}
          width={highlight.bbox.w}
          height={highlight.bbox.h}
          fill="rgba(245, 158, 11, 0.32)"
          stroke="#d97706"
          strokeWidth="0.006"
        />
      )}
    </svg>
  );
}
