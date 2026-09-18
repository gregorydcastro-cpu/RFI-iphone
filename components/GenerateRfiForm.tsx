"use client";

import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";
import { DictationButton } from "@/components/DictationButton";
import { DraftToForemanSuccess } from "@/components/DraftToForemanSuccess";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { VoiceSetupNote } from "@/components/VoiceSetupNote";
import { DEMO_FOREMAN, DEMO_JOURNEYMAN } from "@/lib/crew";
import {
  newUuid,
  saveRfiDraft,
  type DraftPhoto,
  type RfiDraftPacket,
  type RfiMarkupRef,
} from "@/lib/fieldDrafts";
import {
  buildMarkupRfiPrefill,
  loadLocalOverlay,
  markupKindLabel,
  readMarkupRfiPrefill,
} from "@/lib/markup";
import { sheetRevisionLabel, type RoomPack } from "@/lib/pack";
import { parseRfiDictation, rfiSpeakText } from "@/lib/rfiDictation";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-cta";

const MAX_PHOTO_BYTES = 3_500_000;

type Props = {
  pack: RoomPack;
  requestId: string;
  sheetQuery?: string;
  markupQuery?: string;
  markupItemQuery?: string;
  initialSubject?: string;
  initialQuestion?: string;
  initialLocation?: string;
  markupKindQuery?: string;
  authorName: string;
  authorEmail: string;
};

export function GenerateRfiForm({
  pack,
  requestId,
  sheetQuery,
  markupQuery,
  markupItemQuery,
  initialSubject,
  initialQuestion,
  initialLocation,
  markupKindQuery,
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

  const [subject, setSubject] = useState(initialSubject ?? "");
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [location, setLocation] = useState(
    initialLocation || pack.room.name || pack.layout?.locator || "",
  );
  const [sheetId, setSheetId] = useState(initialSheet?.id ?? "");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
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

  const draftSpeak = rfiSpeakText({
    title: subject || "Untitled RFI",
    status: "draft",
    question: question || undefined,
    location: location || undefined,
    draftToForeman: true,
  });

  function onPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setPhotoError(null);
    void (async () => {
      const added: DraftPhoto[] = [];
      for (const file of files) {
        if (file.size > MAX_PHOTO_BYTES) {
          setPhotoError("Photo is too large for this draft (max ~3.5 MB).");
          continue;
        }
        const dataUrl = await readFileDataUrl(file);
        added.push({
          name: file.name || "phone-photo.jpg",
          size: file.size,
          mime: file.type,
          dataUrl,
        });
      }
      if (!added.length) return;
      setPhotos((current) => {
        const next = [...current];
        for (const photo of added) {
          if (next.some((item) => item.name === photo.name && item.size === photo.size)) {
            continue;
          }
          next.push(photo);
        }
        return next.slice(0, 8);
      });
    })();
  }

  async function submitDraft(fields: {
    subject: string;
    question: string;
    location: string;
  }) {
    if (pending) return;
    const nextSubject = fields.subject.trim();
    const nextQuestion = fields.question.trim();
    if (!nextSubject || !nextQuestion) {
      setError("Subject and question are required.");
      return;
    }
    setPending(true);
    setError(null);

    const sheetPinId = selectedSheet?.id ?? pack.revision_stamp?.drawing ?? "";
    const locationValue = fields.location.trim() || pack.room.name;
    const resolvedMarkup = resolveMarkupAttachment({
      requestId,
      pack,
      sheetQuery: sheetId || sheetQuery,
      markupQuery,
      markupItemQuery,
    });
    let packet: RfiDraftPacket = {
      id: newUuid(),
      createdAt: new Date().toISOString(),
      requestId,
      jobName: pack.project.name,
      roomName: pack.room.name,
      roomNumber: pack.room.number,
      sheetId: sheetPinId,
      sheetRev: selectedSheet?.rev ?? pack.revision_stamp?.rev ?? "",
      authorName: authorName || DEMO_JOURNEYMAN.name,
      authorEmail: authorEmail || DEMO_JOURNEYMAN.email,
      subject: nextSubject,
      question: nextQuestion,
      location: locationValue,
      photos,
      markupId: resolvedMarkup?.overlayId ?? markupQuery ?? null,
      markupItemId: resolvedMarkup?.itemId ?? markupItemQuery ?? null,
      markupRef: resolvedMarkup,
      sentTo: {
        name: DEMO_FOREMAN.name,
        role: DEMO_FOREMAN.role,
        email: DEMO_FOREMAN.email,
      },
      status: "draft",
      notProcore: true,
      persisted: false,
      storage: "local",
    };

    try {
      const response = await fetch("/api/rfis", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: nextSubject,
          description: nextQuestion,
          location: locationValue,
          sheet_id: sheetPinId || null,
          markup_id: resolvedMarkup?.overlayId ?? markupQuery ?? null,
          status: "draft",
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        persisted?: boolean;
        storage?: RfiDraftPacket["storage"];
        row?: { id?: string; created_at?: string; status?: "draft" | "ready" };
        sentTo?: RfiDraftPacket["sentTo"];
      };
      if (response.ok && data.ok && data.row?.id) {
        packet = {
          ...packet,
          id: data.row.id,
          createdAt: data.row.created_at ?? packet.createdAt,
          status: data.row.status ?? "draft",
          persisted: Boolean(data.persisted),
          storage: data.storage ?? (data.persisted ? "supabase" : "local"),
          sentTo: data.sentTo ?? packet.sentTo,
        };
      }
    } catch {
      // localStorage still holds the draft for the demo
    }

    saveRfiDraft(packet);
    setSaved(packet);
    setPending(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitDraft({ subject, question, location });
  }

  async function onDictate(text: string) {
    const parsed = parseRfiDictation(text);
    const nextSubject = parsed.subject || subject;
    const nextQuestion = parsed.question || question;
    const nextLocation = parsed.location || location;
    if (parsed.subject) setSubject(parsed.subject);
    if (parsed.question) setQuestion(parsed.question);
    if (parsed.location) setLocation(parsed.location);
    setError(null);
    if (parsed.send) {
      await submitDraft({
        subject: nextSubject,
        question: nextQuestion,
        location: nextLocation,
      });
    }
  }

  if (saved) {
    const confirmationSpeak = rfiSpeakText({
      title: saved.subject,
      status: saved.status,
      question: saved.question,
      location: saved.location,
      draftToForeman: true,
    });
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
        speakId={`rfi-draft-${saved.id}`}
        speakText={confirmationSpeak}
      >
        <div className="border border-line bg-ink p-3 text-sm">
          <p className="font-medium text-paper">{saved.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-muted">{saved.question}</p>
          {saved.markupRef ? (
            <p className="mt-2 text-xs text-tan">
              Vector overlay {markupKindLabel(saved.markupRef.kind)} on{" "}
              {saved.markupRef.sheetId}
              {saved.markupRef.sheetRev ? ` Rev ${saved.markupRef.sheetRev}` : ""}.
            </p>
          ) : null}
          {saved.photos.length ? (
            <ul className="mt-2 space-y-2">
              {saved.photos.map((photo) => (
                <li key={`${photo.name}-${photo.size}`} className="text-xs text-metal">
                  {photo.dataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.dataUrl}
                      alt={photo.name}
                      className="mb-1 max-h-32 border border-line"
                    />
                  ) : null}
                  {photo.name}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Status {saved.status}
            {saved.persisted
              ? " · saved on rfis"
              : " · saved on this device"}
            . Not a Procore submit.
          </p>
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

      {markupQuery || markupKindQuery ? (
        <div className="border border-cta/50 bg-ink p-3 text-sm text-muted">
          <p className="font-semibold tracking-wide text-cta uppercase">
            From sheet markup
          </p>
          <p className="mt-1 text-paper">
            {markupKindLabel(
              markupKindQuery === "circle" ||
                markupKindQuery === "box" ||
                markupKindQuery === "arrow" ||
                markupKindQuery === "text"
                ? markupKindQuery
                : "box",
            )}{" "}
            on {pin}. Vector overlay stays attached to this draft.
          </p>
        </div>
      ) : null}

      <div className="space-y-2 border border-line bg-ink p-3">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Hands-free
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <DictationButton
            onTranscript={onDictate}
            disabled={pending}
            label="Dictate RFI"
            hint="Tap mic, speak subject and question, tap again. Say a room to fill location. Say “send draft” to send to Pat Nguyen."
          />
          <ReadAloudButton
            id={`rfi-form-${requestId}`}
            text={draftSpeak}
            disabled={!subject && !question}
          />
        </div>
        <VoiceSetupNote />
      </div>

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
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">
          Phone photo (optional)
        </p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <label className="flex min-h-12 cursor-pointer items-center justify-center border border-cta bg-cta px-3 text-center text-xs font-semibold tracking-wide text-secondary uppercase">
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPhotos}
              className="sr-only"
            />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center justify-center border border-line bg-panel-2 px-3 text-center text-xs font-semibold tracking-wide text-paper uppercase">
            Choose photo
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onPhotos}
              className="sr-only"
            />
          </label>
        </div>
        {photoError ? (
          <p role="alert" className="mt-1 text-sm text-cta">
            {photoError}
          </p>
        ) : null}
        {photos.length ? (
          <ul className="mt-2 space-y-2 text-sm text-metal">
            {photos.map((photo) => (
              <li
                key={`${photo.name}-${photo.size}`}
                className="flex items-center gap-2 border border-line bg-ink px-2 py-2"
              >
                {photo.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.dataUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 object-cover"
                  />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{photo.name}</span>
                <button
                  type="button"
                  className="min-h-10 shrink-0 px-2 text-xs text-accent uppercase"
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
            Photo stays on this draft as a data URL. Not uploaded to Procore.
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

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read photo"));
    reader.readAsDataURL(file);
  });
}

function resolveMarkupAttachment(input: {
  requestId: string;
  pack: RoomPack;
  sheetQuery?: string;
  markupQuery?: string;
  markupItemQuery?: string;
}): RfiMarkupRef | null {
  const fromSession = readMarkupRfiPrefill(input.requestId);
  if (fromSession) {
    return {
      overlayId: fromSession.overlayId,
      itemId: fromSession.itemId,
      sheetId: fromSession.sheetId,
      sheetRev: fromSession.sheetRev,
      kind: fromSession.kind,
      vectors: fromSession.vectors,
    };
  }
  if (!input.sheetQuery || !input.markupItemQuery) return null;
  const overlay = loadLocalOverlay(input.requestId, input.sheetQuery);
  if (!overlay) return null;
  const item = overlay.vectors.items.find((entry) => entry.id === input.markupItemQuery);
  if (!item) return null;
  const sheet = input.pack.sheets.find((entry) => entry.id === input.sheetQuery);
  const prefill = buildMarkupRfiPrefill({
    requestId: input.requestId,
    overlayId: input.markupQuery || overlay.id,
    item,
    sheetId: input.sheetQuery,
    sheetRev: sheet?.rev ?? "",
    roomName: input.pack.room.name,
    roomNumber: input.pack.room.number,
    vectors: overlay.vectors,
  });
  return {
    overlayId: prefill.overlayId,
    itemId: prefill.itemId,
    sheetId: prefill.sheetId,
    sheetRev: prefill.sheetRev,
    kind: prefill.kind,
    vectors: prefill.vectors,
  };
}
