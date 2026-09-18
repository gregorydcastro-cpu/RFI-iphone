"use client";

import {
  addDays,
  chicagoDateTimeIso,
  DAILY_OT_HOURS,
  formatHours,
  formatPunchClock,
  WEEKDAY_LABELS,
  WEEKLY_OT_HOURS,
  type TimeSnapshot,
  type WorkerWeek,
} from "@/lib/time";
import { useMemo, useState } from "react";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta";

type Props = {
  snapshot: TimeSnapshot;
  weeks: WorkerWeek[];
  signedIn: boolean;
  pending: boolean;
  error: string | null;
  onWeekChange: (weekStart: string) => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
};

export function ForemanWeekGrid({
  snapshot,
  weeks,
  signedIn,
  pending,
  error,
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

  const selectedDayPunches = useMemo(() => {
    return snapshot.punches
      .filter((punch) => punch.worker_id === workerId)
      .filter((punch) => chicagoYmd(punch.punched_at) === ymd)
      .sort((a, b) => a.punched_at.localeCompare(b.punched_at));
  }, [snapshot.punches, workerId, ymd]);

  const weekLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${snapshot.weekStart}T00:00:00Z`));

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
          <h2 className="font-display text-xl tracking-wide text-paper">
            Crew week
          </h2>
          <p className="mt-1 text-sm text-muted">
            Maple Point only. OT over {DAILY_OT_HOURS}h/day or {WEEKLY_OT_HOURS}h/week
            in red. Field log — not payroll.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="border border-line px-2 py-1 text-paper hover:border-cta"
            onClick={() => onWeekChange(addDays(snapshot.weekStart, -7))}
          >
            Prev
          </button>
          <span className="font-mono text-xs text-metal">Week of {weekLabel}</span>
          <button
            type="button"
            className="border border-line px-2 py-1 text-paper hover:border-cta"
            onClick={() => onWeekChange(addDays(snapshot.weekStart, 7))}
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted uppercase">
              <th className="border-b border-line py-2 pr-3 font-semibold">Crew</th>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label} className="border-b border-line px-2 py-2 font-semibold">
                  {label}
                </th>
              ))}
              <th className="border-b border-line px-2 py-2 font-semibold">Days</th>
              <th className="border-b border-line pl-2 py-2 font-semibold">Hours</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((row) => (
              <tr key={row.worker.id} className="align-top">
                <td className="border-b border-line py-2 pr-3">
                  <div className="text-paper">{row.worker.name}</div>
                  <div className="font-mono text-[11px] text-metal">
                    {row.worker.role}
                  </div>
                </td>
                {row.days.map((day) => {
                  const overtime = day.overtime;
                  const label = day.missedOut
                    ? "missed out"
                    : day.open
                      ? day.hours > 0.05
                        ? `${formatHours(day.hours)} · on`
                        : "on"
                      : formatHours(day.hours);
                  return (
                    <td key={day.ymd} className="border-b border-line px-2 py-2">
                      <button
                        type="button"
                        className={`block text-left ${
                          overtime || day.missedOut ? "font-semibold text-cta" : "text-paper"
                        }`}
                        onClick={() => {
                          setWorkerId(row.worker.id);
                          setYmd(day.ymd);
                        }}
                      >
                        {label}
                      </button>
                    </td>
                  );
                })}
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

      <div className="mt-6 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <div>
          <h3 className="font-display text-lg tracking-wide text-paper">
            Add / correct punch
          </h3>
          <p className="mt-1 text-xs text-muted">
            Foreman override skips the GPS fence. Use for missed punches only.
          </p>
          <label className="mt-3 block text-xs font-semibold tracking-wide text-muted uppercase">
            Worker
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
          <label className="mt-3 block text-xs font-semibold tracking-wide text-muted uppercase">
            Date
            <input
              type="date"
              className={inputClass}
              value={ymd}
              onChange={(event) => setYmd(event.target.value)}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
              In
              <input
                type="time"
                className={inputClass}
                value={inTime}
                onChange={(event) => setInTime(event.target.value)}
              />
            </label>
            <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
              Out
              <input
                type="time"
                className={inputClass}
                value={outTime}
                onChange={(event) => setOutTime(event.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-xs font-semibold tracking-wide text-muted uppercase">
            Note
            <input
              className={inputClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Forgot to punch / late truck"
            />
          </label>
          {!signedIn ? (
            <p className="mt-3 text-sm text-cta">Sign in (stub) to save edits.</p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-cta" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            disabled={pending || !signedIn}
            onClick={() => void addMissed()}
            className="mt-4 bg-cta px-4 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save missed punch"}
          </button>
        </div>
        <div>
          <h3 className="font-display text-lg tracking-wide text-paper">
            That day
          </h3>
          {selectedDayPunches.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No punches. Add a missed pair.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {selectedDayPunches.map((punch) => (
                <li
                  key={punch.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-line bg-ink px-3 py-2 text-sm"
                >
                  <span className="text-paper">
                    {punch.punch_type.toUpperCase()} {formatPunchClock(punch.punched_at)}
                    {punch.edited_by_foreman ? (
                      <span className="ml-2 text-xs text-accent-2">edited</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold tracking-wide text-accent uppercase hover:text-cta"
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
              <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
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
                className="border border-cta px-3 py-2 text-xs font-semibold tracking-wide text-paper uppercase hover:bg-cta"
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

function chicagoYmd(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
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
