"use client";

import { ForemanWeekGrid } from "@/components/ForemanWeekGrid";
import { WorkerPunchCard } from "@/components/WorkerPunchCard";
import {
  buildWorkerWeeks,
  defaultWorkerId,
  foremanPunchNotice,
  mergePunches,
  mondayOfWeek,
  PUNCH_SAVE_FAILED_MESSAGE,
  punchWriteAccepted,
  todayYmd,
  workerPunchNotice,
  type TimePunch,
  type TimeSnapshot,
  type TimeStorage,
} from "@/lib/time";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { signedOutGate } from "@/lib/authMessages";
import { punchFailureView, type PunchFailureView } from "@/lib/punchResult";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Mode = "punch" | "crew";

type Props = {
  initial: TimeSnapshot;
  sessionEmail: string | null;
  signedIn: boolean;
  sessionEnded?: boolean;
};

export function TimeBoard({
  initial,
  sessionEmail,
  signedIn,
  sessionEnded = false,
}: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const [mode, setMode] = useState<Mode>("punch");
  const [workerId, setWorkerId] = useState(() =>
    defaultWorkerId(initial.workers, sessionEmail),
  );
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<PunchFailureView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const lastWorkerPunch = useRef<{
    punchType: "in" | "out";
    lat: number | null;
    lng: number | null;
    accuracy_m: number | null;
  } | null>(null);

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

  function clearResult() {
    setError(null);
    setFailure(null);
    setNotice(null);
  }

  async function postPunch(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    setNotice(null);
    const workerAttempt = body.foreman !== true;
    try {
      const response = await fetch("/api/time/punches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data: {
        ok?: boolean;
        error?: string;
        code?: string;
        storage?: TimeStorage;
        punch?: TimePunch;
        punches?: TimePunch[];
        distance_m?: number;
        radius_m?: number;
      };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        if (workerAttempt) setFailure(punchFailureView({ thrown: true }));
        else setError("Could not reach time. Check the connection and try again.");
        return;
      }
      if (!response.ok || !punchWriteAccepted(data)) {
        if (workerAttempt) {
          setFailure(
            punchFailureView({
              status: response.status,
              code: data.code,
              error: data.error,
              storage: data.storage,
              distance_m: data.distance_m,
              radius_m: data.radius_m ?? snapshot.site.radius_m,
              offline: typeof navigator !== "undefined" && navigator.onLine === false,
            }),
          );
        } else if (data.code === "off_site") {
          setError(
            `Off site — punch-in locked (${Math.round(data.distance_m ?? 0)} m away, fence ${data.radius_m ?? snapshot.site.radius_m} m).`,
          );
        } else if (data.storage === "unavailable") {
          setError(PUNCH_SAVE_FAILED_MESSAGE);
        } else {
          setError(data.error ?? PUNCH_SAVE_FAILED_MESSAGE);
        }
        return;
      }
      const incoming = data.punches ?? (data.punch ? [data.punch] : []);
      if (incoming.length > 0) {
        setSnapshot((prev) => ({
          ...prev,
          punches: mergePunches(prev.punches, incoming),
        }));
      }
      setFailure(null);
      if (body.foreman === true) {
        setNotice(foremanPunchNotice(typeof body.punchId === "string" ? "edit" : "add"));
      } else if (body.punchType === "in" || body.punchType === "out") {
        setNotice(workerPunchNotice(body.punchType, incoming[0]?.punched_at));
      } else {
        setNotice("Saved.");
      }
      try {
        await reload(
          body.foreman === true ? snapshot.weekStart : mondayOfWeek(todayYmd()),
        );
      } catch {
        // The punch already landed. A dropped refresh is not a failed punch.
      }
    } catch {
      if (workerAttempt) {
        setFailure(
          punchFailureView({
            thrown: true,
            offline: typeof navigator !== "undefined" && navigator.onLine === false,
          }),
        );
      } else {
        setError("Could not reach time. Check the connection and try again.");
      }
    } finally {
      setPending(false);
    }
  }

  function retryWorkerPunch() {
    const last = lastWorkerPunch.current;
    if (!last) return;
    void postPunch({
      workerId,
      pin,
      punchType: last.punchType,
      lat: last.lat,
      lng: last.lng,
      accuracy_m: last.accuracy_m,
    });
  }

  function pickWorker(id: string) {
    setWorkerId(id);
    setPin("");
    clearResult();
  }

  function pickMode(next: Mode) {
    setMode(next);
    clearResult();
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
      <p className="mt-2 max-w-2xl text-base text-muted">
        Punch in or out on your phone. On a shared iPad, switch names with a
        PIN. Crew week is the log for this job. {storageLine(snapshot.storage)}
      </p>
      {!signedIn ? (
        <SignedOutTimeNote sessionEnded={sessionEnded} />
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
            sessionEnded={sessionEnded}
            sessionEmail={sessionEmail}
            pending={pending}
            failure={failure}
            notice={notice}
            onWorkerId={pickWorker}
            onPin={setPin}
            onClearResult={clearResult}
            onRetry={retryWorkerPunch}
            onPunch={(input) => {
              lastWorkerPunch.current = input;
              return postPunch({
                workerId,
                pin,
                punchType: input.punchType,
                lat: input.lat,
                lng: input.lng,
                accuracy_m: input.accuracy_m,
              });
            }}
          />
        ) : (
          <ForemanWeekGrid
            snapshot={snapshot}
            weeks={weeks}
            signedIn={signedIn}
            sessionEnded={sessionEnded}
            pending={pending}
            error={error}
            notice={notice}
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

function SignedOutTimeNote({ sessionEnded }: { sessionEnded: boolean }) {
  const gate = signedOutGate({
    next: "/time",
    sessionEnded,
    detail: "to punch or edit.",
  });
  return (
    <div className="mt-3">
      <p className="text-base text-paper">
        {gate.lead}{" "}
        <Link href={gate.href} className="font-semibold text-accent underline">
          Sign in
        </Link>{" "}
        to punch or edit.
      </p>
      <ReadAloudButton id="time-signed-out" text={gate.text} label="Hear this" className="mt-3" />
    </div>
  );
}

function storageLine(storage: TimeStorage): string {
  if (storage === "supabase") return "Punches save to this job.";
  if (storage === "unavailable") return "Time is offline right now.";
  return "This is a demo. Punches are not on a real timesheet.";
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
          ? "bg-transparent border-b-2 border-cta px-3 py-2 text-xs font-semibold tracking-wide text-paper uppercase"
          : "bg-transparent border-b-2 border-transparent px-3 py-2 text-xs font-semibold tracking-wide text-tan uppercase hover:text-paper"
      }
    >
      {children}
    </button>
  );
}
