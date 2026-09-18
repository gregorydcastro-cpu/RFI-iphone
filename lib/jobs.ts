export type DemoJob = {
  slug: string;
  name: string;
  city: string;
  phase: string;
  roomsHint: string;
  /** Procore company id for this job. Never a single global company. */
  companyId: string;
};

/** Fictional jobs only. Never Brown, Rossi, ILSB, EL107, Danoff, Suffolk. */
export const DEMO_JOBS: DemoJob[] = [
  {
    slug: "maple-point",
    name: "Maple Point Medical Office",
    city: "Cedar Falls",
    phase: "Electrical rough-in",
    roomsHint: "101 · 102 · 733",
    companyId: "91001",
  },
  {
    slug: "cedar-ridge",
    name: "Cedar Ridge Outpatient",
    city: "North Mill",
    phase: "Overhead MEP",
    roomsHint: "200s",
    companyId: "91002",
  },
  {
    slug: "harbor-view",
    name: "Harbor View Tenant Fit-Out",
    city: "West Landing",
    phase: "Trim / devices",
    roomsHint: "Level 3",
    companyId: "91003",
  },
  {
    slug: "pine-hollow",
    name: "Pine Hollow Warehouse",
    city: "Ridge Line",
    phase: "Gear set",
    roomsHint: "Electrical rooms",
    companyId: "91004",
  },
];

export function getJob(slug: string): DemoJob | undefined {
  return DEMO_JOBS.find((job) => job.slug === slug);
}

export function jobFromRequestId(requestId: string): DemoJob | undefined {
  const exact = DEMO_JOBS.find((job) => job.slug === requestId);
  if (exact) return exact;
  return DEMO_JOBS.find((job) => requestId.startsWith(`${job.slug}-`));
}

export function roomFromRequestId(
  requestId: string,
  job: DemoJob,
): string | undefined {
  if (requestId === job.slug) return undefined;
  const prefix = `${job.slug}-`;
  if (!requestId.startsWith(prefix)) return undefined;
  const room = requestId.slice(prefix.length).trim();
  return room.length > 0 ? room : undefined;
}

export function makeRequestId(projectSlug: string, room: string): string {
  const safeRoom = room.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "room";
  return `${projectSlug}-${safeRoom}`.toLowerCase();
}
