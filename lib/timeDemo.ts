/**
 * Maple Point Medical Office demo roster + one sample week.
 * Fictional UI demo only — never Danoff, Brown, Rossi, or real customer jobs.
 * Live jobs must load lat/lng/radius_m from job_sites (config), not this file.
 */

import { DEMO_FOREMAN, DEMO_JOURNEYMAN } from "./crew";
import { chicagoDateTimeIso, type JobSite, type TimePunch, type Worker } from "./time";

/** Downtown Cedar Falls public point, used only as a GPS test fence. */
export const MAPLE_POINT_SITE: JobSite = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "maple-point",
  name: "Maple Point Medical Office",
  city: "Cedar Falls",
  lat: 42.5349,
  lng: -92.445,
  radius_m: 300,
};

export const MAPLE_POINT_WORKERS: Worker[] = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    job_site_id: MAPLE_POINT_SITE.id,
    name: DEMO_FOREMAN.name,
    role: "foreman",
    email: DEMO_FOREMAN.email,
    pin_stub: "2468",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    job_site_id: MAPLE_POINT_SITE.id,
    name: DEMO_JOURNEYMAN.name,
    role: "journeyman",
    email: DEMO_JOURNEYMAN.email,
    pin_stub: "1041",
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    job_site_id: MAPLE_POINT_SITE.id,
    name: "Jordan Hale",
    role: "apprentice",
    email: "jordan.hale@crew.example",
    pin_stub: "3302",
  },
  {
    id: "00000000-0000-4000-8000-000000000014",
    job_site_id: MAPLE_POINT_SITE.id,
    name: "Sam Ortiz",
    role: "electrician",
    email: "sam.ortiz@crew.example",
    pin_stub: "5519",
  },
  {
    id: "00000000-0000-4000-8000-000000000015",
    job_site_id: MAPLE_POINT_SITE.id,
    name: "Casey Brooks",
    role: "laborer",
    email: "casey.brooks@crew.example",
    pin_stub: "7780",
  },
  {
    id: "00000000-0000-4000-8000-000000000016",
    job_site_id: MAPLE_POINT_SITE.id,
    name: "Riley Chen",
    role: "journeyman",
    email: "riley.chen@crew.example",
    pin_stub: "8821",
  },
];

type Shift = { ymd: string; inn: string; out?: string };

/**
 * Week of Mon 14 Sep 2026 (today in this environment is Fri 18 Sep 2026).
 * Alex Thursday = 10h OT. Riley Tuesday = 9.5h OT. Jordan missed Friday.
 * Casey off Wednesday. Alex Friday still on the clock (no out).
 */
const SAMPLE_SHIFTS: Record<string, Shift[]> = {
  "00000000-0000-4000-8000-000000000011": [
    { ymd: "2026-09-14", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-15", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-16", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-17", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-18", inn: "07:00", out: "15:00" },
  ],
  "00000000-0000-4000-8000-000000000012": [
    { ymd: "2026-09-14", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-15", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-16", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-17", inn: "07:00", out: "17:00" },
    { ymd: "2026-09-18", inn: "07:00" },
  ],
  "00000000-0000-4000-8000-000000000013": [
    { ymd: "2026-09-14", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-15", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-16", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-17", inn: "07:00", out: "15:00" },
  ],
  "00000000-0000-4000-8000-000000000014": [
    { ymd: "2026-09-14", inn: "06:30", out: "14:30" },
    { ymd: "2026-09-15", inn: "06:30", out: "14:30" },
    { ymd: "2026-09-16", inn: "06:30", out: "14:30" },
    { ymd: "2026-09-17", inn: "06:30", out: "14:30" },
    { ymd: "2026-09-18", inn: "06:30", out: "14:30" },
  ],
  "00000000-0000-4000-8000-000000000015": [
    { ymd: "2026-09-14", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-15", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-17", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-18", inn: "07:00", out: "15:00" },
  ],
  "00000000-0000-4000-8000-000000000016": [
    { ymd: "2026-09-14", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-15", inn: "07:00", out: "16:30" },
    { ymd: "2026-09-16", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-17", inn: "07:00", out: "15:00" },
    { ymd: "2026-09-18", inn: "07:00", out: "15:00" },
  ],
};

function punchId(n: number): string {
  return `00000000-0000-4000-8000-${String(100000000000 + n).slice(-12)}`;
}

export function buildSeedPunches(nowIso = "2026-09-14T12:00:00.000Z"): TimePunch[] {
  const punches: TimePunch[] = [];
  let n = 1;
  for (const worker of MAPLE_POINT_WORKERS) {
    const shifts = SAMPLE_SHIFTS[worker.id] ?? [];
    for (const shift of shifts) {
      const innAt = chicagoDateTimeIso(shift.ymd, shift.inn);
      punches.push(
        makePunch({
          id: punchId(n++),
          worker_id: worker.id,
          punch_type: "in",
          punched_at: innAt,
          nowIso,
        }),
      );
      if (shift.out) {
        punches.push(
          makePunch({
            id: punchId(n++),
            worker_id: worker.id,
            punch_type: "out",
            punched_at: chicagoDateTimeIso(shift.ymd, shift.out),
            nowIso,
          }),
        );
      }
    }
  }
  return punches;
}

function makePunch(input: {
  id: string;
  worker_id: string;
  punch_type: "in" | "out";
  punched_at: string;
  nowIso: string;
}): TimePunch {
  return {
    id: input.id,
    job_site_id: MAPLE_POINT_SITE.id,
    worker_id: input.worker_id,
    punch_type: input.punch_type,
    punched_at: input.punched_at,
    lat: MAPLE_POINT_SITE.lat,
    lng: MAPLE_POINT_SITE.lng,
    accuracy_m: 12,
    distance_m: 18,
    geofence_ok: true,
    edited_by_foreman: false,
    edit_note: null,
    created_at: input.nowIso,
    updated_at: input.nowIso,
  };
}

export function cloneSeedPunches(): TimePunch[] {
  return buildSeedPunches().map((punch) => ({ ...punch }));
}
