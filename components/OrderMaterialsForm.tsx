"use client";

import { type FormEvent, useMemo, useState } from "react";
import { DictationButton } from "@/components/DictationButton";
import { DraftToForemanSuccess } from "@/components/DraftToForemanSuccess";
import { VoiceSetupNote } from "@/components/VoiceSetupNote";
import { DEMO_FOREMAN, DEMO_JOURNEYMAN } from "@/lib/crew";
import { newDraftId, saveMaterialDraft, type MaterialOrderDraft } from "@/lib/fieldDrafts";
import {
  applyMaterialOps,
  parseMaterialsDictation,
  type MaterialLineState,
} from "@/lib/materialsDictation";
import { takeoffLineItems, type RoomPack, type Takeoff } from "@/lib/pack";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-cta";

type LineState = MaterialLineState;

type Props = {
  pack: RoomPack;
  requestId: string;
  takeoff?: Takeoff | null;
  authorName: string;
  authorEmail: string;
};

function linesFromTakeoff(takeoff?: Takeoff | null): LineState[] {
  return takeoffLineItems(takeoff).map((item) => ({
    id: item.id,
    type: item.type,
    qty: item.qty,
    intent: "order" as const,
    room: item.room,
    sheet: item.sheet,
    included: true,
  }));
}

export function OrderMaterialsForm({
  pack,
  requestId,
  takeoff,
  authorName,
  authorEmail,
}: Props) {
  const [lines, setLines] = useState<LineState[]>(() => linesFromTakeoff(takeoff));
  const [note, setNote] = useState("");
  const [customType, setCustomType] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<MaterialOrderDraft | null>(null);

  const authorLabel = useMemo(() => {
    const name = authorName || DEMO_JOURNEYMAN.name;
    const email = authorEmail || DEMO_JOURNEYMAN.email;
    return `${name} · ${email}`;
  }, [authorEmail, authorName]);

  const pin = pack.revision_stamp
    ? `${pack.revision_stamp.drawing} Rev ${pack.revision_stamp.rev}`
    : pack.sheets[0]
      ? `${pack.sheets[0].id} Rev ${pack.sheets[0].rev}`
      : undefined;

  function updateLine(id: string, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    );
  }

  function addCustomLine() {
    const type = customType.trim();
    const qty = Number.parseInt(customQty, 10);
    if (!type || !Number.isFinite(qty) || qty < 1) {
      setError("Add a material name and qty of 1 or more.");
      return;
    }
    setError(null);
    setLines((current) => [
      ...current,
      {
        id: newDraftId("line"),
        type,
        qty,
        intent: "order",
        room: pack.room.name,
        included: true,
      },
    ]);
    setCustomType("");
    setCustomQty("1");
  }

  function onDictate(text: string) {
    const ops = parseMaterialsDictation(text);
    if (!ops.length) {
      setNote((current) => (current ? `${current} ${text.trim()}` : text.trim()));
      setError(null);
      return;
    }
    const applied = applyMaterialOps(lines, ops, pack.room.name);
    setLines(applied.lines);
    if (applied.note) {
      setNote((current) => (current ? `${current} ${applied.note}` : applied.note ?? ""));
    }
    setError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const selected = lines.filter((line) => line.included && line.qty > 0);
    if (!selected.length) {
      setError("Mark at least one item with qty.");
      return;
    }
    setPending(true);
    setError(null);
    const draft: MaterialOrderDraft = {
      id: newDraftId("po"),
      createdAt: new Date().toISOString(),
      requestId,
      jobName: pack.project.name,
      roomName: pack.room.name,
      sheetId: pack.revision_stamp?.drawing ?? pack.sheets[0]?.id,
      sheetRev: pack.revision_stamp?.rev ?? pack.sheets[0]?.rev,
      authorName: authorName || DEMO_JOURNEYMAN.name,
      authorEmail: authorEmail || DEMO_JOURNEYMAN.email,
      note: note.trim(),
      lines: selected.map((line) => ({
        id: line.id,
        type: line.type,
        qty: line.qty,
        intent: line.intent,
        room: line.room,
        sheet: line.sheet,
      })),
      sentTo: {
        name: DEMO_FOREMAN.name,
        role: DEMO_FOREMAN.role,
        email: DEMO_FOREMAN.email,
      },
      status: "draft_to_foreman",
      notProcore: true,
    };
    saveMaterialDraft(draft);
    setSaved(draft);
    setPending(false);
  }

  if (saved) {
    const orderLines = saved.lines.filter((line) => line.intent === "order");
    const neededLines = saved.lines.filter((line) => line.intent === "needed");
    return (
      <DraftToForemanSuccess
        heading="Order draft sent"
        packetLabel="Material order draft"
        jobName={saved.jobName}
        roomName={saved.roomName}
        pin={
          saved.sheetId
            ? `${saved.sheetId} Rev ${saved.sheetRev || "?"}`
            : pin
        }
        authorLabel={`${saved.authorName} · ${saved.authorEmail}`}
        backHref={`/pack/${requestId}`}
      >
        <div className="space-y-3 border border-line bg-ink p-3 text-sm">
          {orderLines.length ? (
            <div>
              <p className="text-xs tracking-wide text-muted uppercase">Order</p>
              <ul className="mt-1 space-y-1">
                {orderLines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-2">
                    <span className="text-paper">{line.type}</span>
                    <span className="font-mono text-metal">{line.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {neededLines.length ? (
            <div>
              <p className="text-xs tracking-wide text-muted uppercase">Needed</p>
              <ul className="mt-1 space-y-1">
                {neededLines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-2">
                    <span className="text-paper">{line.type}</span>
                    <span className="font-mono text-metal">{line.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {saved.note ? (
            <p className="text-muted">Note: {saved.note}</p>
          ) : null}
        </div>
      </DraftToForemanSuccess>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">
        Grab / order list from takeoff. From{" "}
        <span className="text-paper">{authorLabel}</span> to{" "}
        <span className="text-paper">
          {DEMO_FOREMAN.name} ({DEMO_FOREMAN.role})
        </span>
        . Draft only — never a Procore PO.
      </p>

      <div className="border border-line bg-panel p-4 text-sm">
        <p className="font-medium text-paper">{pack.project.name}</p>
        <p className="text-muted">{pack.room.name}</p>
        {pin ? <p className="font-mono text-xs text-metal">{pin}</p> : null}
        {takeoff?.scope ? (
          <p className="mt-1 text-xs text-muted">{takeoff.scope}</p>
        ) : null}
      </div>

      <div className="space-y-2 border border-line bg-panel p-3">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Hands-free
        </p>
        <DictationButton
          onTranscript={onDictate}
          disabled={pending}
          label="Dictate items"
          hint='Say “add 4 junction boxes”, “order 2 duplex receptacles”, “set panelboard to 1”, or “note need by Friday”.'
        />
        <VoiceSetupNote />
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted">
          No takeoff counts on this pack. Add a line below.
        </p>
      ) : (
        <ul className="space-y-3">
          {lines.map((line) => (
            <li key={line.id} className="border border-line bg-panel p-3">
              <div className="flex items-start justify-between gap-2">
                <label className="flex min-w-0 items-start gap-2 text-sm text-paper">
                  <input
                    type="checkbox"
                    checked={line.included}
                    onChange={(event) =>
                      updateLine(line.id, { included: event.target.checked })
                    }
                    className="mt-1 size-4 shrink-0"
                  />
                  <span>
                    <span className="font-medium">{line.type}</span>
                    {line.room ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {line.room}
                        {line.sheet ? ` · ${line.sheet}` : ""}
                      </span>
                    ) : null}
                  </span>
                </label>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="min-h-10 min-w-10 border border-line bg-ink text-lg text-paper"
                    onClick={() =>
                      updateLine(line.id, { qty: Math.max(0, line.qty - 1) })
                    }
                    aria-label={`Decrease ${line.type}`}
                  >
                    −
                  </button>
                  <input
                    inputMode="numeric"
                    value={line.qty}
                    onChange={(event) => {
                      const qty = Number.parseInt(event.target.value, 10);
                      updateLine(line.id, {
                        qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
                      });
                    }}
                    className="h-10 w-14 border border-line bg-ink text-center font-mono text-base text-paper"
                    aria-label={`${line.type} quantity`}
                  />
                  <button
                    type="button"
                    className="min-h-10 min-w-10 border border-line bg-ink text-lg text-paper"
                    onClick={() => updateLine(line.id, { qty: line.qty + 1 })}
                    aria-label={`Increase ${line.type}`}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <IntentButton
                  label="Needed"
                  active={line.intent === "needed"}
                  onClick={() => updateLine(line.id, { intent: "needed" })}
                />
                <IntentButton
                  label="Order"
                  active={line.intent === "order"}
                  onClick={() => updateLine(line.id, { intent: "order" })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border border-line bg-panel p-3">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Add item
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={customType}
            onChange={(event) => setCustomType(event.target.value)}
            className={`${inputClass} mt-0 sm:flex-1`}
            placeholder="Material"
          />
          <input
            inputMode="numeric"
            value={customQty}
            onChange={(event) => setCustomQty(event.target.value)}
            className={`${inputClass} mt-0 sm:w-20`}
            aria-label="Custom quantity"
          />
          <button
            type="button"
            onClick={addCustomLine}
            className="min-h-12 border border-cta px-4 text-sm font-semibold text-secondary uppercase"
          >
            Add
          </button>
        </div>
      </div>

      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Note
        <textarea
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={inputClass}
          placeholder="Need by Friday / shop will grab"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full bg-cta px-4 py-3 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Sending draft…" : `Send draft to ${DEMO_FOREMAN.name}`}
      </button>
    </form>
  );
}

function IntentButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 text-xs font-semibold tracking-wide uppercase ${
        active
          ? "bg-cta text-secondary"
          : "border border-line bg-ink text-muted"
      }`}
    >
      {label}
    </button>
  );
}
