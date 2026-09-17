export type DemoJob = {
  slug: string;
  name: string;
  city: string;
  phase: string;
  roomsHint: string;
};

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

export function getJob(slug: string): DemoJob | undefined {
  return DEMO_JOBS.find((job) => job.slug === slug);
}

export function makeRequestId(projectSlug: string, room: string): string {
  const safeRoom = room.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "room";
  return `${projectSlug}-${safeRoom}`.toLowerCase();
}
