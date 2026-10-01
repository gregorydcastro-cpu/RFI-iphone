"use client";

import { formatDistance } from "@/lib/geofence";
import {
  formatPunchStamp,
  isOnClock,
  latestPunch,
  workerPunchNeedsPin,
  type JobSite,
  type TimePunch,
  type Worker,
} from "@/lib/time";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { sessionGateLead } from "@/lib/authMessages";
import { LOCATION_ENABLE_HINT, useSiteGeofence } from "@/components/useSiteGeofence";
import { useState } from "react";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-3 text-base text-paper outline-none focus:border-cta";

type Props = {
  site: JobSite;
  workers: Worker[];
  punches: TimePunch[];
  workerId: string;
  pin: string;
  signedIn: boolean;
  sessionEnded?: boolean;
  sessionEmail: string | null;
  pending: boolean;
  error: string | null;
  notice: string | null;
  onWorkerId: (id: string) => void;
  onPin: (pin: string) => void;
  onPunch: (input: {
    punchType: "in" | "out";
    lat: number | null;
    lng: number | null;
    accuracy_m: number | null;
  }) => Promise<void>;
};

export function WorkerPunchCard({
  site,
  workers,
  punches,
  workerId,
  pin,
  signedIn,
  sessionEnded = false,
  sessionEmail,
  pending,
  error,
  notice,
  onWorkerId,
  onPin,
  onPunch,
}: Props) {
  const { geo, retry } = useSiteGeofence(site);
  const worker = workers.find((row) => row.id === workerId) ?? workers[0];
  const onClock = worker ? isOnClock(punches, worker.id) : false;
  const last = worker ? latestPunch(punches, worker.id) : null;
  const inside = geo.status === "ready" && geo.inside;
  const needsPin = worker ? workerPunchNeedsPin(worker, workers, sessionEmail) : true;
  const pinOk = Boolean(worker) && (!needsPin || pin === worker?.pin_stub);
  const punchInLocked = !inside || onClock || pending || !signedIn || !pinOk;
  const punchOutLocked = !onClock || pending || !signedIn || !pinOk;
  const [hint, setHint] = useState<string | null>(null);
  const clockTitle = onClock
    ? "Punched in"
    : last?.punch_type === "out"
      ? "Punched out"
      : "Not punched in";
  const statusLine = onClock
    ? "Punched in. You are on the clock."
    : last?.punch_type === "out"
      ? "Punched out. You are off the clock."
      : "Not punched in. You are off the clock.";
  const gateLine = signedIn
    ? null
    : `${sessionGateLead(sessionEnded)} Sign in before punching.`;
  const spoken = notice ?? error ?? hint ?? gateLine ?? statusLine;

  async function punch(type: "in" | "out") {
    setHint(null);
    if (type === "in" && geo.status !== "ready") {
      setHint(LOCATION_ENABLE_HINT);
      return;
    }
    if (type === "in" && geo.status === "ready" && !geo.inside) {
      setHint(
        `Not on site — ${formatDistance(geo.distance_m)} from ${site.name}. Punch in unlocks inside ${site.radius_m} m.`,
      );
      return;
    }
    if (worker && needsPin && pin !== worker.pin_stub) {
      setHint(`Enter the PIN for ${worker.name}.`);
      return;
    }
    const coords =
      geo.status === "ready"
        ? { lat: geo.lat, lng: geo.lng, accuracy_m: geo.accuracy_m }
        : { lat: null, lng: null, accuracy_m: null };
    await onPunch({ punchType: type, ...coords });
  }

  const inButtonClass = onClock
    ? "border border-line bg-ink text-paper"
    : "bg-cta text-secondary hover:bg-cta-hover";
  const outButtonClass = onClock
    ? "bg-cta text-secondary hover:bg-cta-hover"
    : "border border-line bg-ink text-paper";

  return (
    <section className="max-w-lg border border-line bg-panel p-5">
      <h2 className="font-display text-xl tracking-wide text-paper">Punch</h2>
      <p className="mt-1 text-base text-muted">
        Pick your name. Punch in only works on this job site. A shared iPad
        needs a PIN when you switch names.
      </p>

      <label className="mt-4 block text-sm font-semibold tracking-wide text-muted uppercase">
        Name
        <select
          className={inputClass}
          value={worker?.id ?? ""}
          onChange={(event) => onWorkerId(event.target.value)}
        >
          {workers.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name} · {row.role}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-sm font-semibold tracking-wide text-muted uppercase">
        PIN
        <input
          className={inputClass}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder={needsPin ? "4 digits" : "Only if you switch names"}
          value={pin}
          onChange={(event) => onPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          aria-describedby="punch-pin-help"
        />
      </label>
      <p id="punch-pin-help" className="mt-1 text-sm text-metal">
        {worker && needsPin
          ? `Enter PIN ${worker.pin_stub} for ${worker.name}.`
          : "No PIN for your name. Use a PIN only to punch for someone else."}
      </p>

      <GeofenceBanner site={site} geo={geo} onRetry={retry} />

      <p
        className={`mt-4 border px-3 py-3 ${
          onClock ? "border-accent-2/60 bg-ink" : "border-line bg-ink"
        }`}
        role="status"
      >
        <span className="font-display block text-2xl tracking-wide text-paper">
          {clockTitle}
        </span>
        <span className="mt-1 block text-base text-paper">{statusLine}</span>
        {last ? (
          <span className="mt-1 block text-sm text-muted">
            Last {last.punch_type === "in" ? "in" : "out"}{" "}
            {formatPunchStamp(last.punched_at)}
            {last.edited_by_foreman ? " · foreman edit" : ""}
          </span>
        ) : (
          <span className="mt-1 block text-sm text-muted">No punches yet this week.</span>
        )}
      </p>

      {!signedIn && gateLine ? (
        <p className="mt-3 text-base text-cta" role="status">
          {gateLine}
        </p>
      ) : null}
      {hint ? (
        <p className="mt-3 border border-cta/50 bg-cta/10 px-3 py-3 text-base text-cta" role="alert">
          {hint}
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
      <ReadAloudButton id="punch-status" text={spoken} label="Hear this" className="mt-3" />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={punchInLocked}
          onClick={() => void punch("in")}
          className={`min-h-14 px-3 py-4 text-base font-semibold tracking-wide uppercase disabled:cursor-not-allowed disabled:bg-panel-2 disabled:text-tan disabled:opacity-70 ${inButtonClass}`}
        >
          {pending && !onClock ? "Saving…" : "Punch in"}
        </button>
        <button
          type="button"
          disabled={punchOutLocked}
          onClick={() => void punch("out")}
          className={`min-h-14 px-3 py-4 text-base font-semibold tracking-wide uppercase disabled:cursor-not-allowed disabled:bg-panel-2 disabled:text-tan disabled:opacity-70 ${outButtonClass}`}
        >
          {pending && onClock ? "Saving…" : "Punch out"}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        Punch out can run off site. Paper sign-in scan is phase 2.
      </p>
      <button
        type="button"
        disabled
        className="mt-2 w-full cursor-not-allowed border border-dashed border-line px-3 py-2 text-xs tracking-wide text-tan uppercase"
        title="Later"
      >
        Scan paper sign-in (phase 2)
      </button>
    </section>
  );
}

function GeofenceBanner({
  site,
  geo,
  onRetry,
}: {
  site: JobSite;
  geo: ReturnType<typeof useSiteGeofence>["geo"];
  onRetry: () => void;
}) {
  if (geo.status === "pending") {
    return (
      <p className="mt-4 border border-line bg-ink px-3 py-3 text-base text-muted">
        Checking if this phone is on site…
      </p>
    );
  }
  if (geo.status === "ready" && geo.inside) {
    return (
      <p className="mt-4 border border-accent-2/50 bg-ink px-3 py-3 text-base text-paper">
        On site · {formatDistance(geo.distance_m)} from {site.name}. Punch in is
        open.
      </p>
    );
  }
  if (geo.status === "ready") {
    return (
      <div className="mt-4 border border-cta/50 bg-ink px-3 py-3 text-base text-paper">
        <p className="font-semibold text-cta">Not on site — punch in is locked</p>
        <p className="mt-1 text-muted">
          {formatDistance(geo.distance_m)} from {site.name}. Be inside{" "}
          {site.radius_m} m to punch in.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border border-cta/50 bg-ink px-3 py-3 text-base text-paper">
      <p className="font-semibold text-cta">Punch in is locked — no location</p>
      <p className="mt-1 text-muted">{geo.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 text-sm font-semibold tracking-wide text-accent uppercase hover:text-cta"
      >
        Retry location
      </button>
    </div>
  );
}
