"use client";

import { formatDistance } from "@/lib/geofence";
import {
  formatPunchStamp,
  isOnClock,
  latestPunch,
  type JobSite,
  type TimePunch,
  type Worker,
} from "@/lib/time";
import { LOCATION_ENABLE_HINT, useSiteGeofence } from "@/components/useSiteGeofence";
import { useState } from "react";

const inputClass =
  "mt-1 w-full border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta";

type Props = {
  site: JobSite;
  workers: Worker[];
  punches: TimePunch[];
  workerId: string;
  pin: string;
  signedIn: boolean;
  pending: boolean;
  error: string | null;
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
  pending,
  error,
  onWorkerId,
  onPin,
  onPunch,
}: Props) {
  const { geo, retry } = useSiteGeofence(site);
  const worker = workers.find((row) => row.id === workerId) ?? workers[0];
  const onClock = worker ? isOnClock(punches, worker.id) : false;
  const last = worker ? latestPunch(punches, worker.id) : null;
  const inside = geo.status === "ready" && geo.inside;
  const punchInLocked = !inside || onClock || pending || !signedIn;
  const punchOutLocked = !onClock || pending || !signedIn;
  const [hint, setHint] = useState<string | null>(null);

  async function punch(type: "in" | "out") {
    setHint(null);
    if (type === "in" && geo.status !== "ready") {
      setHint(LOCATION_ENABLE_HINT);
      return;
    }
    if (type === "in" && geo.status === "ready" && !geo.inside) {
      setHint(
        `Not on site — ${formatDistance(geo.distance_m)} from ${site.name}. Punch-in unlocks inside ${site.radius_m} m.`,
      );
      return;
    }
    const coords =
      geo.status === "ready"
        ? { lat: geo.lat, lng: geo.lng, accuracy_m: geo.accuracy_m }
        : { lat: null, lng: null, accuracy_m: null };
    await onPunch({ punchType: type, ...coords });
  }

  return (
    <section className="max-w-lg border border-line bg-panel p-5">
      <h2 className="font-display text-xl tracking-wide text-paper">Punch</h2>
      <p className="mt-1 text-sm text-muted">
        Phone or job iPad. PIN is a demo stub, not real auth. Punch-in only
        inside the Maple Point fence.
      </p>

      <label className="mt-4 block text-xs font-semibold tracking-wide text-muted uppercase">
        Worker
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

      <label className="mt-3 block text-xs font-semibold tracking-wide text-muted uppercase">
        PIN stub
        <input
          className={inputClass}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          placeholder="4 digits"
          value={pin}
          onChange={(event) => onPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      </label>
      {worker ? (
        <p className="mt-1 font-mono text-xs text-metal">
          Demo PIN {worker.pin_stub}
        </p>
      ) : null}

      <GeofenceBanner site={site} geo={geo} onRetry={retry} />

      {last ? (
        <p className="mt-3 text-sm text-paper">
          Last: {last.punch_type === "in" ? "IN" : "OUT"}{" "}
          {formatPunchStamp(last.punched_at)}
          {onClock ? " · on the clock" : ""}
          {last.edited_by_foreman ? " · foreman edit" : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">No punches yet this week.</p>
      )}

      {!signedIn ? (
        <p className="mt-3 text-sm text-cta" role="status">
          Sign in (stub) before punching.
        </p>
      ) : null}
      {hint ? (
        <p className="mt-3 text-sm text-cta" role="alert">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-cta" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={punchInLocked}
          onClick={() => void punch("in")}
          className="bg-cta px-3 py-4 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-panel-2 disabled:text-tan disabled:opacity-70"
        >
          {pending && !onClock ? "Saving…" : "Punch in"}
        </button>
        <button
          type="button"
          disabled={punchOutLocked}
          onClick={() => void punch("out")}
          className="border border-line bg-ink px-3 py-4 text-sm font-semibold tracking-wide text-paper uppercase hover:border-cta disabled:cursor-not-allowed disabled:text-tan disabled:opacity-70"
        >
          {pending && onClock ? "Saving…" : "Punch out"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Punch-out can run off-site. Scan paper sign-in is later — not in this
        slice.
      </p>
      <button
        type="button"
        disabled
        className="mt-2 w-full cursor-not-allowed border border-dashed border-line px-3 py-2 text-xs tracking-wide text-tan uppercase"
        title="Later"
      >
        Scan paper sign-in (later)
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
      <p className="mt-4 border border-line bg-ink px-3 py-3 text-sm text-muted">
        Checking if this device is on site…
      </p>
    );
  }
  if (geo.status === "ready" && geo.inside) {
    return (
      <p className="mt-4 border border-cta/40 bg-ink px-3 py-3 text-sm text-paper">
        On site · {formatDistance(geo.distance_m)} from {site.name} (fence{" "}
        {site.radius_m} m).
      </p>
    );
  }
  if (geo.status === "ready") {
    return (
      <div className="mt-4 border border-cta/50 bg-ink px-3 py-3 text-sm text-paper">
        <p className="font-semibold text-cta">Not on site — punch-in locked</p>
        <p className="mt-1 text-muted">
          {formatDistance(geo.distance_m)} from {site.name}. Be inside{" "}
          {site.radius_m} m of {site.lat.toFixed(4)}, {site.lng.toFixed(4)}{" "}
          ({site.city}).
        </p>
      </div>
    );
  }
  return (
    <div className="mt-4 border border-cta/50 bg-ink px-3 py-3 text-sm text-paper">
      <p className="font-semibold text-cta">Punch-in locked — no location</p>
      <p className="mt-1 text-muted">{geo.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-xs font-semibold tracking-wide text-accent uppercase hover:text-cta"
      >
        Retry location
      </button>
    </div>
  );
}
