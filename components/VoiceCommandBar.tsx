"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DictationButton } from "@/components/DictationButton";
import { VoiceSetupNote } from "@/components/VoiceSetupNote";
import type { DemoJob } from "@/lib/jobs";
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
  const response = await fetch("/api/room-pack", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectSlug: job.slug, room }),
  });
  const data = (await response.json()) as {
    ok?: boolean;
    requestId?: string;
    job?: string;
    room?: string;
    error?: string;
  };
  if (!response.ok || !data.ok || !data.requestId) {
    throw new Error(data.error ?? "Room pack request was not accepted");
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
  const [status, setStatus] = useState<string | null>(null);
  const procoreLinked = Boolean(props.procoreLinked);

  async function onTranscript(text: string) {
    setError(null);
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
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not open that pack. Try the form.",
      );
    }
  }

  const hint =
    props.mode === "jobs"
      ? 'Say “open Maple Point pack” or “pull room 101”. Viewers open; connected pullers refresh.'
      : 'Say “pull room 101” or “open room 733”. Uses the same open/pull path as the button.';

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
      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
