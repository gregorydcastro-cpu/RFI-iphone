/**
 * Service-role access for time_tracking tables.
 * Stub sessions are not auth.uid(), so anon/authenticated RLS cannot write.
 * Demo path does not need these keys — timeStore falls back to memory.
 */

import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections";
import type { JobSite, PunchType, TimePunch, Worker, WorkerRole } from "./time";
import { TIME_JOB_SLUG } from "./time";

const FETCH_TIMEOUT_MS = 8_000;

export const JOB_SITES_TABLE = "job_sites";
export const WORKERS_TABLE = "workers";
export const TIME_PUNCHES_TABLE = "time_punches";

export function isTimeTableWriteConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export async function fetchJobSiteBySlug(
  slug = TIME_JOB_SLUG,
): Promise<JobSite | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const response = await restFetch(
    config,
    `${JOB_SITES_TABLE}?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`,
    { method: "GET" },
  );
  if (!response?.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asJobSite(row);
}

export async function fetchWorkersForSite(jobSiteId: string): Promise<Worker[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const response = await restFetch(
    config,
    `${WORKERS_TABLE}?job_site_id=eq.${encodeURIComponent(jobSiteId)}&select=*&order=name.asc`,
    { method: "GET" },
  );
  if (!response?.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.map(asWorker).filter((row): row is Worker => row !== null);
}

export async function fetchPunchesInRange(input: {
  jobSiteId: string;
  fromIso: string;
  toIso: string;
}): Promise<TimePunch[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const query =
    `${TIME_PUNCHES_TABLE}?job_site_id=eq.${encodeURIComponent(input.jobSiteId)}` +
    `&punched_at=gte.${encodeURIComponent(input.fromIso)}` +
    `&punched_at=lt.${encodeURIComponent(input.toIso)}` +
    `&select=*&order=punched_at.asc`;
  const response = await restFetch(config, query, { method: "GET" });
  if (!response?.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.map(asPunch).filter((row): row is TimePunch => row !== null);
}

export async function insertTimePunchRow(
  punch: TimePunch,
): Promise<TimePunch | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const response = await restFetch(config, TIME_PUNCHES_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(toRow(punch)),
  });
  if (!response?.ok) {
    if (response) {
      console.error("[gcfieldlog] time_punches insert was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asPunch(row);
}

export async function updateTimePunchRow(
  id: string,
  patch: Partial<TimePunch>,
): Promise<TimePunch | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.punched_at) body.punched_at = patch.punched_at;
  if (patch.punch_type) body.punch_type = patch.punch_type;
  if (patch.edit_note !== undefined) body.edit_note = patch.edit_note;
  if (patch.edited_by_foreman !== undefined) {
    body.edited_by_foreman = patch.edited_by_foreman;
  }
  if (patch.geofence_ok !== undefined) body.geofence_ok = patch.geofence_ok;
  if (patch.lat !== undefined) body.lat = patch.lat;
  if (patch.lng !== undefined) body.lng = patch.lng;
  if (patch.accuracy_m !== undefined) body.accuracy_m = patch.accuracy_m;
  if (patch.distance_m !== undefined) body.distance_m = patch.distance_m;

  const response = await restFetch(
    config,
    `${TIME_PUNCHES_TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  );
  if (!response?.ok) {
    if (response) {
      console.error("[gcfieldlog] time_punches update was not ok", {
        status: response.status,
      });
    }
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asPunch(row);
}

function toRow(punch: TimePunch): Record<string, unknown> {
  return {
    id: punch.id,
    job_site_id: punch.job_site_id,
    worker_id: punch.worker_id,
    punch_type: punch.punch_type,
    punched_at: punch.punched_at,
    lat: punch.lat,
    lng: punch.lng,
    accuracy_m: punch.accuracy_m,
    distance_m: punch.distance_m,
    geofence_ok: punch.geofence_ok,
    edited_by_foreman: punch.edited_by_foreman,
    edit_note: punch.edit_note,
    created_at: punch.created_at,
    updated_at: punch.updated_at,
  };
}

function asJobSite(value: unknown): JobSite | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.slug !== "string") return null;
  if (typeof row.name !== "string") return null;
  if (typeof row.lat !== "number" || typeof row.lng !== "number") return null;
  const radius = typeof row.radius_m === "number" ? row.radius_m : Number(row.radius_m);
  if (!Number.isFinite(radius)) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: typeof row.city === "string" ? row.city : "",
    lat: row.lat,
    lng: row.lng,
    radius_m: radius,
  };
}

const ROLES: WorkerRole[] = [
  "foreman",
  "journeyman",
  "apprentice",
  "electrician",
  "laborer",
];

function asWorker(value: unknown): Worker | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.job_site_id !== "string") return null;
  if (typeof row.name !== "string") return null;
  const role = ROLES.includes(row.role as WorkerRole)
    ? (row.role as WorkerRole)
    : "laborer";
  return {
    id: row.id,
    job_site_id: row.job_site_id,
    name: row.name,
    role,
    email: typeof row.email === "string" ? row.email : "",
    pin_stub: typeof row.pin_stub === "string" ? row.pin_stub : "",
  };
}

function asPunch(value: unknown): TimePunch | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.job_site_id !== "string") return null;
  if (typeof row.worker_id !== "string") return null;
  const punchType: PunchType = row.punch_type === "out" ? "out" : "in";
  if (typeof row.punched_at !== "string") return null;
  return {
    id: row.id,
    job_site_id: row.job_site_id,
    worker_id: row.worker_id,
    punch_type: punchType,
    punched_at: row.punched_at,
    lat: asNumberOrNull(row.lat),
    lng: asNumberOrNull(row.lng),
    accuracy_m: asNumberOrNull(row.accuracy_m),
    distance_m: asNumberOrNull(row.distance_m),
    geofence_ok: row.geofence_ok === true,
    edited_by_foreman: row.edited_by_foreman === true,
    edit_note: typeof row.edit_note === "string" ? row.edit_note : null,
    created_at:
      typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
    console.error("[gcfieldlog] time_tracking request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
