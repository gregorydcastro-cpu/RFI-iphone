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
  id: string;
  rev: string;
  pdf: string;
  preview?: string | null;
  crop?: NormalizedBBox | null;
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
