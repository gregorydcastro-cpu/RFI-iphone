"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type DemoJob, makeRequestId } from "@/lib/jobs";

type Props = {
  job: DemoJob;
  procoreLinked?: boolean;
};

type RoomPackApiOk = {
  ok: true;
  mode: "demo" | "live";
  requestId: string;
  job: string;
  room: string;
  refresh?: boolean;
};

type RoomPackApiErr = {
  ok: false;
  error?: string;
};

export function RequestPackForm({ job, procoreLinked = false }: Props) {
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
      if (!procoreLinked) {
        const requestId = makeRequestId(job.slug, roomValue);
        const params = new URLSearchParams({
          job: job.slug,
          room: roomValue,
        });
        router.push(`/pack/${requestId}?${params.toString()}`);
        return;
      }

      const response = await fetch("/api/room-pack", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
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

      console.info("[gcfieldlog] room-pack request", {
        job: data.job,
        room: data.room,
        requestId: data.requestId,
        mode: data.mode,
        refresh: Boolean(data.refresh),
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
          {procoreLinked ? "Pull room pack" : "Open room pack"}
        </p>
        <h1 className="font-display mt-1 text-2xl tracking-wide text-paper sm:text-3xl">
          {job.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {procoreLinked ? (
            <>
              Puller session. This asks the Procore bot to refresh, then reads{" "}
              <code className="font-mono text-metal">public.room_packs</code>.
              Local demo (no{" "}
              <code className="font-mono text-metal">SUPABASE_URL</code>) loads
              Maple Point JSON and does not pull.
            </>
          ) : (
            <>
              View-only session. You can open the current pack but cannot
              trigger a Procore pull. Sign in with{" "}
              <span className="text-paper">Linked Procore account</span> to
              pull.
            </>
          )}
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
        {pending
          ? procoreLinked
            ? "Pulling…"
            : "Opening…"
          : procoreLinked
            ? "Pull pack"
            : "Open pack"}
      </button>
    </form>
  );
}
