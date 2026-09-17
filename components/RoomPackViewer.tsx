"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { highlightForSheet } from "@/lib/highlight";
import { packActions, type PackAction, type RoomPack, type Sheet } from "@/lib/pack";
import { ActionPanel } from "./ActionPanel";
import { AppHeader } from "./AppHeader";
import { PackPollStub } from "./PackPollStub";
import { RfiList } from "./RfiList";
import { SheetViewer } from "./SheetViewer";
import { TakeoffCounts } from "./TakeoffCounts";

type Props = {
  pack: RoomPack;
  requestId?: string;
  requestedRoom?: string;
  requestedJobName?: string;
  projectSlug?: string;
  demoFallback?: boolean;
  webhookAccepted?: boolean;
};

export function RoomPackViewer({
  pack,
  requestId,
  requestedRoom,
  requestedJobName,
  projectSlug,
  demoFallback,
  webhookAccepted,
}: Props) {
  const router = useRouter();
  const [livePack, setLivePack] = useState<RoomPack | null>(null);
  const displayedPack = livePack ?? pack;
  const [sheetId, setSheetId] = useState(displayedPack.sheets[0]?.id ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const sheet =
    displayedPack.sheets.find((item) => item.id === sheetId) ??
    displayedPack.sheets[0];
  const actions = useMemo(() => packActions(displayedPack), [displayedPack]);
  const highlight = sheet
    ? highlightForSheet(displayedPack.layout, sheet.id)
    : null;
  const displayedRequest = requestId ?? displayedPack.request_id;
  const showingDemo = demoFallback && !livePack;
  const polling = Boolean(webhookAccepted && showingDemo && projectSlug);

  const handleLivePack = useCallback((next: RoomPack) => {
    setLivePack(next);
    setSheetId(next.sheets[0]?.id ?? "");
  }, []);

  function handleAction(action: PackAction) {
    if (action.id === "generate-rfi") {
      const sheetQuery = sheet ? `?sheet=${encodeURIComponent(sheet.id)}` : "";
      router.push(`/pack/${displayedRequest}/rfi/new${sheetQuery}`);
      return;
    }
    if (action.id === "order-materials") {
      router.push(`/pack/${displayedRequest}/materials`);
      return;
    }
    const message = action.note ?? `${action.label} — coming soon`;
    console.info("[gcfieldlog] stub action", action);
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  if (!sheet) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
        This pack has no sheets.
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper">
      <AppHeader signedIn />
      <PackContextBar
        pack={displayedPack}
        sheet={sheet}
        requestId={displayedRequest}
        requestedRoom={requestedRoom}
        requestedJobName={requestedJobName}
        projectSlug={projectSlug}
        demoFallback={showingDemo}
        webhookAccepted={webhookAccepted}
        polling={polling}
        onPack={handleLivePack}
      />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex h-[48vh] min-h-[240px] flex-col sm:h-[52vh] lg:h-auto lg:w-[60%]">
          <SheetTabs
            sheets={displayedPack.sheets}
            activeId={sheet.id}
            onSelect={setSheetId}
          />
          <div className="min-h-0 flex-1">
            <SheetViewer pdfUrl={sheet.pdf} highlight={highlight} />
          </div>
        </section>
        <aside className="flex flex-col gap-5 overflow-y-auto border-t border-line bg-panel p-4 lg:w-[40%] lg:max-w-xl lg:border-t-0 lg:border-l">
          <ActionPanel actions={actions} onAction={handleAction} />
          <RfiList rfis={displayedPack.rfis} />
          <TakeoffCounts
            takeoff={displayedPack.takeoff}
            roomName={displayedPack.room.name}
          />
        </aside>
      </div>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-20 max-w-sm -translate-x-1/2 border border-accent bg-gline-ink px-4 py-2 text-sm text-paper shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function PackContextBar({
  pack,
  sheet,
  requestId,
  requestedRoom,
  requestedJobName,
  projectSlug,
  demoFallback,
  webhookAccepted,
  polling,
  onPack,
}: {
  pack: RoomPack;
  sheet: Sheet;
  requestId: string;
  requestedRoom?: string;
  requestedJobName?: string;
  projectSlug?: string;
  demoFallback?: boolean;
  webhookAccepted?: boolean;
  polling?: boolean;
  onPack: (pack: RoomPack) => void;
}) {
  const status =
    webhookAccepted && demoFallback
      ? "pending"
      : pack.status;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-primary px-4 py-2 text-secondary">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-medium sm:text-base">
          {pack.project.name}
          <span className="font-normal text-accent-2">
            {" "}
            · {pack.room.name}
            {requestedRoom ? ` · requested ${requestedRoom}` : ""}
          </span>
        </h1>
        {polling && projectSlug ? (
          <PackPollStub
            requestId={requestId}
            projectSlug={projectSlug}
            jobName={requestedJobName ?? pack.project.name}
            requestedRoom={requestedRoom}
            onPack={onPack}
          />
        ) : demoFallback ? (
          <p className="mt-0.5 text-xs text-tan">
            Demo pack (Maple Point). Local demo does not call the Procore
            webhook or poll Drive. Production POSTs then polls{" "}
            <span className="font-mono">{requestId}.json</span>.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span className="border border-line bg-panel-2 px-2 py-1 font-mono">
          {sheet.id} Rev {sheet.rev}
        </span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
      : status === "pending" || status === "accepted"
        ? "border-accent/50 bg-accent-deep/40 text-paper"
        : "border-line bg-panel text-muted";
  return (
    <span className={`border px-2 py-1 font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}

function SheetTabs({
  sheets,
  activeId,
  onSelect,
}: {
  sheets: Sheet[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-charcoal px-2 py-1">
      {sheets.map((sheet) => {
        const active = sheet.id === activeId;
        return (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelect(sheet.id)}
            className={`px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap uppercase ${
              active
                ? "bg-cta text-secondary"
                : "text-accent-2 hover:bg-panel-2 hover:text-secondary"
            }`}
          >
            {sheet.id}
            <span className="ml-1 opacity-70">Rev {sheet.rev}</span>
          </button>
        );
      })}
    </div>
  );
}
