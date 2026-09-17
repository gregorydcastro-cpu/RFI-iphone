"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { makeRequestId, type DemoJob } from "@/lib/jobs";

type Props = {
  job: DemoJob;
};

export function RequestPackForm({ job }: Props) {
  const router = useRouter();
  const [room, setRoom] = useState("733");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = makeRequestId(job.slug, room);
    console.info("[gcfieldlog] stub room-pack request", {
      job: job.slug,
      room,
      requestId,
      production:
        "POST Procore Room pack webhook, then poll Drive {project_slug}/{request_id}.json",
    });
    router.push(
      `/pack/${requestId}?job=${encodeURIComponent(job.slug)}&room=${encodeURIComponent(room.trim())}`,
    );
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
          Demo loads the local Maple Point pack immediately. Production POSTs to
          the Procore Room pack webhook, then polls Drive{" "}
          <code className="font-mono text-metal">gcpullog.room_pack.v1</code> at{" "}
          <code className="font-mono text-metal">
            {job.slug}/&lt;requestId&gt;.json
          </code>
          .
        </p>
      </div>
      <label className="block text-xs font-semibold tracking-wide text-muted uppercase">
        Room
        <input
          required
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          className="mt-1 w-full border border-line bg-ink px-3 py-2 font-mono text-sm text-paper outline-none focus:border-cta"
          placeholder="733"
        />
      </label>
      <button
        type="submit"
        className="bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Request pack
      </button>
    </form>
  );
}
