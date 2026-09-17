"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { highlightForSheet } from "@/lib/highlight";
import { packActions, type PackAction, type RoomPack, type Sheet } from "@/lib/pack";
import { ActionPanel } from "./ActionPanel";
import { RfiList } from "./RfiList";
import { SheetViewer } from "./SheetViewer";
import { TakeoffCounts } from "./TakeoffCounts";

type Props = {
  pack: RoomPack;
};

export function RoomPackViewer({ pack }: Props) {
  const [sheetId, setSheetId] = useState(pack.sheets[0]?.id ?? "");
  const [toast, setToast] = useState<string | null>(null);
  const sheet = pack.sheets.find((item) => item.id === sheetId) ?? pack.sheets[0];
  const actions = useMemo(() => packActions(pack), [pack]);
  const highlight = sheet
    ? highlightForSheet(pack.layout, sheet.id)
    : null;

  function handleAction(action: PackAction) {
    const message =
      action.note ??
      (action.id === "generate-rfi"
        ? "Generate RFI — draft to foreman, not a Procore submit"
        : `${action.label} — coming soon`);
    console.info("[gcpullog] stub action", action);
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  if (!sheet) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-600">
        This pack has no sheets.
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-100 text-zinc-900">
      <TopBar pack={pack} sheet={sheet} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex h-[52vh] min-h-[280px] flex-col md:h-auto md:w-[60%]">
          <SheetTabs sheets={pack.sheets} activeId={sheet.id} onSelect={setSheetId} />
          <div className="min-h-0 flex-1">
            <SheetViewer pdfUrl={sheet.pdf} highlight={highlight} />
          </div>
        </section>
        <aside className="flex md:w-[40%] md:max-w-xl flex-col gap-5 overflow-y-auto border-t border-zinc-200 bg-zinc-50 p-4 md:border-t-0 md:border-l">
          <ActionPanel actions={actions} onAction={handleAction} />
          <RfiList rfis={pack.rfis} />
          <TakeoffCounts takeoff={pack.takeoff} roomName={pack.room.name} />
        </aside>
      </div>
      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-20 max-w-sm -translate-x-1/2 rounded-md bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function TopBar({ pack, sheet }: { pack: RoomPack; sheet: Sheet }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-white">
      <div className="min-w-0">
        <p className="text-[11px] font-medium tracking-wide text-amber-400 uppercase">
          gcpullog.com · room pack
        </p>
        <h1 className="truncate text-base font-semibold sm:text-lg">
          {pack.project.name}
          <span className="font-normal text-zinc-400"> · {pack.room.name}</span>
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono">
          {sheet.id} Rev {sheet.rev}
        </span>
        <StatusBadge status={pack.status} />
        <Link href="/" className="text-zinc-400 underline-offset-2 hover:text-white hover:underline">
          Demo
        </Link>
      </div>
    </header>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
      : status === "pending"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
        : "bg-zinc-800 text-zinc-300 border-zinc-600";
  return (
    <span className={`rounded border px-2 py-1 font-medium capitalize ${tone}`}>
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
    <div className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 px-2 py-1">
      {sheets.map((sheet) => {
        const active = sheet.id === activeId;
        return (
          <button
            key={sheet.id}
            type="button"
            onClick={() => onSelect(sheet.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-200"
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
