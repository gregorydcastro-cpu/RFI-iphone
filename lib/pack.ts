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
  /** Drawing number (sheet id) at pull time. */
  id: string;
  /** Revision letter at pull time. */
  rev: string;
  pdf: string;
  preview?: string | null;
  crop?: NormalizedBBox | null;
  /** Optional sheet title (e.g. Level 1 Floor Plan). Used by viewer heuristics. */
  title?: string | null;
  name?: string | null;
  discipline?: string | null;
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

/** Live Procore-bot room outline. Coordinates may be pdf_pts or normalized. */
export type WallBounds = {
  sheet_id?: string;
  units?: string;
  bbox?: PdfPointBBox;
  polygon?: [number, number][];
  page_width_pts?: number;
  page_height_pts?: number;
  origin?: "bottom-left" | "top-left";
};

export type Layout = {
  sheet?: string;
  sheet_id?: string;
  type?: "polygon" | "bbox";
  points?: [number, number][];
  bbox?: NormalizedBBox;
  /** Procore v1 field: PDF user-space points, origin bottom-left. Object or [x1,y1,x2,y2]. */
  bbox_pdf_pts?: PdfPointBBox;
  locator?: string;
  page_width_pts?: number;
  page_height_pts?: number;
  /** Nested live-bot outline. Parsed alongside the fields above. */
  wall_bounds?: WallBounds;
  room?: unknown;
  floor?: string;
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
  /** ISO timestamp of this pull. Live website views re-pull; do not treat as cache expiry. */
  pulled_at?: string;
  /** Primary sheet drawing + rev at pull time (usually layout.sheet / sheets[0]). */
  revision_stamp?: RevisionStamp;
  project: Project;
  room: Room;
  sheets: Sheet[];
  rfis: Rfi[];
  layout: Layout;
  actions: PackAction[];
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
  const rev = sheet.rev?.trim();
  if (!rev || rev === "?") return sheet.id;
  return `${sheet.id} Rev ${rev}`;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function stampSheet(sheet: {
  id?: string | null;
  rev?: string | null;
  pdf?: string | null;
  preview?: string | null;
  crop?: NormalizedBBox | string | null;
  title?: string | null;
  name?: string | null;
  discipline?: string | null;
}): Sheet {
  const id = typeof sheet.id === "string" ? sheet.id.trim() : "";
  const rev = typeof sheet.rev === "string" ? sheet.rev.trim() : "";
  const preview = typeof sheet.preview === "string" ? sheet.preview : null;
  const cropUrl = typeof sheet.crop === "string" ? sheet.crop : null;
  const pdfRaw =
    (typeof sheet.pdf === "string" && sheet.pdf.trim()) ||
    (typeof preview === "string" && preview.trim()) ||
    (cropUrl && cropUrl.trim()) ||
    "";
  const crop =
    sheet.crop && typeof sheet.crop === "object" ? sheet.crop : null;
  const driveId = pdfRaw.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i)?.[1];
  const pdf = driveId
    ? `https://drive.google.com/uc?export=download&id=${driveId}`
    : pdfRaw;
  return {
    id: id || "UNKNOWN",
    rev,
    pdf,
    preview,
    crop,
    title: optionalText(sheet.title),
    name: optionalText(sheet.name),
    discipline: optionalText(sheet.discipline),
  };
}

export function sheetTitle(sheet: Pick<Sheet, "id" | "title" | "name">): string {
  return sheet.title?.trim() || sheet.name?.trim() || sheet.id;
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
  const preferredId =
    pack.layout?.sheet || pack.layout?.wall_bounds?.sheet_id;
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
  const next: RoomPack = {
    ...pack,
    schema: "gcpullog.room_pack.v1",
    sheets,
    pulled_at: pulledAt,
  };
  next.revision_stamp = primaryRevisionStamp(next);
  return next;
}

export function formatPulledAt(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
