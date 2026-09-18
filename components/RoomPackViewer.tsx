"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { highlightForSheet } from "@/lib/highlight";
import {
  formatPulledAt,
  packActions,
  sheetRevisionLabel,
  sheetTitle,
  type PackAction,
  type RoomPack,
  type Sheet,
} from "@/lib/pack";
import { layoutSheetId, resolveSheetPdf } from "@/lib/packNormalize";
import { sheetKindLabel, splitPackSheets } from "@/lib/sheetOrder";
import { viewerSheetPdfSrc } from "@/lib/sheetPdfUrl";
import { ActionPanel } from "./ActionPanel";
import { AppHeader } from "./AppHeader";
import { PackLiveReload } from "./PackLiveReload";
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
  supabaseConfigured?: boolean;
  source?: "supabase" | "local" | "none";
  procoreLinked?: boolean;
};

export function RoomPackViewer({
  pack,
  requestId,
  requestedRoom,
  requestedJobName,
  projectSlug,
  demoFallback,
  supabaseConfigured,
  source,
  procoreLinked = false,
}: Props) {
  const router = useRouter();
  const [livePack, setLivePack] = useState<RoomPack | null>(null);
  const displayedPack = livePack ?? pack;
  const [toast, setToast] = useState<string | null>(null);
  const { primary, rest } = useMemo(
    () =>
      splitPackSheets(
        displayedPack.sheets,
        layoutSheetId(displayedPack.layout),
      ),
    [displayedPack],
  );
  const actions = useMemo(() => packActions(displayedPack), [displayedPack]);
  const displayedRequest = requestId ?? displayedPack.request_id;
  const primaryHighlight = primary
    ? highlightForSheet(displayedPack.layout, primary.id, undefined, {
        primarySheetId: primary.id,
      })
    : null;

  const handleLivePack = useCallback((next: RoomPack) => {
    setLivePack(next);
  }, []);

  function handleAction(action: PackAction) {
    if (action.id === "generate-rfi") {
      const sheetQuery = primary
        ? `?sheet=${encodeURIComponent(primary.id)}`
        : "";
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

  if (!primary) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
        This pack has no sheets.
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper">
      <AppHeader signedIn procoreLinked={procoreLinked} />
      <PackContextBar
        pack={displayedPack}
        sheet={primary}
        requestId={displayedRequest}
        requestedRoom={requestedRoom}
        requestedJobName={requestedJobName}
        projectSlug={projectSlug}
        demoFallback={Boolean(demoFallback)}
        supabaseConfigured={Boolean(supabaseConfigured)}
        source={source}
        procoreLinked={procoreLinked}
        onPack={handleLivePack}
      />
      <JumpNav primary={primary} rest={rest} />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 sm:px-4 lg:px-6">
        <section id="floor-plan" className="flex flex-col">
          <SheetSectionHeader
            kind={sheetKindLabel(primary, true)}
            sheet={primary}
            roomLabel={roomCaption(displayedPack)}
          />
          <div className="h-[min(64vw,calc(100svh-12.5rem))] min-h-[220px] border border-line md:h-[calc(100svh-12.5rem)]">
            <SheetViewer
              pdfUrl={viewerSheetPdfSrc({
                requestId: displayedRequest,
                sheetId: primary.id,
                pdfUrl: resolveSheetPdf(primary),
              })}
              layout={displayedPack.layout}
              sheetId={primary.id}
              sheetRev={primary.rev}
              primarySheetId={primary.id}
              highlight={primaryHighlight}
              requestId={displayedRequest}
              roomName={displayedPack.room.name}
              roomNumber={displayedPack.room.number}
            />
          </div>
        </section>

        {rest.length > 0 ? (
          <section id="detail-sheets" className="grid gap-4 md:grid-cols-2">
            {rest.map((sheet) => (
              <article
                key={`${sheet.id}-${sheet.rev}`}
                id={`sheet-${cssId(sheet.id)}`}
                className="flex flex-col"
              >
                <SheetSectionHeader
                  kind={sheetKindLabel(sheet, false)}
                  sheet={sheet}
                />
                <div className="h-[min(56vw,42vh)] min-h-[200px] border border-line sm:h-[42vh] md:h-[48vh]">
                  <SheetViewer
                    pdfUrl={viewerSheetPdfSrc({
                      requestId: displayedRequest,
                      sheetId: sheet.id,
                      pdfUrl: resolveSheetPdf(sheet),
                    })}
                    layout={displayedPack.layout}
                    sheetId={sheet.id}
                    sheetRev={sheet.rev}
                    primarySheetId={primary.id}
                    highlight={highlightForSheet(
                      displayedPack.layout,
                      sheet.id,
                      undefined,
                      { primarySheetId: primary.id },
                    )}
                    requestId={displayedRequest}
                    roomName={displayedPack.room.name}
                    roomNumber={displayedPack.room.number}
                  />
                </div>
              </article>
            ))}
          </section>
        ) : null}

        <div
          id="rfis"
          className="grid gap-5 border-t border-line pt-4 pb-8 lg:grid-cols-2"
        >
          <RfiList rfis={displayedPack.rfis} />
          <div className="flex flex-col gap-5">
            <ActionPanel
              actions={actions}
              onAction={handleAction}
              procoreLinked={procoreLinked}
            />
            <TakeoffCounts
              takeoff={displayedPack.takeoff}
              roomName={displayedPack.room.name}
            />
          </div>
        </div>
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

function roomCaption(pack: RoomPack): string {
  const number = pack.room.number ? ` ${pack.room.number}` : "";
  return `Room${number} · ${pack.room.name} · red box around walls`;
}

function cssId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function JumpNav({
  primary,
  rest,
}: {
  primary: Sheet;
  rest: Sheet[];
}) {
  return (
    <nav
      aria-label="Pack sections"
      className="flex gap-1 overflow-x-auto border-b border-line bg-primary px-2 py-1 sm:px-4"
    >
      <JumpLink targetId="floor-plan" label="Floor plan" hint={sheetRevisionLabel(primary)} />
      {rest.map((sheet) => (
        <JumpLink
          key={sheet.id}
          targetId={`sheet-${cssId(sheet.id)}`}
          label={sheetKindLabel(sheet, false)}
          hint={sheetRevisionLabel(sheet)}
        />
      ))}
      <JumpLink targetId="rfis" label="RFIs" />
    </nav>
  );
}

function JumpLink({
  targetId,
  label,
  hint,
}: {
  targetId: string;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        document.getElementById(targetId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }
      className="shrink-0 px-3 py-1.5 text-xs font-semibold tracking-wide whitespace-nowrap text-accent-2 uppercase hover:bg-panel-2 hover:text-secondary"
    >
      {label}
      {hint ? (
        <span className="ml-1 font-mono font-normal normal-case text-tan">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function SheetSectionHeader({
  kind,
  sheet,
  roomLabel,
}: {
  kind: string;
  sheet: Sheet;
  roomLabel?: string;
}) {
  const title = sheetTitle(sheet);
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line bg-charcoal px-3 py-2">
      <div className="min-w-0">
        <p className="font-display text-[10px] tracking-[0.18em] text-muted uppercase">
          {kind}
        </p>
        <h2 className="truncate text-sm font-medium text-paper sm:text-base">
          {title === sheet.id ? sheetRevisionLabel(sheet) : title}
        </h2>
        {roomLabel ? (
          <p className="text-[11px] text-tan">{roomLabel}</p>
        ) : null}
      </div>
      <span className="border border-cta/50 bg-panel-2 px-2 py-1 font-mono text-xs">
        {sheetRevisionLabel(sheet)}
      </span>
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
  supabaseConfigured,
  source,
  procoreLinked,
  onPack,
}: {
  pack: RoomPack;
  sheet: Sheet;
  requestId: string;
  requestedRoom?: string;
  requestedJobName?: string;
  projectSlug?: string;
  demoFallback?: boolean;
  supabaseConfigured: boolean;
  source?: "supabase" | "local" | "none";
  procoreLinked: boolean;
  onPack: (pack: RoomPack) => void;
}) {
  const stamp = sheetRevisionLabel(sheet);
  const pulled = formatPulledAt(pack.pulled_at);
  const primary =
    pack.revision_stamp &&
    sheetRevisionLabel({
      id: pack.revision_stamp.drawing,
      rev: pack.revision_stamp.rev,
    });

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
        <PackLiveReload
          requestId={requestId}
          projectSlug={projectSlug}
          requestedRoom={requestedRoom}
          procoreLinked={procoreLinked}
          supabaseConfigured={supabaseConfigured}
          demoFallback={Boolean(demoFallback)}
          onPack={onPack}
        />
        {requestedJobName && requestedJobName !== pack.project.name ? (
          <p className="mt-0.5 text-xs text-tan">
            Requested job {requestedJobName}
            {source === "local" ? " · showing Maple Point demo" : ""}.
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span className="border border-cta/50 bg-panel-2 px-2 py-1 font-mono">
          {stamp}
        </span>
        {primary && primary !== stamp ? (
          <span className="border border-line bg-panel px-2 py-1 font-mono text-metal">
            Pack {primary}
          </span>
        ) : null}
        {pulled ? (
          <span className="border border-line bg-panel px-2 py-1 text-tan">
            Pulled {pulled}
          </span>
        ) : null}
        <StatusBadge
          status={demoFallback ? (supabaseConfigured ? "pending" : "demo") : pack.status}
        />
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
