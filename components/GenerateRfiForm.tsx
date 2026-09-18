"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { DraftToForemanSuccess } from "@/components/DraftToForemanSuccess";
import { DEMO_FOREMAN, DEMO_JOURNEYMAN } from "@/lib/crew";
import {
  newDraftId,
  saveRfiDraft,
  type DraftPhoto,
  type RfiDraftPacket,
} from "@/lib/fieldDrafts";
import { sheetRevisionLabel, type RoomPack } from "@/lib/pack";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-cta";

type Props = {
  pack: RoomPack;
  requestId: string;
  sheetQuery?: string;
  authorName: string;
  authorEmail: string;
};

export function GenerateRfiForm({
  pack,
  requestId,
  sheetQuery,
  authorName,
  authorEmail,
}: Props) {
  const sheets = pack.sheets;
  const queried = sheetQuery
    ? sheets.find((sheet) => sheet.id === sheetQuery)
    : undefined;
  const fallback =
    sheets.find((sheet) => sheet.id === pack.layout?.sheet) ??
    sheets.find((sheet) => sheet.id === pack.revision_stamp?.drawing) ??
    sheets[0];
  const initialSheet = queried ?? fallback;

  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [location, setLocation] = useState(
    pack.room.name || pack.layout?.locator || "",
  );
  const [sheetId, setSheetId] = useState(initialSheet?.id ?? "");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<RfiDraftPacket | null>(null);

  const selectedSheet =
    sheets.find((sheet) => sheet.id === sheetId) ?? initialSheet;
  const pin = selectedSheet
    ? sheetRevisionLabel(selectedSheet)
    : pack.revision_stamp
      ? `${pack.revision_stamp.drawing} Rev ${pack.revision_stamp.rev}`
      : "";

  const authorLabel = useMemo(() => {
    const name = authorName || DEMO_JOURNEYMAN.name;
    const email = authorEmail || DEMO_JOURNEYMAN.email;
    return `${name} · ${email}`;
  }, [authorEmail, authorName]);

  function onPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setPhotos((current) => {
      const next = [...current];
      for (const file of files) {
        if (next.some((item) => item.name === file.name && item.size === file.size)) {
          continue;
        }
        next.push({ name: file.name, size: file.size });
      }
      return next.slice(0, 8);
    });
    event.target.value = "";
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const nextSubject = subject.trim();
    const nextQuestion = question.trim();
    if (!nextSubject || !nextQuestion) {
      setError("Subject and question are required.");
      return;
    }
    setPending(true);
    setError(null);
    const packet: RfiDraftPacket = {
      id: newDraftId("rfi"),
      createdAt: new Date().toISOString(),
      requestId,
      jobName: pack.project.name,
      roomName: pack.room.name,
      roomNumber: pack.room.number,
      sheetId: selectedSheet?.id ?? pack.revision_stamp?.drawing ?? "",
      sheetRev: selectedSheet?.rev ?? pack.revision_stamp?.rev ?? "",
      authorName: authorName || DEMO_JOURNEYMAN.name,
      authorEmail: authorEmail || DEMO_JOURNEYMAN.email,
      subject: nextSubject,
      question: nextQuestion,
      location: location.trim() || pack.room.name,
      photos,
      sentTo: {
        name: DEMO_FOREMAN.name,
        role: DEMO_FOREMAN.role,
        email: DEMO_FOREMAN.email,
      },
      status: "draft_to_foreman",
      notProcore: true,
    };
    saveRfiDraft(packet);
    setSaved(packet);
    setPending(false);
  }

  if (saved) {
    return (
      <DraftToForemanSuccess
        heading="RFI draft sent"
        packetLabel="Draft RFI packet"
        jobName={saved.jobName}
        roomName={saved.location || saved.roomName}
        pin={
          saved.sheetId
            ? `${saved.sheetId} Rev ${saved.sheetRev || "?"}`
            : undefined
        }
        authorLabel={`${saved.authorName} · ${saved.authorEmail}`}
        backHref={`/pack/${requestId}`}
      >
        <div className="border border-line bg-ink p-3 text-sm">
          <p className="font-medium text-paper">{saved.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-muted">{saved.question}</p>
          {saved.photos.length ? (
            <ul className="mt-2 list-disc pl-4 text-xs text-metal">
              {saved.photos.map((photo) => (
                <li key={`${photo.name}-${photo.size}`}>{photo.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </DraftToForemanSuccess>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border border-line bg-panel p-4">
      <p className="text-sm text-muted">
        From <span className="text-paper">{authorLabel}</span>
        <span className="mt-1 block">
          To{" "}
          <span className="text-paper">
            {DEMO_FOREMAN.name} ({DEMO_FOREMAN.role})
          </span>
          . Draft only — never a Procore RFI.
        </span>
      </p>

      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Job
        <input readOnly value={pack.project.name} className={`${inputClass} text-tan`} />
      </label>

      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Location (room)
        <input
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          className={inputClass}
          placeholder="Electrical Closet 101"
        />
      </label>

      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Sheet / rev pin
        {sheets.length > 1 ? (
          <select
            value={sheetId}
            onChange={(event) => setSheetId(event.target.value)}
            className={inputClass}
          >
            {sheets.map((sheet) => (
              <option key={`${sheet.id}-${sheet.rev}`} value={sheet.id}>
                {sheetRevisionLabel(sheet)}
              </option>
            ))}
          </select>
        ) : (
          <input readOnly value={pin} className={`${inputClass} font-mono text-metal`} />
        )}
        {sheets.length > 1 ? (
          <span className="mt-1 block font-mono text-[11px] font-normal tracking-normal text-metal normal-case">
            Pin {pin}
          </span>
        ) : null}
      </label>

      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Subject
        <input
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className={inputClass}
          placeholder="Panel feed clarification"
        />
      </label>

      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Question / description
        <textarea
          required
          rows={5}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className={inputClass}
          placeholder="What is unclear on this sheet?"
        />
      </label>

      <div>
        <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
          Photo (optional)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onPhotos}
            className="mt-1 w-full text-sm text-paper file:mr-3 file:border file:border-cta file:bg-cta file:px-3 file:py-2 file:text-sm file:font-semibold file:text-secondary"
          />
        </label>
        {photos.length ? (
          <ul className="mt-2 space-y-1 text-sm text-metal">
            {photos.map((photo) => (
              <li
                key={`${photo.name}-${photo.size}`}
                className="flex items-center justify-between gap-2 border border-line bg-ink px-2 py-2"
              >
                <span className="truncate">{photo.name}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-accent uppercase"
                  onClick={() =>
                    setPhotos((current) =>
                      current.filter(
                        (item) =>
                          !(item.name === photo.name && item.size === photo.size),
                      ),
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">
            Names stay on this device for the demo. Files are not uploaded.
          </p>
        )}
      </div>

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
