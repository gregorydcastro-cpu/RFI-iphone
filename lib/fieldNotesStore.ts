/**
 * Field-note feed for Maple Point and Cedar Ridge.
 * Service role writes when field_notes exists. Otherwise the fictional
 * examples plus this process's memory. Demo examples are not inserted
 * into a live table and are not walked by the escalation cron.
 */

import { deliverDueAlerts, type SafetyAlertReport } from "./fieldNoteAlerts.ts";
import {
  applyNotePatch,
  isFieldNoteJob,
  parseFieldNoteCreate,
  sortFieldNotes,
  type FieldNote,
  type NoteActor,
  type NotePatch,
} from "./fieldNotes.ts";
import { demoNotesForJob, DEMO_FIELD_NOTES, DEMO_NOTE_IDS } from "./fieldNotesDemo.ts";
import {
  insertFieldNoteRow,
  isFieldNoteTableConfigured,
  listFieldNoteRows,
  listSafetyNotesForEscalation,
  updateFieldNoteRow,
} from "./supabaseFieldNotes.ts";

export type FieldNoteStorage = "supabase" | "memory";

export type FieldNoteListResult =
  | { ok: true; notes: FieldNote[]; storage: FieldNoteStorage }
  | { ok: false; error: string; code: "load_failed" };

export type FieldNoteWriteResult =
  | {
      ok: true;
      note: FieldNote;
      storage: FieldNoteStorage;
      report: SafetyAlertReport;
    }
  | { ok: false; status: number; error: string; code: string };

const memoryNotes: FieldNote[] = [];
const demoOverrides = new Map<string, FieldNote>();

function cloneNote(note: FieldNote): FieldNote {
  return { ...note, photos: [...note.photos] };
}

function examplesFor(jobSlug?: string): FieldNote[] {
  const source = jobSlug
    ? demoNotesForJob(jobSlug)
    : DEMO_FIELD_NOTES.map((note) => cloneNote(note));
  return source.map((note) => {
    const override = demoOverrides.get(note.id);
    return override ? cloneNote(override) : note;
  });
}

function remember(note: FieldNote): void {
  if (DEMO_NOTE_IDS.has(note.id)) {
    demoOverrides.set(note.id, cloneNote(note));
    return;
  }
  const index = memoryNotes.findIndex((item) => item.id === note.id);
  if (index >= 0) memoryNotes[index] = cloneNote(note);
  else memoryNotes.push(cloneNote(note));
}

export async function listFieldNotes(jobSlug: string): Promise<FieldNoteListResult> {
  if (!isFieldNoteJob(jobSlug)) {
    return { ok: false, error: "Notes are on Maple Point and Cedar Ridge.", code: "load_failed" };
  }
  const examples = examplesFor(jobSlug);
  if (!isFieldNoteTableConfigured()) {
    const mine = memoryNotes.filter((note) => note.job_slug === jobSlug).map(cloneNote);
    return { ok: true, storage: "memory", notes: sortFieldNotes([...examples, ...mine]) };
  }
  const remote = await listFieldNoteRows(jobSlug);
  if (!remote.ok && !remote.missing) {
    return { ok: false, error: "Notes did not load.", code: "load_failed" };
  }
  if (!remote.ok) {
    const mine = memoryNotes.filter((note) => note.job_slug === jobSlug).map(cloneNote);
    return { ok: true, storage: "memory", notes: sortFieldNotes([...examples, ...mine]) };
  }
  const remoteIds = new Set(remote.notes.map((note) => note.id));
  const local = [
    ...examples.filter((note) => !remoteIds.has(note.id)),
    ...memoryNotes
      .filter((note) => note.job_slug === jobSlug && !remoteIds.has(note.id))
      .map(cloneNote),
  ];
  return {
    ok: true,
    storage: "supabase",
    notes: sortFieldNotes([...remote.notes, ...local]),
  };
}

async function findNote(
  id: string,
): Promise<{ note: FieldNote; storage: FieldNoteStorage } | null> {
  const override = demoOverrides.get(id);
  if (override) return { note: cloneNote(override), storage: "memory" };
  const memory = memoryNotes.find((note) => note.id === id);
  if (memory) return { note: cloneNote(memory), storage: "memory" };
  const example = DEMO_FIELD_NOTES.find((note) => note.id === id);
  if (!isFieldNoteTableConfigured()) {
    return example ? { note: cloneNote(example), storage: "memory" } : null;
  }
  const remote = await listFieldNoteRows();
  if (remote.ok) {
    const row = remote.notes.find((note) => note.id === id);
    if (row) return { note: cloneNote(row), storage: "supabase" };
  }
  return example ? { note: cloneNote(example), storage: "memory" } : null;
}

async function saveNote(
  note: FieldNote,
  storage: FieldNoteStorage,
  insert: boolean,
): Promise<{ ok: true; note: FieldNote; storage: FieldNoteStorage } | { ok: false }> {
  if (storage === "memory" || DEMO_NOTE_IDS.has(note.id) || !isFieldNoteTableConfigured()) {
    remember(note);
    return { ok: true, note: cloneNote(note), storage: "memory" };
  }
  const saved = insert ? await insertFieldNoteRow(note) : await updateFieldNoteRow(note);
  if (saved === "missing") {
    remember(note);
    return { ok: true, note: cloneNote(note), storage: "memory" };
  }
  if (!saved) return { ok: false };
  return { ok: true, note: saved, storage: "supabase" };
}

export async function createFieldNote(input: {
  raw: unknown;
  actor: NoteActor;
  now?: Date;
}): Promise<FieldNoteWriteResult> {
  const now = input.now ?? new Date();
  const parsed = parseFieldNoteCreate(input.raw, input.actor, now.toISOString());
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error, code: parsed.code };

  const storage: FieldNoteStorage = isFieldNoteTableConfigured() ? "supabase" : "memory";
  const drafted = await saveNote(parsed.note, storage, true);
  if (!drafted.ok) {
    return { ok: false, status: 503, error: "Note did not save. Tap Retry.", code: "save_failed" };
  }

  const delivered = await deliverDueAlerts({
    note: drafted.note,
    nowMs: now.getTime(),
  });
  const stamped =
    delivered.note.foreman_alerted_at !== drafted.note.foreman_alerted_at ||
    delivered.note.gc_escalated_at !== drafted.note.gc_escalated_at ||
    delivered.note.unacked_realerted_at !== drafted.note.unacked_realerted_at ||
    delivered.note.mitigated_reminded_at !== drafted.note.mitigated_reminded_at;
  if (!stamped) {
    return { ok: true, note: drafted.note, storage: drafted.storage, report: delivered.report };
  }
  const saved = await saveNote(delivered.note, drafted.storage, false);
  if (!saved.ok) {
    return { ok: true, note: drafted.note, storage: drafted.storage, report: delivered.report };
  }
  return { ok: true, note: saved.note, storage: saved.storage, report: delivered.report };
}

export async function updateFieldNote(input: {
  id: string;
  patch: NotePatch;
  actor: NoteActor;
  now?: Date;
}): Promise<FieldNoteWriteResult> {
  const now = input.now ?? new Date();
  const existing = await findNote(input.id);
  if (!existing || !isFieldNoteJob(existing.note.job_slug)) {
    return { ok: false, status: 404, error: "That note is not on this job.", code: "not_found" };
  }
  const patched = applyNotePatch(existing.note, input.patch, input.actor, now.toISOString());
  if (!patched.ok) return { ok: false, status: 400, error: patched.error, code: patched.code };

  const drafted = await saveNote(patched.note, existing.storage, false);
  if (!drafted.ok) {
    return { ok: false, status: 503, error: "Note did not save. Tap Retry.", code: "save_failed" };
  }
  const delivered = await deliverDueAlerts({
    note: drafted.note,
    nowMs: now.getTime(),
  });
  const stamped =
    delivered.note.foreman_alerted_at !== drafted.note.foreman_alerted_at ||
    delivered.note.gc_escalated_at !== drafted.note.gc_escalated_at ||
    delivered.note.unacked_realerted_at !== drafted.note.unacked_realerted_at ||
    delivered.note.mitigated_reminded_at !== drafted.note.mitigated_reminded_at;
  if (!stamped) {
    return { ok: true, note: drafted.note, storage: drafted.storage, report: delivered.report };
  }
  const saved = await saveNote(delivered.note, drafted.storage, false);
  if (!saved.ok) {
    return { ok: true, note: drafted.note, storage: drafted.storage, report: delivered.report };
  }
  return { ok: true, note: saved.note, storage: saved.storage, report: delivered.report };
}

/** Saved safety notes only. On-screen examples are not escalated. */
export async function listNotesForEscalation(): Promise<
  { ok: true; notes: FieldNote[] } | { ok: false; error: string }
> {
  if (!isFieldNoteTableConfigured()) {
    return {
      ok: true,
      notes: memoryNotes.filter(
        (note) => note.severity === "safety" && note.status !== "closed" && !DEMO_NOTE_IDS.has(note.id),
      ),
    };
  }
  const remote = await listSafetyNotesForEscalation();
  if (!remote.ok && remote.missing) return { ok: true, notes: [] };
  if (!remote.ok) return { ok: false, error: "Notes did not load." };
  return { ok: true, notes: remote.notes };
}

export async function saveEscalationStamps(notes: readonly FieldNote[]): Promise<number> {
  let saved = 0;
  for (const note of notes) {
    if (DEMO_NOTE_IDS.has(note.id)) continue;
    if (!isFieldNoteTableConfigured()) {
      remember(note);
      saved += 1;
      continue;
    }
    const updated = await updateFieldNoteRow(note);
    if (updated && updated !== "missing") saved += 1;
  }
  return saved;
}
