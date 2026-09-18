import { DEMO_FOREMAN, DEMO_JOURNEYMAN } from "./crew";

/** US Central — Maple Point demo city (Cedar Falls). September 2026 is CDT (UTC-5). */
export const JOB_TIMEZONE = "America/Chicago";
export const DEMO_TZ_OFFSET = "-05:00";

export const DAILY_OT_HOURS = 8;
export const WEEKLY_OT_HOURS = 40;

export const TIME_JOB_SLUG = "maple-point";

export type WorkerRole =
  | "foreman"
  | "journeyman"
  | "apprentice"
  | "electrician"
  | "laborer";

export type PunchType = "in" | "out";

export type JobSite = {
  id: string;
  slug: string;
  name: string;
  city: string;
  /** Fence center from job_sites config (demo seed or live row). Never look up by job name. */
  lat: number;
  lng: number;
  radius_m: number;
};

export type Worker = {
  id: string;
  job_site_id: string;
  name: string;
  role: WorkerRole;
  email: string;
  /** Demo-only shared-iPad stub. Not real auth. */
  pin_stub: string;
};

export type TimePunch = {
  id: string;
  job_site_id: string;
  worker_id: string;
  punch_type: PunchType;
  punched_at: string;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  distance_m: number | null;
  geofence_ok: boolean;
  edited_by_foreman: boolean;
  edit_note: string | null;
  created_at: string;
  updated_at: string;
};

export type TimeStorage = "memory" | "supabase" | "unavailable" | "unconfigured";

export type TimeSnapshot = {
  site: JobSite;
  workers: Worker[];
  punches: TimePunch[];
  weekStart: string;
  storage: TimeStorage;
};

export type DayHours = {
  ymd: string;
  hours: number;
  open: boolean;
  missedOut: boolean;
  overtime: boolean;
  punches: TimePunch[];
};

export type WorkerWeek = {
  worker: Worker;
  days: DayHours[];
  totalHours: number;
  daysWorked: number;
  weekOvertime: boolean;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function chicagoDateTimeIso(ymd: string, hm: string): string {
  const time = hm.length === 5 ? `${hm}:00` : hm;
  return `${ymd}T${time}${DEMO_TZ_OFFSET}`;
}

export function todayYmd(now = new Date(), timeZone = JOB_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function punchYmd(iso: string, timeZone = JOB_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function mondayOfWeek(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const weekday = new Date(utc).getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(utc);
  monday.setUTCDate(monday.getUTCDate() + delta);
  return monday.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0.05) return "—";
  return hours.toFixed(1);
}

export function formatPunchClock(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: JOB_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatPunchStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: JOB_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function isPunchType(value: unknown): value is PunchType {
  return value === "in" || value === "out";
}

export function dayHours(
  punches: TimePunch[],
  ymd: string,
  now: Date,
  today: string,
): DayHours {
  const sorted = [...punches].sort((a, b) =>
    a.punched_at.localeCompare(b.punched_at),
  );
  let hours = 0;
  let openIn: TimePunch | null = null;
  for (const punch of sorted) {
    if (punch.punch_type === "in") {
      openIn = punch;
    } else if (punch.punch_type === "out" && openIn) {
      hours +=
        (Date.parse(punch.punched_at) - Date.parse(openIn.punched_at)) / 3_600_000;
      openIn = null;
    }
  }
  let open = false;
  let missedOut = false;
  if (openIn) {
    if (ymd === today) {
      hours += Math.max(0, (now.getTime() - Date.parse(openIn.punched_at)) / 3_600_000);
      open = true;
    } else {
      missedOut = true;
    }
  }
  return {
    ymd,
    hours,
    open,
    missedOut,
    overtime: hours > DAILY_OT_HOURS + 0.05,
    punches: sorted,
  };
}

export function buildWorkerWeeks(
  workers: Worker[],
  punches: TimePunch[],
  weekStart: string,
  now = new Date(),
): WorkerWeek[] {
  const today = todayYmd(now);
  const days = weekDays(weekStart);
  return workers.map((worker) => {
    const mine = punches.filter((punch) => punch.worker_id === worker.id);
    const dayRows = days.map((ymd) =>
      dayHours(
        mine.filter((punch) => punchYmd(punch.punched_at) === ymd),
        ymd,
        now,
        today,
      ),
    );
    const totalHours = dayRows.reduce((sum, row) => sum + row.hours, 0);
    const daysWorked = dayRows.filter(
      (row) => row.hours > 0.05 || row.open || row.missedOut || row.punches.length > 0,
    ).length;
    return {
      worker,
      days: dayRows,
      totalHours,
      daysWorked,
      weekOvertime: totalHours > WEEKLY_OT_HOURS + 0.05,
    };
  });
}

export function latestPunch(
  punches: TimePunch[],
  workerId: string,
): TimePunch | null {
  const mine = punches
    .filter((punch) => punch.worker_id === workerId)
    .sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  return mine[mine.length - 1] ?? null;
}

export function isOnClock(punches: TimePunch[], workerId: string): boolean {
  const last = latestPunch(punches, workerId);
  return last?.punch_type === "in";
}

export function workerFromSessionEmail(
  workers: Worker[],
  email: string | null | undefined,
): Worker | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;
  return workers.find((worker) => worker.email.toLowerCase() === trimmed) ?? null;
}

export function defaultWorkerId(
  workers: Worker[],
  email: string | null | undefined,
): string {
  const matched = workerFromSessionEmail(workers, email);
  if (matched) return matched.id;
  const alex = workers.find((worker) => worker.email === DEMO_JOURNEYMAN.email);
  const pat = workers.find((worker) => worker.email === DEMO_FOREMAN.email);
  return alex?.id ?? pat?.id ?? workers[0]?.id ?? "";
}
