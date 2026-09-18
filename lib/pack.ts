export type PackStatus = "ready" | "pending" | "error" | string;

export type Project = {
  id: string;
  name: string;
  slug: string;
};

export type Room = {
  id: string;
  name: string;
  number?: string;
};

export type NormalizedBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Sheet = {
  /** Drawing number at pull time. */
  id: string;
  /** Revision letter at pull time. */
  rev: string;
  pdf: string;
  preview?: string | null;
  crop?: NormalizedBBox | null;
};

/** Drawing number + revision letter stamped when the pack was pulled. */
export type RevisionStamp = {
  drawing: string;
  rev: string;
};

export type PdfPointBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Layout = {
  sheet?: string;
  type?: "polygon" | "bbox";
  points?: [number, number][];
  bbox?: NormalizedBBox;
  /** Procore v1 field: PDF user-space points, origin bottom-left. */
  bbox_pdf_pts?: PdfPointBBox;
  locator?: string;
  page_width_pts?: number;
  page_height_pts?: number;
};

export type Rfi = {
  id: string;
  number: string;
  title: string;
  status: string;
  url?: string | null;
};

export type PackAction = {
  id: string;
  label: string;
  href?: string;
  enabled?: boolean;
  note?: string;
};

export type FixtureCount = {
  type: string;
  qty: number;
};

export type TakeoffRoom = {
  room: string;
  name: string;
  sheet: string;
  fixtures: FixtureCount[];
};

export type TakeoffType = {
  type: string;
  qty: number;
};

export type TakeoffSheet = {
  sheet: string;
  qty: number;
};

export type Takeoff = {
  project: string;
  scope: string;
  sheets: string[];
  units: string;
  by_room: TakeoffRoom[];
  by_type?: TakeoffType[];
  by_sheet?: TakeoffSheet[];
  confidence?: string;
  flags?: string[];
};

/**
 * Local demo packs may be a simplified JSON file. The viewer consumes this
 * `gcpullog.room_pack.v1`-shaped object. See README for the Procore contract.
 */
export type RoomPack = {
  schema?: "gcpullog.room_pack.v1";
  status: PackStatus;
  request_id: string;
  /** ISO timestamp of this pull. Lives in pack_data, not a table column. */
  pulled_at?: string;
  /** Primary sheet drawing + rev at pull time. */
  revision_stamp?: RevisionStamp;
  /** Dynamic per job — never a single hardcoded company. */
  company_id?: string;
  project_id?: string;
  project: Project;
  room: Room;
  sheets: Sheet[];
  rfis: Rfi[];
  locator?: string;
  pack_pdf?: string | null;
  layout: Layout;
  actions: PackAction[];
  flags?: string[];
  takeoff?: Takeoff;
};

export const DEFAULT_ACTIONS: PackAction[] = [
  {
    id: "generate-rfi",
    label: "Generate RFI",
    href: "/pack/maple-point/rfi/new",
    enabled: false,
    note: "Draft to foreman — not a Procore submit",
  },
  {
    id: "order-materials",
    label: "Order materials",
    href: "/pack/maple-point/materials",
    enabled: false,
    note: "Coming soon",
  },
];

export function packActions(pack: RoomPack): PackAction[] {
  if (pack.actions?.length) {
    return pack.actions.map((action) => ({
      ...action,
      href:
        action.href ??
        (action.id === "generate-rfi"
          ? `/pack/${pack.request_id}/rfi/new`
          : action.id === "order-materials"
            ? `/pack/${pack.request_id}/materials`
            : undefined),
    }));
  }
  return DEFAULT_ACTIONS.map((action) => ({
    ...action,
    href: action.href?.replace("maple-point", pack.request_id),
  }));
}

export function sheetRevisionLabel(sheet: Pick<Sheet, "id" | "rev">): string {
  return `${sheet.id} Rev ${sheet.rev}`;
}

export function stampSheet(sheet: {
  id?: string | null;
  rev?: string | null;
  pdf?: string | null;
  preview?: string | null;
  crop?: NormalizedBBox | null;
}): Sheet {
  const id = typeof sheet.id === "string" ? sheet.id.trim() : "";
  const rev = typeof sheet.rev === "string" ? sheet.rev.trim() : "";
  return {
    id: id || "UNKNOWN",
    rev: rev || "?",
    pdf: typeof sheet.pdf === "string" ? sheet.pdf : "",
    preview: sheet.preview ?? null,
    crop: sheet.crop ?? null,
  };
}

export function primaryRevisionStamp(pack: {
  sheets: Sheet[];
  layout?: Layout;
  revision_stamp?: RevisionStamp;
}): RevisionStamp | undefined {
  if (
    pack.revision_stamp &&
    pack.revision_stamp.drawing &&
    pack.revision_stamp.rev
  ) {
    return {
      drawing: pack.revision_stamp.drawing,
      rev: pack.revision_stamp.rev,
    };
  }
  const preferredId = pack.layout?.sheet;
  const sheet =
    (preferredId
      ? pack.sheets.find((item) => item.id === preferredId)
      : undefined) ?? pack.sheets[0];
  if (!sheet) return undefined;
  return { drawing: sheet.id, rev: sheet.rev };
}

export function stampRoomPack(
  pack: RoomPack,
  options?: { pulledAt?: string; touch?: boolean },
): RoomPack {
  const sheets = (pack.sheets ?? []).map((sheet) => stampSheet(sheet));
  const pulledAt = options?.touch
    ? (options.pulledAt ?? new Date().toISOString())
    : (pack.pulled_at ?? options?.pulledAt);
  const locator = pack.locator ?? pack.layout?.locator;
  const next: RoomPack = {
    ...pack,
    schema: "gcpullog.room_pack.v1",
    sheets,
    pulled_at: pulledAt,
    locator,
    layout: {
      ...pack.layout,
      locator: pack.layout?.locator ?? locator,
    },
  };
  next.revision_stamp = primaryRevisionStamp(next);
  return next;
}

function asNonEmpty(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function projectFromPackData(
  rec: Record<string, unknown>,
): Project | undefined {
  const projectId = asNonEmpty(rec.project_id);
  if (typeof rec.project === "string") {
    const name = rec.project.trim();
    if (!name) return undefined;
    return {
      id: projectId ?? name,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    };
  }
  if (rec.project && typeof rec.project === "object") {
    const project = rec.project as Record<string, unknown>;
    const name = asNonEmpty(project.name);
    if (!name) return undefined;
    return {
      id: asNonEmpty(project.id) ?? projectId ?? name,
      name,
      slug:
        asNonEmpty(project.slug) ??
        name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    };
  }
  return undefined;
}

function roomFromPackData(rec: Record<string, unknown>): Room | undefined {
  if (typeof rec.room === "string") {
    const name = rec.room.trim();
    if (!name) return undefined;
    return { id: name, name, number: name };
  }
  if (rec.room && typeof rec.room === "object") {
    const room = rec.room as Record<string, unknown>;
    const name = asNonEmpty(room.name) ?? asNonEmpty(room.number);
    if (!name) return undefined;
    return {
      id: asNonEmpty(room.id) ?? name,
      name,
      number: asNonEmpty(room.number),
    };
  }
  return undefined;
}

/**
 * Normalize `public.room_packs.pack_data` (gcpullog.room_pack.v1) into the
 * viewer shape. Accepts project/room as exact-name strings or objects.
 */
export function normalizeRoomPack(value: unknown): RoomPack | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.status !== "string") return null;
  if (!Array.isArray(rec.sheets)) return null;
  const project = projectFromPackData(rec);
  const room = roomFromPackData(rec);
  if (!project || !room) return null;

  const layout =
    rec.layout && typeof rec.layout === "object"
      ? (rec.layout as Layout)
      : {};
  const locator =
    asNonEmpty(rec.locator) ?? asNonEmpty(layout.locator);

  const pack: RoomPack = {
    schema: "gcpullog.room_pack.v1",
    status: rec.status,
    request_id: asNonEmpty(rec.request_id) ?? "",
    pulled_at: asNonEmpty(rec.pulled_at),
    company_id: asNonEmpty(rec.company_id),
    project_id: asNonEmpty(rec.project_id) ?? project.id,
    project,
    room,
    sheets: rec.sheets as Sheet[],
    rfis: Array.isArray(rec.rfis) ? (rec.rfis as RoomPack["rfis"]) : [],
    locator,
    pack_pdf: asNonEmpty(rec.pack_pdf) ?? null,
    layout: { ...layout, locator: layout.locator ?? locator },
    actions: Array.isArray(rec.actions)
      ? (rec.actions as RoomPack["actions"])
      : [],
    flags: Array.isArray(rec.flags)
      ? rec.flags.filter((flag): flag is string => typeof flag === "string")
      : undefined,
    takeoff:
      rec.takeoff && typeof rec.takeoff === "object"
        ? (rec.takeoff as RoomPack["takeoff"])
        : undefined,
    revision_stamp:
      rec.revision_stamp && typeof rec.revision_stamp === "object"
        ? (rec.revision_stamp as RevisionStamp)
        : undefined,
  };
  return stampRoomPack(pack);
}

export function formatPulledAt(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
