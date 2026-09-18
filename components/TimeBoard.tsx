"use client";

import { ForemanWeekGrid } from "@/components/ForemanWeekGrid";
import { WorkerPunchCard } from "@/components/WorkerPunchCard";
import {
  buildWorkerWeeks,
  defaultWorkerId,
  mondayOfWeek,
  todayYmd,
  type TimeSnapshot,
} from "@/lib/time";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type Mode = "punch" | "crew";

type Props = {
  initial: TimeSnapshot;
  sessionEmail: string | null;
  signedIn: boolean;
};

export function TimeBoard({ initial, sessionEmail, signedIn }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [mode, setMode] = useState<Mode>("punch");
  const [workerId, setWorkerId] = useState(() =>
    defaultWorkerId(initial.workers, sessionEmail),
  );
  const [pin, setPin] = useState(() => {
    const id = defaultWorkerId(initial.workers, sessionEmail);
    return initial.workers.find((row) => row.id === id)?.pin_stub ?? "";
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const weeks = useMemo(
    () => buildWorkerWeeks(snapshot.workers, snapshot.punches, snapshot.weekStart, now),
    [snapshot, now],
  );

  async function reload(weekStart = snapshot.weekStart) {
    const response = await fetch(`/api/time?week=${encodeURIComponent(weekStart)}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as TimeSnapshot & { ok?: boolean };
    if (!response.ok || data.ok === false) return;
    setSnapshot({
      site: data.site,
      workers: data.workers,
      punches: data.punches,
      weekStart: data.weekStart,
      storage: data.storage,
    });
  }

  async function postPunch(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/time/punches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        code?: string;
        distance_m?: number;
        radius_m?: number;
      };
      if (!response.ok || !data.ok) {
        if (data.code === "off_site") {
          setError(
            `Off site — punch-in locked (${Math.round(data.distance_m ?? 0)} m away, fence ${data.radius_m ?? snapshot.site.radius_m} m).`,
          );
        } else {
          setError(data.error ?? "Could not save punch");
        }
        return;
      }
      await reload(
        body.foreman === true
          ? snapshot.weekStart
          : mondayOfWeek(todayYmd()),
      );
    } catch {
      setError("Could not reach time service.");
    } finally {
      setPending(false);
    }
  }

  function pickWorker(id: string) {
    setWorkerId(id);
    setPin(snapshot.workers.find((row) => row.id === id)?.pin_stub ?? "");
  }

  function pickMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === "punch") void reload(mondayOfWeek(todayYmd()));
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
        Time · {snapshot.site.name}
      </p>
      <h1 className="font-display mt-1 text-3xl tracking-wide text-paper">
        Crew time
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Replace paper timesheets on this job. Worker punch is GPS-locked to the
        site fence. Foreman week is the crew log — not ADP, not payroll.
        Storage: {snapshot.storage === "supabase" ? "Supabase" : "demo memory"}.
      </p>
      {!signedIn ? (
        <p className="mt-3 text-sm text-accent-2">
          <Link href="/?next=/time" className="text-accent underline">
            Sign in
          </Link>{" "}
          (stub) to punch or edit.
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Time modes"
        className="mt-6 flex gap-2 border-b border-line pb-px"
      >
        <ModeTab active={mode === "punch"} onClick={() => pickMode("punch")}>
          Punch
        </ModeTab>
        <ModeTab active={mode === "crew"} onClick={() => pickMode("crew")}>
          Crew week
        </ModeTab>
      </div>

      <div className="mt-6">
        {mode === "punch" ? (
          <WorkerPunchCard
            site={snapshot.site}
            workers={snapshot.workers}
            punches={snapshot.punches}
            workerId={workerId}
            pin={pin}
            signedIn={signedIn}
            pending={pending}
            error={error}
            onWorkerId={pickWorker}
            onPin={setPin}
            onPunch={(input) =>
              postPunch({
                workerId,
                pin,
                punchType: input.punchType,
                lat: input.lat,
                lng: input.lng,
                accuracy_m: input.accuracy_m,
              })
            }
          />
        ) : (
          <ForemanWeekGrid
            snapshot={snapshot}
            weeks={weeks}
            signedIn={signedIn}
            pending={pending}
            error={error}
            onWeekChange={(weekStart) => {
              const next = mondayOfWeek(weekStart || todayYmd());
              void reload(next);
            }}
            onSave={postPunch}
          />
        )}
      </div>
    </main>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "border-b-2 border-cta px-3 py-2 text-xs font-semibold tracking-wide text-paper uppercase"
          : "border-b-2 border-transparent px-3 py-2 text-xs font-semibold tracking-wide text-tan uppercase hover:text-paper"
      }
    >
      {children}
    </button>
  );
}
