import { DEMO_FOREMAN } from "./crew";
import type { MarkupKind, MarkupVectorsJson } from "./markup";

export const RFI_DRAFTS_STORAGE_KEY = "gcfieldlog.rfi_drafts";
export const MATERIAL_DRAFTS_STORAGE_KEY = "gcfieldlog.material_order_drafts";

export type DraftPhoto = {
  name: string;
  size: number;
  mime?: string;
  /** Camera / file as a data URL on the draft. Not a Procore upload. */
  dataUrl?: string;
};

export type RfiMarkupRef = {
  overlayId: string;
  itemId: string;
  sheetId: string;
  sheetRev: string;
  kind: MarkupKind;
  vectors: MarkupVectorsJson;
};

export type RfiDraftPacket = {
  id: string;
  createdAt: string;
  requestId: string;
  jobName: string;
  roomName: string;
  roomNumber?: string;
  sheetId: string;
  sheetRev: string;
  authorName: string;
  authorEmail: string;
  subject: string;
  question: string;
  location: string;
  photos: DraftPhoto[];
  markupId?: string | null;
  markupItemId?: string | null;
  markupRef?: RfiMarkupRef | null;
  sentTo: {
    name: string;
    role: string;
    email: string;
  };
  /** Matches PR #9 `rfis.status`. UI is still a draft to the foreman. */
  status: "draft" | "ready";
  notProcore: true;
  persisted?: boolean;
  storage?: "supabase" | "local" | "unconfigured" | "unavailable";
};

export type MaterialIntent = "needed" | "order";

export type MaterialDraftLine = {
  id: string;
  type: string;
  qty: number;
  intent: MaterialIntent;
  room?: string;
  sheet?: string;
};

/** #9 has no materials table — keep order drafts local until a later schema. */
export type MaterialOrderDraft = {
  id: string;
  createdAt: string;
  requestId: string;
  jobName: string;
  roomName: string;
  sheetId?: string;
  sheetRev?: string;
  authorName: string;
  authorEmail: string;
  note: string;
  lines: MaterialDraftLine[];
  sentTo: {
    name: string;
    role: string;
    email: string;
  };
  status: "draft_to_foreman";
  notProcore: true;
};

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, items: T[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items.slice(0, 40)));
}

export function loadRfiDrafts(): RfiDraftPacket[] {
  return readList<RfiDraftPacket>(RFI_DRAFTS_STORAGE_KEY);
}

export function saveRfiDraft(draft: RfiDraftPacket): void {
  const next = [draft, ...loadRfiDrafts().filter((item) => item.id !== draft.id)];
  try {
    writeList(RFI_DRAFTS_STORAGE_KEY, next);
  } catch {
    const slim = next.map((item) => ({
      ...item,
      photos: item.photos.map((photo) => ({
        name: photo.name,
        size: photo.size,
        mime: photo.mime,
      })),
    }));
    writeList(RFI_DRAFTS_STORAGE_KEY, slim);
  }
}

export function loadMaterialDrafts(): MaterialOrderDraft[] {
  return readList<MaterialOrderDraft>(MATERIAL_DRAFTS_STORAGE_KEY);
}

export function saveMaterialDraft(draft: MaterialOrderDraft): void {
  const next = [
    draft,
    ...loadMaterialDrafts().filter((item) => item.id !== draft.id),
  ];
  writeList(MATERIAL_DRAFTS_STORAGE_KEY, next);
}

export function newDraftId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

export function foremanRecipient(): RfiDraftPacket["sentTo"] {
  return {
    name: DEMO_FOREMAN.name,
    role: DEMO_FOREMAN.role,
    email: DEMO_FOREMAN.email,
  };
}
