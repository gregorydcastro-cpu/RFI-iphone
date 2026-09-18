"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type DemoJob } from "@/lib/jobs";
import { packStatusSessionKey } from "@/lib/packStatus";

type Props = {
  job: DemoJob;
};

type RoomPackApiOk = {
  ok: true;
  mode: "demo" | "webhook";
  requestId: string;
  job: string;
  room: string;
  accepted: boolean;
  poll?: boolean;
  statusUrl?: string;
};

type RoomPackApiErr = {
  ok: false;
  error?: string;
};

export function RequestPackForm({ job }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState("733");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const roomValue = room.trim();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/room-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectSlug: job.slug, room: roomValue }),
      });

      const data = (await response.json()) as RoomPackApiOk | RoomPackApiErr;
      if (!response.ok || !data.ok) {
        const message =
          !data.ok && data.error
            ? data.error
            : "Room pack request was not accepted";
        setError(message);
        return;
      }

      const params = new URLSearchParams({
        job: data.job,
        room: data.room,
      });
      if (data.accepted) params.set("accepted", "1");
      if (data.poll) params.set("poll", "1");

      if (data.statusUrl) {
        try {
          window.sessionStorage.setItem(
            packStatusSessionKey(data.requestId),
            data.statusUrl,
          );
        } catch {
          // sessionStorage may be unavailable; env template still polls.
        }
      }

      console.info("[gcfieldlog] room-pack request", {
        job: data.job,
        room: data.room,
        requestId: data.requestId,
        mode: data.mode,
        accepted: data.accepted,
        poll: Boolean(data.poll),
      });

      router.push(`/pack/${data.requestId}?${params.toString()}`);
    } catch {
      setError("Could not reach the room pack service. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-4 border border-line bg-panel p-5"
    >
      <div>
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          Request room pack
        </p>
        <h1 className="font-display mt-1 text-2xl tracking-wide text-paper sm:text-3xl">
          {job.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Local demo loads Maple Point JSON and does not call Procore.
          Production POSTs this job’s exact name and company id, then opening
          the pack viewer pulls a fresh pack (drawing + rev + pulled_at).
        </p>
      </div>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Room
        <input
          required
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          disabled={pending}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 font-mono text-sm text-paper outline-none focus:border-cta disabled:opacity-60"
          placeholder="733"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
      >
        {pending ? "Requesting…" : "Request pack"}
      </button>
    </form>
  );
}
