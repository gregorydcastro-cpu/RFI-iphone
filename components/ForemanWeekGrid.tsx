"use client";

import {
  addDays,
  chicagoDateTimeIso,
  DAILY_OT_HOURS,
  dayHoursLabel,
  dayHoursParts,
  formatHours,
  formatPunchClock,
  WEEKDAY_LABELS,
  WEEKLY_OT_HOURS,
  type DayHours,
  type TimeSnapshot,
  type WorkerWeek,
} from "@/lib/time";
import { sessionGateLead } from "@/lib/authMessages";
import { useMemo, useRef, useState } from "react";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-cta";

type Props = {
  snapshot: TimeSnapshot;
  weeks: WorkerWeek[];
  signedIn: boolean;
  sessionEnded?: boolean;
  pending: boolean;
  error: string | null;
  notice: string | null;
  onWeekChange: (weekStart: string) => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
};

export function ForemanWeekGrid({
  snapshot,
  weeks,
  signedIn,
  sessionEnded = false,
  pending,
  error,
  notice,
  onWeekChange,
  onSave,
}: Props) {
  const [workerId, setWorkerId] = useState(snapshot.workers[0]?.id ?? "");
  const [ymd, setYmd] = useState(snapshot.weekStart);
  const [inTime, setInTime] = useState("07:00");
  const [outTime, setOutTime] = useState("15:00");
  const [note, setNote] = useState("");
  const [editPunchId, setEditPunchId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState("07:00");
  const editRef = useRef<HTMLDivElement>(null);

  const selectedDayPunches = useMemo(() => {
    return snapshot.punches
      .filter((punch) => punch.worker_id === workerId)
      .filter((punch) => chicagoYmd(punch.punched_at) === ymd)
      .sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  }, [snapshot.punches, workerId, ymd]);

  const selectedWorker = snapshot.workers.find((worker) => worker.id === workerId);
  const weekLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${snapshot.weekStart}T00:00:00Z`));

  function selectDay(nextWorkerId: string, nextYmd: string) {
    setWorkerId(nextWorkerId);
    setYmd(nextYmd);
    setEditPunchId(null);
    editRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function addMissed() {
    if (!signedIn) return;
    await onSave({
      foreman: true,
      workerId,
      punchedAt: chicagoDateTimeIso(ymd, inTime),
      pairOutAt: outTime ? chicagoDateTimeIso(ymd, outTime) : null,
      note: note || "Missed punch",
    });
  }

  async function saveEdit() {
    if (!editPunchId || !signedIn) return;
    await onSave({
      foreman: true,
      workerId,
      punchId: editPunchId,
      punchedAt: chicagoDateTimeIso(ymd, editTime),
      note: note || "Corrected punch",
    });
    setEditPunchId(null);
  }

  return (
    <section className="border border-line bg-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-wide text-paper">Crew week</h2>
          <p className="mt-1 text-base text-muted">
            {snapshot.site.name}. Red means overtime (over {DAILY_OT_HOURS} hours
            a day or {WEEKLY_OT_HOURS} a week) or no punch-out. Tap a day to fix
            it. This is the field log, not payroll.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="min-h-11 border border-line px-3 text-paper hover:border-cta"
            onClick={() => onWeekChange(addDays(snapshot.weekStart, -7))}
          >
            Prev week
          </button>
          <span className="font-mono text-xs text-metal">Week of {weekLabel}</span>
          <button
            type="button"
            className="min-h-11 border border-line px-3 text-paper hover:border-cta"
            onClick={() => onWeekChange(addDays(snapshot.weekStart, 7))}
          >
            Next week
          </button>
        </div>
      </div>

      <ul className="mt-4 space-y-3 md:hidden">
        {weeks.map((row) => (
          <li key={row.worker.id} className="border border-line bg-ink p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base text-paper">{row.worker.name}</p>
                <p className="text-sm text-metal">{row.worker.role}</p>
              </div>
              <div className="text-right">
                <p
                  className={`text-lg font-semibold ${
                    row.weekOvertime ? "text-cta" : "text-paper"
                  }`}
                >
                  {formatHours(row.totalHours)}
                </p>
                <p className="text-sm text-muted">
                  {row.daysWorked || 0} {row.daysWorked === 1 ? "day" : "days"}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {row.days.map((day, index) => (
                <DayCell
                  key={day.ymd}
                  day={day}
                  label={WEEKDAY_LABELS[index] ?? ""}
                  selected={workerId === row.worker.id && ymd === day.ymd}
                  onSelect={() => selectDay(row.worker.id, day.ymd)}
                  stacked
                />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted uppercase">
              <th className="border-b border-line py-2 pr-3 font-semibold">Crew</th>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label} className="border-b border-line px-2 py-2 font-semibold">
                  {label}
                </th>
              ))}
              <th className="border-b border-line px-2 py-2 font-semibold">Days</th>
              <th className="border-b border-line py-2 pl-2 font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((row) => (
              <tr key={row.worker.id} className="align-top">
                <td className="border-b border-line py-2 pr-3">
                  <div className="text-paper">{row.worker.name}</div>
                  <div className="font-mono text-[11px] text-metal">{row.worker.role}</div>
                </td>
                {row.days.map((day) => (
                  <td key={day.ymd} className="border-b border-line px-1 py-2">
                    <DayCell
                      day={day}
                      label={dayHoursLabel(day)}
                      selected={workerId === row.worker.id && ymd === day.ymd}
                      onSelect={() => selectDay(row.worker.id, day.ymd)}
                    />
                  </td>
                ))}
                <td className="border-b border-line px-2 py-2 text-paper">
                  {row.daysWorked || "—"}
                </td>
                <td
                  className={`border-b border-line py-2 pl-2 font-semibold ${
                    row.weekOvertime ? "text-cta" : "text-paper"
                  }`}
                >
                  {formatHours(row.totalHours)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        ref={editRef}
        id="crew-day-edit"
        className="mt-6 scroll-mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-2"
      >
        <div>
          <h3 className="font-display text-lg tracking-wide text-paper">
            {selectedWorker ? selectedWorker.name : "Crew"} · {formatDayLabel(ymd)}
          </h3>
          <p className="mt-1 text-base text-muted">
            Add a missed punch for this day, or correct a time in the list.
          </p>
          <label className="mt-3 block text-sm font-semibold tracking-wide text-muted uppercase">
            Name
            <select
              className={inputClass}
              value={workerId}
              onChange={(event) => setWorkerId(event.target.value)}
            >
              {snapshot.workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm font-semibold tracking-wide text-muted uppercase">
            Date
            <input
              type="date"
              className={inputClass}
              value={ymd}
              onChange={(event) => setYmd(event.target.value)}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold tracking-wide text-muted uppercase">
              In
              <input
                type="time"
                className={inputClass}
                value={inTime}
                onChange={(event) => setInTime(event.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold tracking-wide text-muted uppercase">
              Out
              <input
                type="time"
                className={inputClass}
                value={outTime}
                onChange={(event) => setOutTime(event.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold tracking-wide text-muted uppercase">
            Note
            <input
              className={inputClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Forgot to punch"
            />
          </label>
          {!signedIn ? (
            <p className="mt-3 text-base text-cta">
              {sessionGateLead(sessionEnded)} Sign in to save edits.
            </p>
          ) : null}
          {notice ? (
            <p
              className="mt-3 border border-accent-2/50 bg-panel-2 px-3 py-3 text-base text-paper"
              role="status"
            >
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mt-3 border border-cta/50 bg-cta/10 px-3 py-3 text-base text-cta" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || !signedIn}
            onClick={() => void addMissed()}
            className="mt-4 min-h-12 bg-cta px-4 py-2.5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save missed punch"}
          </button>
        </div>
        <div>
          <h3 className="font-display text-lg tracking-wide text-paper">That day</h3>
          {selectedDayPunches.length === 0 ? (
            <p className="mt-2 text-base text-muted">No punches. Add a missed pair.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {selectedDayPunches.map((punch) => (
                <li
                  key={punch.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-line bg-ink px-3 py-3 text-base"
                >
                  <span className="text-paper">
                    {punch.punch_type === "in" ? "In" : "Out"} {formatPunchClock(punch.punched_at)}
                    {punch.edited_by_foreman ? (
                      <span className="ml-2 text-sm text-accent-2">edited</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="min-h-11 text-sm font-semibold tracking-wide text-accent uppercase hover:text-cta"
                    onClick={() => {
                      setEditPunchId(punch.id);
                      setEditTime(clockValue(punch.punched_at));
                    }}
                  >
                    Correct
                  </button>
                </li>
              ))}
            </ul>
          )}
          {editPunchId ? (
            <div className="mt-3 flex items-end gap-3">
              <label className="block text-sm font-semibold tracking-wide text-muted uppercase">
                New time
                <input
                  type="time"
                  className={inputClass}
                  value={editTime}
                  onChange={(event) => setEditTime(event.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={pending || !signedIn}
                onClick={() => void saveEdit()}
                className="min-h-12 border border-cta px-3 py-2 text-sm font-semibold tracking-wide text-paper uppercase hover:bg-cta"
              >
                Update
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function DayCell({
  day,
  label,
  selected,
  onSelect,
  stacked = false,
}: {
  day: DayHours;
  label: string;
  selected: boolean;
  onSelect: () => void;
  stacked?: boolean;
}) {
  const hot = day.overtime || day.missedOut;
  const parts = dayHoursParts(day);
  const empty = !hot && !day.open && parts.primary === "—";
  const tone = hot ? "font-semibold text-cta" : empty ? "text-muted" : "text-paper";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full text-center ${tone} ${
        selected ? "border border-cta bg-panel-2" : "border border-transparent"
      } ${stacked ? "min-h-14 px-0.5 py-1" : "min-h-11 px-2 py-1 text-left"}`}
    >
      {stacked ? (
        <>
          <span className="block text-[10px] tracking-wide text-muted uppercase">{label}</span>
          <span className="mt-0.5 block text-sm leading-tight">{parts.primary}</span>
          {parts.secondary ? (
            <span className="block text-[10px] tracking-wide uppercase">{parts.secondary}</span>
          ) : null}
        </>
      ) : (
        label
      )}
    </button>
  );
}

function chicagoYmd(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function formatDayLabel(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${ymd}T00:00:00Z`));
}

function clockValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "07";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}
