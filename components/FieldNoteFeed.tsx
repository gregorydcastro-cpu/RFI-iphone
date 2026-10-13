"use client";

import { useMemo, useState } from "react";
import { FieldFailureCard } from "@/components/FieldFailureCard";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { SafetyNoteBanner } from "@/components/SafetyNoteBanner";
import { DEMO_NOTE_IDS } from "@/lib/fieldNotesDemo";
import {
  HAZARD_LABEL,
  HAZARD_TYPES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  createAlertSummary,
  feedSpeak,
  fieldNoteSpeak,
  isHazardType,
  isNoteStatus,
  openSafetyBanner,
  visibleFieldNotes,
  type FieldNote,
  type HazardType,
  type NoteSeverity,
  type NoteStatus,
} from "@/lib/fieldNotes";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-cta";

type Props = {
  jobSlug: string;
  jobName: string;
  notes: FieldNote[];
  canWrite: boolean;
};

type FilterSeverity = NoteSeverity | "all";
type FilterStatus = NoteStatus | "all";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function FieldNoteFeed({ jobSlug, jobName, notes, canWrite }: Props) {
  const [items, setItems] = useState(notes);
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState("");
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>("all");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [body, setBody] = useState("");
  const [noteRoom, setNoteRoom] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<NoteSeverity>("routine");
  const [hazard, setHazard] = useState<HazardType | "">("");
  const [symptoms, setSymptoms] = useState(false);
  const [stopWork, setStopWork] = useState(false);
  const [photoDraft, setPhotoDraft] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downgradeId, setDowngradeId] = useState<string | null>(null);
  const [downgradeReason, setDowngradeReason] = useState("");
  const [downgradeTo, setDowngradeTo] = useState<Exclude<NoteSeverity, "safety">>("routine");
  const [resolutions, setResolutions] = useState<Record<string, string>>({});

  const banner = openSafetyBanner(items);
  const filtered = severityFilter !== "all" || statusFilter !== "all" || query.trim() || room.trim();
  const visible = useMemo(
    () =>
      visibleFieldNotes(items, {
        query,
        room,
        severity: severityFilter,
        status: statusFilter,
      }),
    [items, query, room, severityFilter, statusFilter],
  );
  const spoken = feedSpeak(visible, banner?.text ?? null);

  function replaceNote(note: FieldNote) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === note.id);
      if (index === -1) return [note, ...current];
      const next = [...current];
      next[index] = note;
      return next;
    });
  }

  async function postNote() {
    setSaving(true);
    setError(null);
    setRetry(null);
    try {
      const response = await fetch("/api/field-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_slug: jobSlug,
          body,
          room: noteRoom,
          location,
          severity,
          hazard_type: severity === "safety" ? hazard : null,
          symptoms_reported: severity === "safety" ? symptoms : false,
          stop_work: severity === "safety" ? stopWork : false,
          photos,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        note?: FieldNote;
      } | null;
      if (!response.ok || !data?.ok || !data.note) {
        setError({
          title: "Note did not save",
          message: data?.error?.trim() || "Tap Retry.",
        });
        setRetry(() => () => void postNote());
        return;
      }
      replaceNote(data.note);
      setBody("");
      setNoteRoom("");
      setLocation("");
      setPhotos([]);
      setPhotoDraft("");
      setSymptoms(false);
      setStopWork(false);
      setHazard("");
      setSeverity("routine");
      setNotice(createAlertSummary(data.note) ?? "Note saved.");
    } catch {
      setError({ title: "Note did not save", message: "No connection. Tap Retry." });
      setRetry(() => () => void postNote());
    } finally {
      setSaving(false);
    }
  }

  async function patchNote(id: string, patch: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setRetry(null);
    try {
      const response = await fetch(`/api/field-notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        note?: FieldNote;
        alerts?: { summary?: string | null };
      } | null;
      if (!response.ok || !data?.ok || !data.note) {
        setError({
          title: "Note did not save",
          message: data?.error?.trim() || "Tap Retry.",
        });
        setRetry(() => () => void patchNote(id, patch));
        return;
      }
      replaceNote(data.note);
      setNotice(data.alerts?.summary ?? "Note updated.");
      if (downgradeId === id) {
        setDowngradeId(null);
        setDowngradeReason("");
      }
    } catch {
      setError({ title: "Note did not save", message: "No connection. Tap Retry." });
      setRetry(() => () => void patchNote(id, patch));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {banner ? <SafetyNoteBanner text={banner.text} /> : null}
      <div className="flex flex-col gap-3 border border-line bg-panel p-4">
        <label className="text-sm font-semibold text-paper" htmlFor="note-search">
          Search
          <input
            id="note-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-paper" htmlFor="note-room-filter">
          Room
          <input
            id="note-room-filter"
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            placeholder="Room"
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["all", "routine", "priority", "safety"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeverityFilter(value)}
              className={`min-h-12 border px-3 text-sm font-semibold uppercase ${
                severityFilter === value
                  ? "border-cta bg-cta text-secondary"
                  : "border-line text-paper"
              }`}
            >
              {value === "all" ? "All" : SEVERITY_LABEL[value]}
            </button>
          ))}
        </div>
        <label className="text-sm font-semibold text-paper" htmlFor="note-status-filter">
          Status
          <select
            id="note-status-filter"
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "all" || isNoteStatus(value)) setStatusFilter(value);
            }}
            className={inputClass}
          >
            <option value="all">All</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {filtered ? (
          <p className="text-sm text-tan">
            Safety notes that are not closed stay on this list.
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl tracking-wide text-paper">Notes</h2>
        <ReadAloudButton id="field-notes-feed" text={spoken} label="Hear this" />
      </div>

      {visible.length === 0 ? (
        <p className="text-base text-tan" role="status">
          No notes on this job yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((note) => {
            const safetyOpen = note.severity === "safety" && note.status !== "closed";
            return (
              <li
                key={note.id}
                className={`border bg-panel p-4 ${
                  note.severity === "safety" && note.status === "open"
                    ? "border-cta"
                    : safetyOpen
                      ? "border-cta/70"
                      : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`border px-2 py-1 text-xs font-semibold tracking-wide uppercase ${
                      note.severity === "safety"
                        ? "border-cta bg-cta text-secondary"
                        : note.severity === "priority"
                          ? "border-tan text-tan"
                          : "border-line text-muted"
                    }`}
                  >
                    {SEVERITY_LABEL[note.severity]}
                  </span>
                  <span className="text-xs font-semibold tracking-wide text-tan uppercase">
                    {STATUS_LABEL[note.status]}
                  </span>
                  {DEMO_NOTE_IDS.has(note.id) ? (
                    <span className="text-xs font-semibold tracking-wide text-muted uppercase">
                      Example
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-base leading-snug text-paper">{note.body}</p>
                <p className="mt-2 text-sm text-tan">
                  {[note.room, note.location].filter(Boolean).join(" · ") || jobName}
                </p>
                {note.hazard_type ? (
                  <p className="mt-1 text-sm text-paper">{HAZARD_LABEL[note.hazard_type]}</p>
                ) : null}
                {note.symptoms_reported ? (
                  <p className="mt-1 text-sm font-semibold text-cta">People reported symptoms.</p>
                ) : null}
                {note.stop_work ? (
                  <p className="mt-1 text-sm font-semibold text-cta">Stop work.</p>
                ) : null}
                {note.photos.length > 0 ? (
                  <ul className="mt-2 text-sm text-metal">
                    {note.photos.map((photo) => (
                      <li key={photo}>{photo}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-sm text-muted">
                  {note.author_name} · {formatWhen(note.created_at)}
                </p>
                {note.resolution_note ? (
                  <p className="mt-2 text-sm text-paper">{note.resolution_note}</p>
                ) : null}
                {note.severity_change_reason ? (
                  <p className="mt-2 text-sm text-tan">
                    Lowered from safety. {note.severity_change_reason}
                  </p>
                ) : null}
                <ReadAloudButton
                  id={`field-note-${note.id}`}
                  text={fieldNoteSpeak(note)}
                  label="Hear this"
                  className="mt-3"
                />
                {canWrite && note.status !== "closed" ? (
                  <div className="mt-3 flex flex-col gap-2">
                      <label className="text-sm text-paper" htmlFor={`resolution-${note.id}`}>
                      What did you do?
                      <input
                        id={`resolution-${note.id}`}
                        value={resolutions[note.id] ?? ""}
                        onChange={(event) =>
                          setResolutions((current) => ({
                            ...current,
                            [note.id]: event.target.value,
                          }))
                        }
                        className={inputClass}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {note.status === "open" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void patchNote(note.id, { status: "acknowledged" })}
                          className="min-h-12 border border-line px-3 text-sm font-semibold uppercase text-paper"
                        >
                          Acknowledge
                        </button>
                      ) : null}
                      {note.status === "open" || note.status === "acknowledged" ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            void patchNote(note.id, {
                              status: "mitigated",
                              resolution_note: resolutions[note.id] ?? "",
                            })
                          }
                          className="min-h-12 border border-line px-3 text-sm font-semibold uppercase text-paper"
                        >
                          Mark mitigated
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void patchNote(note.id, {
                            status: "closed",
                            resolution_note: resolutions[note.id] ?? "",
                          })
                        }
                        className="min-h-12 border border-cta px-3 text-sm font-semibold uppercase text-paper"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
                {canWrite && note.severity === "safety" ? (
                  <div className="mt-3 border-t border-line pt-3">
                    {downgradeId === note.id ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-paper">
                          Say why this is no longer a safety note.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(["routine", "priority"] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setDowngradeTo(value)}
                              className={`min-h-12 border px-3 text-sm font-semibold uppercase ${
                                downgradeTo === value
                                  ? "border-cta text-cta"
                                  : "border-line text-paper"
                              }`}
                            >
                              {SEVERITY_LABEL[value]}
                            </button>
                          ))}
                        </div>
                        <label className="text-sm text-paper" htmlFor={`downgrade-${note.id}`}>
                          Why
                          <input
                            id={`downgrade-${note.id}`}
                            value={downgradeReason}
                            onChange={(event) => setDowngradeReason(event.target.value)}
                            className={inputClass}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={saving || !downgradeReason.trim()}
                          onClick={() =>
                            void patchNote(note.id, {
                              severity: downgradeTo,
                              severity_change_reason: downgradeReason,
                            })
                          }
                          className="min-h-12 border border-cta bg-cta px-3 text-sm font-semibold uppercase text-secondary disabled:opacity-60"
                        >
                          Lower from safety
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDowngradeId(note.id);
                          setDowngradeReason("");
                          setDowngradeTo("routine");
                        }}
                        className="min-h-12 text-sm font-semibold uppercase text-tan"
                      >
                        Lower from safety
                      </button>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {notice ? (
        <div role="status" className="border border-line bg-ink px-4 py-4">
          <p className="text-base text-paper">{notice}</p>
          <ReadAloudButton id="field-note-notice" text={notice} label="Hear this" className="mt-3" />
        </div>
      ) : null}
      {error ? (
        <FieldFailureCard
          title={error.title}
          message={error.message}
          speak={`${error.title}. ${error.message}`}
          speakId="field-note-error"
          onRetry={retry ?? undefined}
          retryDisabled={saving}
        />
      ) : null}

      {canWrite ? (
        <form
          className="flex flex-col gap-3 border border-line bg-panel p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void postNote();
          }}
        >
          <h2 className="font-display text-2xl tracking-wide text-paper">New note</h2>
          <label className="text-sm font-semibold text-paper" htmlFor="note-body">
            What happened?
            <textarea
              id="note-body"
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-paper" htmlFor="note-room">
            Room
            <input
              id="note-room"
              value={noteRoom}
              onChange={(event) => setNoteRoom(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm font-semibold text-paper" htmlFor="note-location">
            Location
            <input
              id="note-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={inputClass}
            />
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-paper">How urgent?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["routine", "priority", "safety"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSeverity(value);
                    if (value !== "safety") {
                      setSymptoms(false);
                      setStopWork(false);
                    }
                  }}
                  className={`min-h-12 border px-3 text-sm font-semibold uppercase ${
                    severity === value
                      ? "border-cta bg-cta text-secondary"
                      : "border-line text-paper"
                  }`}
                >
                  {SEVERITY_LABEL[value]}
                </button>
              ))}
            </div>
          </fieldset>
          {severity === "safety" ? (
            <div className="flex flex-col gap-3 border border-cta/60 p-3">
              <label className="text-sm font-semibold text-paper" htmlFor="note-hazard">
                What kind of hazard?
                <select
                  id="note-hazard"
                  required
                  value={hazard}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (isHazardType(value)) setHazard(value);
                    else setHazard("");
                  }}
                  className={inputClass}
                >
                  <option value="">Pick the hazard</option>
                  {HAZARD_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {HAZARD_LABEL[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-12 items-center gap-3 text-base text-paper">
                <input
                  type="checkbox"
                  checked={symptoms}
                  onChange={(event) => setSymptoms(event.target.checked)}
                  className="size-5"
                />
                People reported symptoms
              </label>
              <label className="flex min-h-12 items-center gap-3 text-base text-paper">
                <input
                  type="checkbox"
                  checked={stopWork}
                  onChange={(event) => setStopWork(event.target.checked)}
                  className="size-5"
                />
                Stop work
              </label>
            </div>
          ) : null}
          <div>
            <label className="text-sm font-semibold text-paper" htmlFor="note-photo">
              Photo name or link
              <input
                id="note-photo"
                value={photoDraft}
                onChange={(event) => setPhotoDraft(event.target.value)}
                className={inputClass}
              />
            </label>
            <button
              type="button"
              className="mt-2 min-h-12 border border-line px-3 text-sm font-semibold uppercase text-paper"
              onClick={() => {
                const next = photoDraft.trim();
                if (!next || next.startsWith("data:")) return;
                setPhotos((current) => [...current, next].slice(0, 12));
                setPhotoDraft("");
              }}
            >
              Add photo
            </button>
            {photos.length > 0 ? (
              <ul className="mt-2 text-sm text-metal">
                {photos.map((photo) => (
                  <li key={photo}>{photo}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={saving || !body.trim() || (severity === "safety" && !hazard)}
            className="min-h-12 border border-cta bg-cta px-4 text-base font-semibold tracking-wide text-secondary uppercase disabled:opacity-60"
          >
            Save note
          </button>
        </form>
      ) : (
        <p className="text-base text-tan">This login is view-only.</p>
      )}
    </div>
  );
}
