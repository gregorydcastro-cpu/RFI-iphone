/**
 * Service-role access for public.field_notes.
 * Missing service role: callers use the in-memory demo feed.
 * A missing table (migration not applied) is reported as unavailable
 * so the caller can keep the fictional demo feed.
 */

import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections.ts";
import { FIELD_NOTES_TABLE } from "./schema.ts";
import {
  isHazardType,
  isNoteSeverity,
  isNoteStatus,
  type FieldNote,
  type HazardType,
  type NoteSeverity,
  type NoteStatus,
} from "./fieldNotes.ts";

const FETCH_TIMEOUT_MS = 8_000;

const COLUMNS = [
  "id",
  "job_slug",
  "room",
  "location",
  "body",
  "photos",
  "author_user_id",
  "author_name",
  "created_at",
  "updated_at",
  "severity",
  "hazard_type",
  "symptoms_reported",
  "stop_work",
  "status",
  "acknowledged_by",
  "acknowledged_at",
  "resolved_at",
  "resolution_note",
  "severity_changed_by",
  "severity_changed_at",
  "severity_change_reason",
  "foreman_alerted_at",
  "gc_escalated_at",
  "unacked_realerted_at",
  "mitigated_at",
  "mitigated_reminded_at",
].join(",");

export type FieldNoteRemote =
  | { ok: true; notes: FieldNote[] }
  | { ok: false; missing: boolean };

export function isFieldNoteTableConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export async function listFieldNoteRows(jobSlug?: string): Promise<FieldNoteRemote> {
  const config = getSupabaseServiceConfig();
  if (!config) return { ok: true, notes: [] };
  const params = new URLSearchParams();
  params.set("select", COLUMNS);
  if (jobSlug) params.set("job_slug", `eq.${jobSlug}`);
  params.set("order", "created_at.desc");
  params.set("limit", "200");
  const response = await restFetch(config, `${FIELD_NOTES_TABLE}?${params.toString()}`, {
    method: "GET",
  });
  if (!response) return { ok: false, missing: false };
  if (response.status === 404) return { ok: false, missing: true };
  if (!response.ok) {
    console.error("[gcfieldlog] field_notes list was not ok", { status: response.status });
    return { ok: false, missing: false };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return { ok: false, missing: false };
  const notes: FieldNote[] = [];
  for (const item of json) {
    const note = asFieldNote(item);
    if (note) notes.push(note);
  }
  return { ok: true, notes };
}

export async function listSafetyNotesForEscalation(): Promise<FieldNoteRemote> {
  const config = getSupabaseServiceConfig();
  if (!config) return { ok: true, notes: [] };
  const params = new URLSearchParams();
  params.set("select", COLUMNS);
  params.set("severity", "eq.safety");
  params.set("status", "neq.closed");
  params.set("order", "created_at.asc");
  params.set("limit", "200");
  const response = await restFetch(config, `${FIELD_NOTES_TABLE}?${params.toString()}`, {
    method: "GET",
  });
  if (!response) return { ok: false, missing: false };
  if (response.status === 404) return { ok: false, missing: true };
  if (!response.ok) {
    console.error("[gcfieldlog] field_notes escalation list was not ok", {
      status: response.status,
    });
    return { ok: false, missing: false };
  }
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return { ok: false, missing: false };
  const notes: FieldNote[] = [];
  for (const item of json) {
    const note = asFieldNote(item);
    if (note) notes.push(note);
  }
  return { ok: true, notes };
}

export async function insertFieldNoteRow(note: FieldNote): Promise<FieldNote | "missing" | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const response = await restFetch(config, FIELD_NOTES_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toRow(note)),
  });
  if (!response) return null;
  if (response.status === 404) return "missing";
  if (!response.ok) {
    console.error("[gcfieldlog] field_notes insert was not ok", { status: response.status });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asFieldNote(row);
}

export async function updateFieldNoteRow(note: FieldNote): Promise<FieldNote | "missing" | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const response = await restFetch(config, `${FIELD_NOTES_TABLE}?id=eq.${encodeURIComponent(note.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toRow(note)),
  });
  if (!response) return null;
  if (response.status === 404) return "missing";
  if (!response.ok) {
    console.error("[gcfieldlog] field_notes update was not ok", { status: response.status });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asFieldNote(row);
}

function toRow(note: FieldNote): Record<string, unknown> {
  return {
    id: note.id,
    job_slug: note.job_slug,
    room: note.room,
    location: note.location,
    body: note.body,
    photos: note.photos,
    author_user_id: note.author_user_id,
    author_name: note.author_name,
    created_at: note.created_at,
    updated_at: note.updated_at,
    severity: note.severity,
    hazard_type: note.hazard_type,
    symptoms_reported: note.symptoms_reported,
    stop_work: note.stop_work,
    status: note.status,
    acknowledged_by: note.acknowledged_by,
    acknowledged_at: note.acknowledged_at,
    resolved_at: note.resolved_at,
    resolution_note: note.resolution_note,
    severity_changed_by: note.severity_changed_by,
    severity_changed_at: note.severity_changed_at,
    severity_change_reason: note.severity_change_reason,
    foreman_alerted_at: note.foreman_alerted_at,
    gc_escalated_at: note.gc_escalated_at,
    unacked_realerted_at: note.unacked_realerted_at,
    mitigated_at: note.mitigated_at,
    mitigated_reminded_at: note.mitigated_reminded_at,
  };
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const photos: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) photos.push(trimmed);
  }
  return photos;
}

export function asFieldNote(value: unknown): FieldNote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = asText(row.id);
  const jobSlug = asText(row.job_slug);
  if (!id || !jobSlug) return null;
  const severity: NoteSeverity = isNoteSeverity(row.severity) ? row.severity : "routine";
  const status: NoteStatus = isNoteStatus(row.status) ? row.status : "open";
  const hazard: HazardType | null = isHazardType(row.hazard_type) ? row.hazard_type : null;
  const createdAt = asText(row.created_at) ?? new Date().toISOString();
  return {
    id,
    job_slug: jobSlug,
    room: asText(row.room),
    location: asText(row.location),
    body: typeof row.body === "string" ? row.body : "",
    photos: asPhotos(row.photos),
    author_user_id: asText(row.author_user_id) ?? "",
    author_name: asText(row.author_name) ?? "Crew",
    created_at: createdAt,
    updated_at: asText(row.updated_at) ?? createdAt,
    severity,
    hazard_type: severity === "safety" ? hazard : hazard,
    symptoms_reported: asBool(row.symptoms_reported),
    stop_work: asBool(row.stop_work),
    status,
    acknowledged_by: asText(row.acknowledged_by),
    acknowledged_at: asText(row.acknowledged_at),
    resolved_at: asText(row.resolved_at),
    resolution_note: asText(row.resolution_note),
    severity_changed_by: asText(row.severity_changed_by),
    severity_changed_at: asText(row.severity_changed_at),
    severity_change_reason: asText(row.severity_change_reason),
    foreman_alerted_at: asText(row.foreman_alerted_at),
    gc_escalated_at: asText(row.gc_escalated_at),
    unacked_realerted_at: asText(row.unacked_realerted_at),
    mitigated_at: asText(row.mitigated_at),
    mitigated_reminded_at: asText(row.mitigated_reminded_at),
  };
}

async function restFetch(
  config: SupabaseServiceConfig,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] field_notes request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
