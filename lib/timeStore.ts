/**
 * Time snapshot + punch writes.
 *
 * Local / unset Supabase: in-memory store seeded with Maple Point week.
 * Service role configured and tables present: persist to Supabase.
 */

import { geofenceCheck, isFiniteLatLng } from "./geofence";
import {
  addDays,
  chicagoDateTimeIso,
  isOnClock,
  isPunchType,
  mondayOfWeek,
  todayYmd,
  type PunchType,
  type TimePunch,
  type TimeSnapshot,
  type TimeStorage,
  type Worker,
} from "./time";
import {
  cloneSeedPunches,
  MAPLE_POINT_SITE,
  MAPLE_POINT_WORKERS,
} from "./timeDemo";
import {
  fetchJobSiteBySlug,
  fetchPunchesInRange,
  fetchWorkersForSite,
  insertTimePunchRow,
  isTimeTableWriteConfigured,
  updateTimePunchRow,
} from "./supabaseTime";

type GlobalTime = {
  punches: TimePunch[];
};

const g = globalThis as typeof globalThis & { __gcFieldLogTime?: GlobalTime };

function memory(): GlobalTime {
  if (!g.__gcFieldLogTime) {
    g.__gcFieldLogTime = { punches: cloneSeedPunches() };
  }
  return g.__gcFieldLogTime;
}

function weekWindow(weekStart: string): { fromIso: string; toIso: string } {
  return {
    fromIso: chicagoDateTimeIso(weekStart, "00:00"),
    toIso: chicagoDateTimeIso(addDays(weekStart, 7), "00:00"),
  };
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

export async function getTimeSnapshot(weekStartRaw?: string): Promise<TimeSnapshot> {
  const weekStart = mondayOfWeek(weekStartRaw || todayYmd());
  const configured = isTimeTableWriteConfigured();
  if (configured) {
    const site = await fetchJobSiteBySlug();
    if (site) {
      const workers = (await fetchWorkersForSite(site.id)) ?? [];
      const window = weekWindow(weekStart);
      const remote = await fetchPunchesInRange({
        jobSiteId: site.id,
        fromIso: window.fromIso,
        toIso: window.toIso,
      });
      if (remote) {
        return {
          site,
          workers: workers.length ? workers : MAPLE_POINT_WORKERS,
          punches: remote,
          weekStart,
          storage: "supabase",
        };
      }
      return {
        site,
        workers: workers.length ? workers : MAPLE_POINT_WORKERS,
        punches: memoryPunchesForWeek(weekStart),
        weekStart,
        storage: "unavailable",
      };
    }
  }

  return {
    site: MAPLE_POINT_SITE,
    workers: MAPLE_POINT_WORKERS,
    punches: memoryPunchesForWeek(weekStart),
    weekStart,
    storage: configured ? "unavailable" : "memory",
  };
}

function memoryPunchesForWeek(weekStart: string): TimePunch[] {
  const { fromIso, toIso } = weekWindow(weekStart);
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return memory().punches.filter((punch) => {
    const t = Date.parse(punch.punched_at);
    return t >= from && t < to;
  });
}

export type WorkerPunchInput = {
  workerId: string;
  pin?: string;
  punchType: PunchType;
  lat: unknown;
  lng: unknown;
  accuracy_m?: unknown;
};

export type PunchWriteResult =
  | { ok: true; punch: TimePunch; storage: TimeStorage }
  | {
      ok: false;
      status: number;
      error: string;
      code?: string;
      distance_m?: number;
      radius_m?: number;
    };

export async function createWorkerPunch(
  input: WorkerPunchInput,
): Promise<PunchWriteResult> {
  const snapshot = await getTimeSnapshot();
  const worker = snapshot.workers.find((row) => row.id === input.workerId);
  if (!worker) {
    return { ok: false, status: 400, error: "Unknown worker", code: "unknown_worker" };
  }
  if (!isPunchType(input.punchType)) {
    return { ok: false, status: 400, error: "punchType must be in or out" };
  }
  if (worker.pin_stub && input.pin?.trim() !== worker.pin_stub) {
    return { ok: false, status: 403, error: "PIN does not match", code: "bad_pin" };
  }

  const onClock = isOnClock(snapshot.punches, worker.id);
  if (input.punchType === "in" && onClock) {
    return {
      ok: false,
      status: 409,
      error: "Already punched in. Punch out first.",
      code: "already_in",
    };
  }
  if (input.punchType === "out" && !onClock) {
    return {
      ok: false,
      status: 409,
      error: "Not punched in.",
      code: "not_in",
    };
  }

  const pointOk = isFiniteLatLng({ lat: input.lat, lng: input.lng });
  if (input.punchType === "in" && !pointOk) {
    return {
      ok: false,
      status: 400,
      error: "GPS required to punch in",
      code: "gps_required",
    };
  }

  let distance_m: number | null = null;
  let geofence_ok = false;
  if (pointOk) {
    const check = geofenceCheck(
      { lat: input.lat as number, lng: input.lng as number },
      snapshot.site,
    );
    distance_m = check.distance_m;
    geofence_ok = check.ok;
  }

  if (input.punchType === "in" && !geofence_ok) {
    return {
      ok: false,
      status: 403,
      error: "Off site — punch-in is locked outside the job fence",
      code: "off_site",
      distance_m: distance_m ?? undefined,
      radius_m: snapshot.site.radius_m,
    };
  }

  const now = new Date().toISOString();
  const punch: TimePunch = {
    id: newId(),
    job_site_id: snapshot.site.id,
    worker_id: worker.id,
    punch_type: input.punchType,
    punched_at: now,
    lat: pointOk ? (input.lat as number) : null,
    lng: pointOk ? (input.lng as number) : null,
    accuracy_m:
      typeof input.accuracy_m === "number" && Number.isFinite(input.accuracy_m)
        ? input.accuracy_m
        : null,
    distance_m,
    geofence_ok,
    edited_by_foreman: false,
    edit_note: null,
    created_at: now,
    updated_at: now,
  };

  return persistPunch(punch, snapshot.storage);
}

export type ForemanPunchInput = {
  workerId: string;
  punchType?: PunchType;
  punchedAt: string;
  pairOutAt?: string | null;
  note?: string | null;
  punchId?: string | null;
};

export async function saveForemanPunch(
  input: ForemanPunchInput,
): Promise<PunchWriteResult | { ok: true; punches: TimePunch[]; storage: TimeStorage }> {
  const snapshot = await getTimeSnapshot();
  const worker = snapshot.workers.find((row) => row.id === input.workerId);
  if (!worker) {
    return { ok: false, status: 400, error: "Unknown worker", code: "unknown_worker" };
  }

  const punchedAt = Date.parse(input.punchedAt);
  if (Number.isNaN(punchedAt)) {
    return { ok: false, status: 400, error: "Invalid punchedAt" };
  }

  if (input.punchId) {
    const existing =
      snapshot.punches.find((row) => row.id === input.punchId) ??
      memory().punches.find((row) => row.id === input.punchId);
    if (!existing) {
      return { ok: false, status: 404, error: "Punch not found", code: "missing" };
    }
    const now = new Date().toISOString();
    const patch: TimePunch = {
      ...existing,
      punched_at: new Date(punchedAt).toISOString(),
      punch_type: input.punchType ?? existing.punch_type,
      edited_by_foreman: true,
      edit_note: input.note?.trim() || existing.edit_note,
      geofence_ok: true,
      updated_at: now,
    };
    const saved = await persistUpdated(patch, snapshot.storage);
    if (!saved.ok) return saved;
    return { ok: true, punch: saved.punch, storage: saved.storage };
  }

  const saved: TimePunch[] = [];
  const pairOutAt = input.pairOutAt ? Date.parse(input.pairOutAt) : NaN;
  const wantsPair = Boolean(input.pairOutAt);
  if (wantsPair && (Number.isNaN(pairOutAt) || pairOutAt <= punchedAt)) {
    return { ok: false, status: 400, error: "Out time must be after in time" };
  }

  const firstType: PunchType = wantsPair ? "in" : (input.punchType ?? "in");
  const first = await persistPunch(
    makeForemanPunch(snapshot.site.id, worker, firstType, punchedAt, input.note),
    snapshot.storage,
  );
  if (!first.ok) return first;
  saved.push(first.punch);

  if (wantsPair) {
    const out = await persistPunch(
      makeForemanPunch(snapshot.site.id, worker, "out", pairOutAt, input.note),
      snapshot.storage,
    );
    if (!out.ok) return out;
    saved.push(out.punch);
  }

  return { ok: true, punches: saved, storage: first.storage };
}

function makeForemanPunch(
  jobSiteId: string,
  worker: Worker,
  punchType: PunchType,
  atMs: number,
  note?: string | null,
): TimePunch {
  const now = new Date().toISOString();
  return {
    id: newId(),
    job_site_id: jobSiteId,
    worker_id: worker.id,
    punch_type: punchType,
    punched_at: new Date(atMs).toISOString(),
    lat: MAPLE_POINT_SITE.lat,
    lng: MAPLE_POINT_SITE.lng,
    accuracy_m: null,
    distance_m: 0,
    geofence_ok: true,
    edited_by_foreman: true,
    edit_note: note?.trim() || "Foreman correction",
    created_at: now,
    updated_at: now,
  };
}

async function persistPunch(
  punch: TimePunch,
  storageHint: TimeStorage,
): Promise<{ ok: true; punch: TimePunch; storage: TimeStorage } | PunchWriteResult> {
  memory().punches.push(punch);
  if (isTimeTableWriteConfigured()) {
    const row = await insertTimePunchRow(punch);
    if (row) return { ok: true, punch: row, storage: "supabase" };
    return { ok: true, punch, storage: "unavailable" };
  }
  return {
    ok: true,
    punch,
    storage: storageHint === "supabase" ? "memory" : storageHint,
  };
}

async function persistUpdated(
  punch: TimePunch,
  storageHint: TimeStorage,
): Promise<{ ok: true; punch: TimePunch; storage: TimeStorage } | PunchWriteResult> {
  const list = memory().punches;
  const index = list.findIndex((row) => row.id === punch.id);
  if (index >= 0) list[index] = punch;
  else list.push(punch);

  if (isTimeTableWriteConfigured()) {
    const row = await updateTimePunchRow(punch.id, punch);
    if (row) return { ok: true, punch: row, storage: "supabase" };
    const inserted = await insertTimePunchRow(punch);
    if (inserted) return { ok: true, punch: inserted, storage: "supabase" };
    return { ok: true, punch, storage: "unavailable" };
  }
  return {
    ok: true,
    punch,
    storage: storageHint === "supabase" ? "memory" : storageHint,
  };
}
