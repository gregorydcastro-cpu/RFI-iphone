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

export const GENERATE_RFI_ACTION_ID = "generate-rfi";
export const ORDER_MATERIALS_ACTION_ID = "order-materials";

export const DEFAULT_ACTIONS: PackAction[] = [
  {
    id: GENERATE_RFI_ACTION_ID,
    label: "Generate RFI",
    enabled: true,
    note: "Draft to foreman — not a Procore submit",
  },
  {
    id: ORDER_MATERIALS_ACTION_ID,
    label: "Order materials",
    enabled: true,
    note: "Draft to foreman — not a Procore PO",
  },
];

function isComingSoonNote(note: string | undefined): boolean {
  return (note ?? "").trim().toLowerCase() === "coming soon";
}

function fieldActionHref(actionId: string, requestId: string): string | undefined {
  if (actionId === GENERATE_RFI_ACTION_ID) return `/pack/${requestId}/rfi/new`;
  if (actionId === ORDER_MATERIALS_ACTION_ID) {
    return `/pack/${requestId}/materials`;
  }
  return undefined;
}

function normalizePackAction(action: PackAction, requestId: string): PackAction {
  const href = fieldActionHref(action.id, requestId) ?? action.href;
  if (action.id === GENERATE_RFI_ACTION_ID) {
    return {
      ...action,
      enabled: true,
      href,
      note: isComingSoonNote(action.note)
        ? "Draft to foreman — not a Procore submit"
        : (action.note ?? "Draft to foreman — not a Procore submit"),
    };
  }
  if (action.id === ORDER_MATERIALS_ACTION_ID) {
    return {
      ...action,
      enabled: true,
      href,
      note: isComingSoonNote(action.note)
        ? "Draft to foreman — not a Procore PO"
        : (action.note ?? "Draft to foreman — not a Procore PO"),
    };
  }
  return { ...action, href };
}

/**
 * Viewer action list. Generate RFI and Order materials are always on and
 * wired — pack JSON `enabled: false` / "Coming soon" must not hide them.
 */
export function packActions(pack: RoomPack): PackAction[] {
  const incoming = pack.actions ?? [];
  const byId = new Map(incoming.map((action) => [action.id, action]));
  const ordered: PackAction[] = [];

  for (const def of DEFAULT_ACTIONS) {
    const fromPack = byId.get(def.id);
    ordered.push(fromPack ? { ...def, ...fromPack } : def);
    byId.delete(def.id);
  }
  for (const action of incoming) {
    if (byId.has(action.id)) ordered.push(action);
  }

  return ordered.map((action) => normalizePackAction(action, pack.request_id));
}

export type TakeoffLineItem = {
  id: string;
  type: string;
  qty: number;
  room?: string;
  sheet?: string;
};

/** Flatten `takeoff.by_room` fixtures, else `by_type`, for the order list. */
export function takeoffLineItems(takeoff?: Takeoff | null): TakeoffLineItem[] {
  if (!takeoff) return [];
  if (takeoff.by_room?.length) {
    return takeoff.by_room.flatMap((room, roomIndex) =>
      room.fixtures.map((fixture, fixtureIndex) => ({
        id: `${room.room ?? room.name}-${roomIndex}-${fixture.type}-${fixtureIndex}`,
        type: fixture.type,
        qty: fixture.qty,
        room: room.name,
        sheet: room.sheet,
      })),
    );
  }
  return (takeoff.by_type ?? []).map((entry, index) => ({
    id: `type-${entry.type}-${index}`,
    type: entry.type,
    qty: entry.qty,
  }));
}

export function sheetRevisionLabel(sheet: Pick<Sheet, "id" | "rev">): string {
  return `${sheet.id} Rev ${sheet.rev}`;
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
  crop?: NormalizedBBox | null;
  title?: string | null;
  name?: string | null;
  discipline?: string | null;
}): Sheet {
  const id = typeof sheet.id === "string" ? sheet.id.trim() : "";
  const rev = typeof sheet.rev === "string" ? sheet.rev.trim() : "";
  return {
    id: id || "UNKNOWN",
    rev: rev || "?",
    pdf: typeof sheet.pdf === "string" ? sheet.pdf : "",
    preview: sheet.preview ?? null,
    crop: sheet.crop ?? null,
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
