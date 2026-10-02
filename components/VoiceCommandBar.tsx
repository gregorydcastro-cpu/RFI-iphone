"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DictationButton } from "@/components/DictationButton";
import { VoiceSetupNote } from "@/components/VoiceSetupNote";
import type { DemoJob } from "@/lib/jobs";
import { jobsFailureFromUnknown, type JobsOpenFailure } from "@/lib/jobsNext";
import { packHrefForCommand, parseVoiceCommand } from "@/lib/voiceCommands";

type JobsProps = {
  mode: "jobs";
  jobs: DemoJob[];
  procoreLinked?: boolean;
};

type RequestProps = {
  mode: "pack-request";
  job: DemoJob;
  procoreLinked?: boolean;
  room: string;
  onRoom: (room: string) => void;
  onOpen: (room: string) => void | Promise<void>;
};

type Props = JobsProps | RequestProps;

async function pullThenOpen(job: DemoJob, room: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/room-pack", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectSlug: job.slug, room }),
    });
  } catch (caught) {
    const error = new Error(caught instanceof Error ? caught.message : "Failed to fetch");
    (error as Error & { status: number }).status = 0;
    throw error;
  }
  const data = (await response.json().catch(() => null)) as {
    ok?: boolean;
    requestId?: string;
    job?: string;
    room?: string;
    error?: string;
  } | null;
  if (!response.ok || !data?.ok || !data.requestId) {
    const error = new Error(data?.error ?? "");
    (error as Error & { status: number }).status = response.status || 0;
    throw error;
  }
  const params = new URLSearchParams({
    job: data.job ?? job.slug,
    room: data.room ?? room,
  });
  return `/pack/${data.requestId}?${params.toString()}`;
}

export function VoiceCommandBar(props: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<JobsOpenFailure | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const lastText = useRef("");
  const procoreLinked = Boolean(props.procoreLinked);

  async function onTranscript(text: string) {
    lastText.current = text;
    setError(null);
    setFailure(null);
    setStatus(null);
    const jobs = props.mode === "jobs" ? props.jobs : [props.job];
    const command = parseVoiceCommand(text, jobs);

    if (props.mode === "pack-request") {
      if (!command) {
        setError('Try “pull room 101” or “open room 733”.');
        return;
      }
      const roomFromVoice =
        command.kind === "open-pack" ? command.room : undefined;
      const room = roomFromVoice ?? props.room.trim();
      if (!room) {
        setError("Say a room number, like pull room 101.");
        return;
      }
      if (command.kind === "open-job" && command.job.slug !== props.job.slug) {
        router.push(`/jobs/${command.job.slug}`);
        return;
      }
      props.onRoom(room);
      setStatus(
        procoreLinked
          ? `Pulling room ${room}…`
          : `Opening room ${room}…`,
      );
      await props.onOpen(room);
      return;
    }

    if (!command) {
      setError('Try “open Maple Point pack” or “pull room 101”.');
      return;
    }

    if (command.kind === "open-job") {
      setStatus(`Opening ${command.job.name}…`);
      router.push(`/jobs/${command.job.slug}`);
      return;
    }

    try {
      if (procoreLinked) {
        setStatus(`Pulling ${command.job.name} room ${command.room}…`);
        const href = await pullThenOpen(command.job, command.room);
        router.push(href);
        return;
      }
      const { href } = packHrefForCommand(command);
      setStatus(`Opening ${command.job.name} room ${command.room}…`);
      router.push(href);
    } catch (caught) {
      setFailure(jobsFailureFromUnknown(caught));
    }
  }

  const hint =
    props.mode === "jobs"
      ? "Say “open Maple Point pack” or “pull room 101”."
      : "Say “pull room 101” or “open room 733”.";

  return (
    <div className="space-y-2 border border-line bg-panel p-4">
      <p className="font-display text-xs tracking-[0.18em] text-muted uppercase">
        Voice command
      </p>
      <DictationButton
        onTranscript={onTranscript}
        label="Voice command"
        hint={hint}
      />
      <VoiceSetupNote />
      {status ? (
        <p role="status" className="text-sm text-paper">
          {status}
        </p>
      ) : null}
      {failure ? (
        <div role="alert" className="border border-tan/80 bg-ink px-3 py-3">
          <p className="text-base leading-snug text-paper">{failure.message}</p>
          {failure.retry ? (
            <button
              type="button"
              onClick={() => {
                if (lastText.current) void onTranscript(lastText.current);
              }}
              className="mt-3 inline-flex min-h-12 items-center justify-center bg-cta px-4 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
