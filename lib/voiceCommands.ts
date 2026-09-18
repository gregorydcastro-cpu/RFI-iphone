import type { DemoJob } from "./jobs";

export type VoiceCommand =
  | { kind: "open-job"; job: DemoJob }
  | { kind: "open-pack"; job: DemoJob; room: string };

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(the|a|an|please|pack|job|project|medical|office|open|pull|show)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function matchDemoJob(text: string, jobs: DemoJob[]): DemoJob | undefined {
  const hay = normalize(text);
  if (!hay) return undefined;
  let best: { job: DemoJob; score: number } | undefined;
  for (const job of jobs) {
    const name = normalize(job.name);
    const slug = normalize(job.slug.replace(/-/g, " "));
    let score = 0;
    if (hay.includes(name) || hay.includes(slug)) score = name.length;
    else if (name.split(" ").some((part) => part.length > 3 && hay.includes(part))) {
      score = 4;
    }
    if (score > 0 && (!best || score > best.score)) best = { job, score };
  }
  return best?.job;
}

function extractRoom(text: string): string | undefined {
  const match = text.match(
    /\b(?:room|closet)\s+(\d{2,4}[a-z]?)(?:\s|$|[.,])/i,
  );
  return match?.[1]?.toLowerCase();
}

function requestIdFor(job: DemoJob, room: string): string {
  const safeRoom = room.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "room";
  return `${job.slug}-${safeRoom}`.toLowerCase();
}

/**
 * Stub voice commands for Jobs / pack request.
 * Triggers the existing open/pull navigation — does not call Procore.
 */
export function parseVoiceCommand(
  raw: string,
  jobs: DemoJob[],
): VoiceCommand | null {
  const text = raw.trim();
  if (!text) return null;

  const room = extractRoom(text);
  const job = matchDemoJob(text, jobs);
  const wantsPack = /\b(pack|pull|open|room|closet)\b/i.test(text);

  if (job && room && wantsPack) {
    return { kind: "open-pack", job, room };
  }
  if (job && /\b(open|show|go to|pull)\b/i.test(text)) {
    if (room) return { kind: "open-pack", job, room };
    return { kind: "open-job", job };
  }
  if (room && /\b(pull|open|room|closet)\b/i.test(text)) {
    const maple = jobs.find((item) => item.slug === "maple-point") ?? jobs[0];
    if (!maple) return null;
    return { kind: "open-pack", job: maple, room };
  }
  if (job) return { kind: "open-job", job };
  return null;
}

export function packHrefForCommand(command: Extract<VoiceCommand, { kind: "open-pack" }>): {
  requestId: string;
  href: string;
} {
  const requestId = requestIdFor(command.job, command.room);
  const params = new URLSearchParams({
    job: command.job.slug,
    room: command.room,
  });
  return { requestId, href: `/pack/${requestId}?${params.toString()}` };
}
