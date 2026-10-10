/**
 * One field-note feed. Safety is a severity, not a separate list.
 * severity = safety is what alerts. There is no flag-immediately field.
 */

export const FIELD_NOTE_JOB_SLUGS = ["maple-point", "cedar-ridge"] as const;

export type FieldNoteJobSlug = (typeof FIELD_NOTE_JOB_SLUGS)[number];

export const NOTE_SEVERITIES = ["routine", "priority", "safety"] as const;
export type NoteSeverity = (typeof NOTE_SEVERITIES)[number];

export const HAZARD_TYPES = [
  "air_quality",
  "fall",
  "electrical",
  "fire",
  "struck_by",
  "other",
] as const;
export type HazardType = (typeof HAZARD_TYPES)[number];

export const NOTE_STATUSES = [
  "open",
  "acknowledged",
  "mitigated",
  "closed",
] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

/** 15 minutes from created_at, still status open. */
export const UNACKED_ESCALATE_MS = 15 * 60 * 1000;
/** 24 hours after mitigated_at, still not closed. */
export const MITIGATED_REMINDER_MS = 24 * 60 * 60 * 1000;

export type FieldNote = {
  id: string;
  job_slug: string;
  room: string | null;
  location: string | null;
  body: string;
  photos: string[];
  author_user_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  severity: NoteSeverity;
  hazard_type: HazardType | null;
  symptoms_reported: boolean;
  stop_work: boolean;
  status: NoteStatus;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  severity_changed_by: string | null;
  severity_changed_at: string | null;
  severity_change_reason: string | null;
  /** Idempotent: first foreman/superintendent alert. */
  foreman_alerted_at: string | null;
  /** Idempotent: GC escalation (immediate or 15-minute). */
  gc_escalated_at: string | null;
  /** Idempotent: re-alert after 15 minutes still open. */
  unacked_realerted_at: string | null;
  mitigated_at: string | null;
  /** Idempotent: reminder 24 hours after mitigated. */
  mitigated_reminded_at: string | null;
};

export type NoteActor = {
  userId: string;
  name: string;
};

export type FieldNoteFilter = {
  query?: string;
  room?: string;
  severity?: NoteSeverity | "all";
  status?: NoteStatus | "all";
};

export type DueAlertKind =
  | "create_foreman"
  | "create_gc"
  | "unacked_realert"
  | "unacked_gc"
  | "mitigated_reminder";

export type AlertRole = "foreman" | "superintendent" | "gc";

const STATUS_RANK: Record<NoteStatus, number> = {
  open: 0,
  acknowledged: 1,
  mitigated: 2,
  closed: 3,
};

export const SEVERITY_LABEL: Record<NoteSeverity, string> = {
  routine: "Routine",
  priority: "Priority",
  safety: "Safety",
};

export const HAZARD_LABEL: Record<HazardType, string> = {
  air_quality: "Air quality",
  fall: "Fall",
  electrical: "Electrical",
  fire: "Fire",
  struck_by: "Struck by",
  other: "Other",
};

export const STATUS_LABEL: Record<NoteStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  mitigated: "Mitigated",
  closed: "Closed",
};

export function isFieldNoteJob(slug: string | null | undefined): slug is FieldNoteJobSlug {
  return slug === "maple-point" || slug === "cedar-ridge";
}

export function isNoteSeverity(value: unknown): value is NoteSeverity {
  return value === "routine" || value === "priority" || value === "safety";
}

export function isHazardType(value: unknown): value is HazardType {
  return (
    value === "air_quality" ||
    value === "fall" ||
    value === "electrical" ||
    value === "fire" ||
    value === "struck_by" ||
    value === "other"
  );
}

export function isNoteStatus(value: unknown): value is NoteStatus {
  return (
    value === "open" ||
    value === "acknowledged" ||
    value === "mitigated" ||
    value === "closed"
  );
}

export function fieldNoteJobName(slug: string): string {
  if (slug === "maple-point") return "Maple Point Medical Office";
  if (slug === "cedar-ridge") return "Cedar Ridge Outpatient";
  return slug;
}

/**
 * Safety that is not closed stays on the feed no matter the filter.
 * Closed safety can be filtered like any other note.
 */
export function isNonClosedSafety(note: Pick<FieldNote, "severity" | "status">): boolean {
  return note.severity === "safety" && note.status !== "closed";
}

export function openSafetyCount(notes: readonly Pick<FieldNote, "severity" | "status">[]): number {
  return notes.reduce(
    (count, note) =>
      note.severity === "safety" && note.status === "open" ? count + 1 : count,
    0,
  );
}

/** Pinned while any safety note on the job is still status open. */
export function openSafetyBanner(
  notes: readonly Pick<FieldNote, "severity" | "status">[],
): { count: number; text: string } | null {
  const count = openSafetyCount(notes);
  if (count === 0) return null;
  const text =
    count === 1
      ? "1 safety note is still open."
      : `${count} safety notes are still open.`;
  return { count, text };
}

function haystack(note: FieldNote): string {
  const hazard = note.hazard_type ? HAZARD_LABEL[note.hazard_type] : "";
  return [
    note.body,
    note.room ?? "",
    note.location ?? "",
    note.author_name,
    note.resolution_note ?? "",
    hazard,
    SEVERITY_LABEL[note.severity],
    STATUS_LABEL[note.status],
    ...note.photos,
  ]
    .join(" ")
    .toLowerCase();
}

function noteMatchesFilter(note: FieldNote, filter: FieldNoteFilter): boolean {
  const query = filter.query?.trim().toLowerCase() ?? "";
  if (query && !haystack(note).includes(query)) return false;
  const room = filter.room?.trim().toLowerCase() ?? "";
  if (room && !(note.room ?? "").toLowerCase().includes(room)) return false;
  if (filter.severity && filter.severity !== "all" && note.severity !== filter.severity) {
    return false;
  }
  if (filter.status && filter.status !== "all" && note.status !== filter.status) {
    return false;
  }
  return true;
}

export function noteVisibleInFeed(note: FieldNote, filter: FieldNoteFilter): boolean {
  if (isNonClosedSafety(note)) return true;
  return noteMatchesFilter(note, filter);
}

/**
 * 1. Safety still open (unacknowledged), oldest first.
 * 2. Safety acknowledged or mitigated, oldest first.
 * 3. Priority, newest first.
 * 4. Routine, newest first.
 * Closed safety leaves the safety pin and sorts newest-first with routine.
 */
export function feedSortGroup(note: FieldNote): 0 | 1 | 2 | 3 {
  if (note.severity === "safety" && note.status === "open") return 0;
  if (
    note.severity === "safety" &&
    (note.status === "acknowledged" || note.status === "mitigated")
  ) {
    return 1;
  }
  if (note.severity === "priority") return 2;
  return 3;
}

export function compareFieldNotes(a: FieldNote, b: FieldNote): number {
  const groupA = feedSortGroup(a);
  const groupB = feedSortGroup(b);
  if (groupA !== groupB) return groupA - groupB;
  const timeA = Date.parse(a.created_at);
  const timeB = Date.parse(b.created_at);
  const safeA = Number.isFinite(timeA) ? timeA : 0;
  const safeB = Number.isFinite(timeB) ? timeB : 0;
  if (safeA !== safeB) {
    const oldestFirst = groupA === 0 || groupA === 1;
    return oldestFirst ? safeA - safeB : safeB - safeA;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

export function sortFieldNotes(notes: readonly FieldNote[]): FieldNote[] {
  return [...notes].sort(compareFieldNotes);
}

export function visibleFieldNotes(
  notes: readonly FieldNote[],
  filter: FieldNoteFilter,
): FieldNote[] {
  return sortFieldNotes(notes.filter((note) => noteVisibleInFeed(note, filter)));
}

export function rolesForAlert(kind: DueAlertKind): AlertRole[] {
  switch (kind) {
    case "create_foreman":
    case "unacked_realert":
    case "mitigated_reminder":
      return ["foreman", "superintendent"];
    case "create_gc":
    case "unacked_gc":
      return ["gc"];
  }
}

export function audiencesForAlerts(kinds: readonly DueAlertKind[]): AlertRole[] {
  const roles: AlertRole[] = [];
  for (const kind of kinds) {
    for (const role of rolesForAlert(kind)) {
      if (!roles.includes(role)) roles.push(role);
    }
  }
  return roles;
}

/**
 * Safety alerts only. Routine and priority never alert, even with
 * stop_work or symptoms_reported. No separate flag.
 *
 * Create alert and the 15-minute re-alert do not fire in the same pass.
 * GC immediate (stop work or symptoms) is its own stamp. The 15-minute
 * GC escalation runs only when that stamp is still empty.
 */
export function dueSafetyAlerts(note: FieldNote, nowMs: number): DueAlertKind[] {
  if (note.severity !== "safety") return [];
  if (note.status === "closed") return [];

  const due: DueAlertKind[] = [];
  const created = Date.parse(note.created_at);
  const ageMs = Number.isFinite(created) ? nowMs - created : 0;
  const unackedWindow = note.status === "open" && ageMs >= UNACKED_ESCALATE_MS;

  if (!note.foreman_alerted_at) {
    due.push("create_foreman");
  } else if (unackedWindow && !note.unacked_realerted_at) {
    due.push("unacked_realert");
  }

  const immediateGc = note.stop_work || note.symptoms_reported;
  if (immediateGc && !note.gc_escalated_at) {
    due.push("create_gc");
  } else if (unackedWindow && note.foreman_alerted_at && !note.gc_escalated_at) {
    due.push("unacked_gc");
  }

  if (note.status === "mitigated" && !note.mitigated_reminded_at) {
    const start = Date.parse(note.mitigated_at ?? "");
    if (Number.isFinite(start) && nowMs - start >= MITIGATED_REMINDER_MS) {
      due.push("mitigated_reminder");
    }
  }

  return due;
}

/** In-app line after a save. Null for routine and priority. */
export function createAlertSummary(
  note: Pick<FieldNote, "severity" | "stop_work" | "symptoms_reported">,
): string | null {
  if (note.severity !== "safety") return null;
  if (note.stop_work || note.symptoms_reported) {
    return "Foreman and the superintendent are alerted. The GC is alerted now.";
  }
  return "Foreman and the superintendent are alerted.";
}

export function fieldNoteSpeak(note: FieldNote): string {
  const where = [note.room, note.location].filter(Boolean).join(", ");
  const parts = [
    `${SEVERITY_LABEL[note.severity]} note`,
    STATUS_LABEL[note.status],
  ];
  if (note.hazard_type) parts.push(HAZARD_LABEL[note.hazard_type]);
  if (where) parts.push(where);
  parts.push(note.body);
  if (note.symptoms_reported) parts.push("People reported symptoms.");
  if (note.stop_work) parts.push("Stop work.");
  if (note.resolution_note) parts.push(note.resolution_note);
  return parts.join(". ");
}

export function feedSpeak(notes: readonly FieldNote[], banner: string | null): string {
  const lines = notes.map((note, index) => `${index + 1}. ${fieldNoteSpeak(note)}`);
  if (banner) lines.unshift(banner);
  return lines.join(" ");
}

function asTrimmed(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asOptionalText(value: unknown, max: number): string | null | undefined {
  if (value == null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function asPhotos(value: unknown): string[] | null {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  if (value.length > 12) return null;
  const photos: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > 300 || trimmed.startsWith("data:")) return null;
    photos.push(trimmed);
  }
  return photos;
}

export function emptyAlertStamps(): Pick<
  FieldNote,
  | "foreman_alerted_at"
  | "gc_escalated_at"
  | "unacked_realerted_at"
  | "mitigated_at"
  | "mitigated_reminded_at"
> {
  return {
    foreman_alerted_at: null,
    gc_escalated_at: null,
    unacked_realerted_at: null,
    mitigated_at: null,
    mitigated_reminded_at: null,
  };
}

export function parseFieldNoteCreate(
  raw: unknown,
  actor: NoteActor,
  nowIso: string,
): { ok: true; note: FieldNote } | { ok: false; error: string; code: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Write what happened.", code: "invalid_note" };
  }
  const body = raw as Record<string, unknown>;
  const jobSlug = asTrimmed(body.job_slug, 80);
  if (!jobSlug || !isFieldNoteJob(jobSlug)) {
    return {
      ok: false,
      error: "Notes are on Maple Point and Cedar Ridge.",
      code: "not_demo_job",
    };
  }
  const text = asTrimmed(body.body, 4000);
  if (!text) {
    return { ok: false, error: "Write what happened.", code: "invalid_note" };
  }
  const severity = body.severity == null ? "routine" : body.severity;
  if (!isNoteSeverity(severity)) {
    return { ok: false, error: "Pick routine, priority, or safety.", code: "invalid_note" };
  }
  const hazard =
    body.hazard_type == null || body.hazard_type === ""
      ? null
      : body.hazard_type;
  if (hazard != null && !isHazardType(hazard)) {
    return { ok: false, error: "Pick the hazard.", code: "hazard_required" };
  }
  if (severity === "safety" && !hazard) {
    return { ok: false, error: "Pick the hazard.", code: "hazard_required" };
  }
  const photos = asPhotos(body.photos);
  if (!photos) {
    return { ok: false, error: "Photo needs a short name or link.", code: "invalid_note" };
  }
  const room = asOptionalText(body.room, 120);
  const location = asOptionalText(body.location, 200);
  if (room === undefined || location === undefined) {
    return { ok: false, error: "Check the room and location.", code: "invalid_note" };
  }
  const safety = severity === "safety";
  const symptoms = safety ? asBool(body.symptoms_reported) === true : false;
  const stopWork = safety ? asBool(body.stop_work) === true : false;
  const id =
    typeof body.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.id.trim(),
    )
      ? body.id.trim()
      : crypto.randomUUID();

  const note: FieldNote = {
    id,
    job_slug: jobSlug,
    room,
    location,
    body: text,
    photos,
    author_user_id: actor.userId,
    author_name: actor.name.trim() || "Crew",
    created_at: nowIso,
    updated_at: nowIso,
    severity,
    hazard_type: safety ? hazard : hazard,
    symptoms_reported: symptoms,
    stop_work: stopWork,
    status: "open",
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_at: null,
    resolution_note: null,
    severity_changed_by: null,
    severity_changed_at: null,
    severity_change_reason: null,
    ...emptyAlertStamps(),
  };
  return { ok: true, note };
}

export type NotePatch = {
  severity?: NoteSeverity;
  hazard_type?: HazardType | null;
  status?: NoteStatus;
  resolution_note?: string | null;
  severity_change_reason?: string | null;
  symptoms_reported?: boolean;
  stop_work?: boolean;
  room?: string | null;
  location?: string | null;
  body?: string;
  photos?: string[];
};

export function applyNotePatch(
  note: FieldNote,
  patch: NotePatch,
  actor: NoteActor,
  nowIso: string,
): { ok: true; note: FieldNote } | { ok: false; error: string; code: string } {
  const nextSeverity = patch.severity ?? note.severity;
  if (!isNoteSeverity(nextSeverity)) {
    return { ok: false, error: "Pick routine, priority, or safety.", code: "invalid_note" };
  }
  const hazard = patch.hazard_type === undefined ? note.hazard_type : patch.hazard_type;
  if (hazard != null && !isHazardType(hazard)) {
    return { ok: false, error: "Pick the hazard.", code: "hazard_required" };
  }
  if (nextSeverity === "safety" && !hazard) {
    return { ok: false, error: "Pick the hazard.", code: "hazard_required" };
  }
  const nextStatus = patch.status ?? note.status;
  if (!isNoteStatus(nextStatus)) {
    return { ok: false, error: "Pick a status.", code: "invalid_note" };
  }
  if (STATUS_RANK[nextStatus] < STATUS_RANK[note.status]) {
    return {
      ok: false,
      error: "That note is already further along.",
      code: "status_backwards",
    };
  }

  const downgrade = note.severity === "safety" && nextSeverity !== "safety";
  let severityChangedBy = note.severity_changed_by;
  let severityChangedAt = note.severity_changed_at;
  let severityChangeReason = note.severity_change_reason;
  if (downgrade) {
    const reason =
      typeof patch.severity_change_reason === "string"
        ? patch.severity_change_reason.trim()
        : "";
    if (!reason) {
      return {
        ok: false,
        error: "Say why this is no longer a safety note.",
        code: "downgrade_reason_required",
      };
    }
    severityChangedBy = actor.userId;
    severityChangedAt = nowIso;
    severityChangeReason = reason.slice(0, 500);
  }

  const resolution =
    patch.resolution_note === undefined
      ? note.resolution_note
      : asOptionalText(patch.resolution_note, 2000);
  if (resolution === undefined) {
    return { ok: false, error: "Check the resolution note.", code: "invalid_note" };
  }

  const room = patch.room === undefined ? note.room : asOptionalText(patch.room, 120);
  const location =
    patch.location === undefined ? note.location : asOptionalText(patch.location, 200);
  if (room === undefined || location === undefined) {
    return { ok: false, error: "Check the room and location.", code: "invalid_note" };
  }
  const text =
    patch.body === undefined ? note.body : asTrimmed(patch.body, 4000);
  if (!text) {
    return { ok: false, error: "Write what happened.", code: "invalid_note" };
  }
  const photos = patch.photos === undefined ? note.photos : asPhotos(patch.photos);
  if (!photos) {
    return { ok: false, error: "Photo needs a short name or link.", code: "invalid_note" };
  }

  const next: FieldNote = {
    ...note,
    body: text,
    room,
    location,
    photos,
    severity: nextSeverity,
    hazard_type: hazard,
    status: nextStatus,
    resolution_note: resolution,
    symptoms_reported:
      patch.symptoms_reported === undefined
        ? note.symptoms_reported
        : patch.symptoms_reported === true,
    stop_work: patch.stop_work === undefined ? note.stop_work : patch.stop_work === true,
    severity_changed_by: severityChangedBy,
    severity_changed_at: severityChangedAt,
    severity_change_reason: severityChangeReason,
    updated_at: nowIso,
  };

  if (nextStatus === "acknowledged" && note.status === "open") {
    next.acknowledged_by = actor.userId;
    next.acknowledged_at = nowIso;
  }
  if (nextStatus === "mitigated" && note.status !== "mitigated" && note.status !== "closed") {
    if (!next.mitigated_at) next.mitigated_at = nowIso;
  }
  if (nextStatus === "closed" && note.status !== "closed") {
    if (!next.resolved_at) next.resolved_at = nowIso;
  }

  return { ok: true, note: next };
}

export function isFieldNote(value: unknown): value is FieldNote {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<FieldNote>;
  return (
    typeof row.id === "string" &&
    typeof row.job_slug === "string" &&
    typeof row.body === "string" &&
    isNoteSeverity(row.severity) &&
    isNoteStatus(row.status) &&
    typeof row.created_at === "string"
  );
}
