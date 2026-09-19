import type { RoomPack } from "./pack";
import { readProjectAllowlist } from "./procoreAllowlist.ts";

export type DemoJob = {
  slug: string;
  name: string;
  city: string;
  phase: string;
  roomsHint: string;
};

/** Short Maple Point labels used by share/Time/voice — still fictional demo. */
const MAPLE_POINT_DEMO_ALIASES = ["maple point"] as const;

/** Fictional jobs only. Never Brown, Rossi, ILSB, EL107, Danoff, Suffolk. */
export const DEMO_JOBS: DemoJob[] = [
  {
    slug: "maple-point",
    name: "Maple Point Medical Office",
    city: "Cedar Falls",
    phase: "Electrical rough-in",
    roomsHint: "101 · 102 · 733",
  },
  {
    slug: "cedar-ridge",
    name: "Cedar Ridge Outpatient",
    city: "North Mill",
    phase: "Overhead MEP",
    roomsHint: "200s",
  },
  {
    slug: "harbor-view",
    name: "Harbor View Tenant Fit-Out",
    city: "West Landing",
    phase: "Trim / devices",
    roomsHint: "Level 3",
  },
  {
    slug: "pine-hollow",
    name: "Pine Hollow Warehouse",
    city: "Ridge Line",
    phase: "Gear set",
    roomsHint: "Electrical rooms",
  },
];

export function slugFromProjectName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "job"
  );
}

/** Live / allowlisted job identity. Not shown on the Maple Point jobs list. */
export function jobFromProjectName(name: string): DemoJob {
  const trimmed = name.trim();
  return {
    slug: slugFromProjectName(trimmed),
    name: trimmed,
    city: "",
    phase: "Live",
    roomsHint: "",
  };
}

export function jobFromPack(pack: RoomPack | null | undefined): DemoJob | undefined {
  if (!pack) return undefined;
  const name = pack.project?.name?.trim();
  if (!name) return undefined;
  const slug = pack.project.slug?.trim() || slugFromProjectName(name);
  return {
    slug,
    name,
    city: "",
    phase: "Live",
    roomsHint: "",
  };
}

function allowlistedJobBySlug(slug: string): DemoJob | undefined {
  const want = slug.trim().toLowerCase();
  if (!want) return undefined;
  for (const name of readProjectAllowlist()) {
    if (slugFromProjectName(name) === want) return jobFromProjectName(name);
  }
  return undefined;
}

export function getJob(slug: string): DemoJob | undefined {
  const demo = DEMO_JOBS.find((job) => job.slug === slug);
  if (demo) return demo;
  return allowlistedJobBySlug(slug);
}

export function jobFromRequestId(requestId: string): DemoJob | undefined {
  const exact = getJob(requestId);
  if (exact) return exact;
  const demo = DEMO_JOBS.find((job) => requestId.startsWith(`${job.slug}-`));
  if (demo) return demo;
  for (const name of readProjectAllowlist()) {
    const slug = slugFromProjectName(name);
    if (requestId === slug || requestId.startsWith(`${slug}-`)) {
      return jobFromProjectName(name);
    }
  }
  return undefined;
}

/**
 * Resolve a pull target: demo catalog, optional allowlist, exact
 * projectName, or a cached room_packs row. DEMO_JOBS is not required.
 */
export function resolvePullJob(input: {
  projectSlug?: string | null;
  projectName?: string | null;
  requestId?: string | null;
  pack?: RoomPack | null;
}): DemoJob | undefined {
  const slug = input.projectSlug?.trim() || null;
  const name = input.projectName?.trim() || null;
  if (slug) {
    const bySlug = getJob(slug);
    if (bySlug) return bySlug;
  }
  if (input.requestId) {
    const byRequest = jobFromRequestId(input.requestId);
    if (byRequest) return byRequest;
  }
  const fromPack = jobFromPack(input.pack ?? null);
  if (fromPack) return fromPack;
  if (name) return jobFromProjectName(name);
  return undefined;
}

export function makeRequestId(projectSlug: string, room: string): string {
  const safeRoom = room.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "room";
  return `${projectSlug}-${safeRoom}`.toLowerCase();
}

export type DemoJobRef = {
  slug?: string | null;
  name?: string | null;
  projectName?: string | null;
  requestId?: string | null;
};

function normalizeJobKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isDemoSlugOrRequestId(value: string): boolean {
  if (!value) return false;
  return DEMO_JOBS.some(
    (job) => value === job.slug || value.startsWith(`${job.slug}-`),
  );
}

function isDemoProjectLabel(value: string): boolean {
  if (!value) return false;
  if (DEMO_JOBS.some((job) => job.name.toLowerCase() === value)) return true;
  return (MAPLE_POINT_DEMO_ALIASES as readonly string[]).includes(value);
}

/**
 * Fictional DEMO_JOBS / Maple Point (and any other demo slug or name
 * in DEMO_JOBS) must never enqueue a Procore bot wake or HTTP wake.
 * Cached pack / REST for these jobs is unchanged.
 */
export function isDemoOrFictionalJob(
  input?: DemoJobRef | DemoJob | string | null,
): boolean {
  if (input == null) return false;
  const ref: DemoJobRef =
    typeof input === "string"
      ? { slug: input, name: input, requestId: input }
      : input;
  const slug = normalizeJobKey(ref.slug);
  const name = normalizeJobKey(ref.name ?? ref.projectName);
  const requestId = normalizeJobKey(ref.requestId);

  if (isDemoSlugOrRequestId(slug) || isDemoProjectLabel(slug)) return true;
  if (isDemoProjectLabel(name) || isDemoSlugOrRequestId(name)) return true;
  if (isDemoSlugOrRequestId(requestId) || isDemoProjectLabel(requestId)) {
    return true;
  }
  return false;
}
