import { DEMO_FOREMAN } from "./crew";

export const RFI_DRAFTS_STORAGE_KEY = "gcfieldlog.rfi_drafts";
export const MATERIAL_DRAFTS_STORAGE_KEY = "gcfieldlog.material_order_drafts";

export type DraftPhoto = {
  name: string;
  size: number;
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
  sentTo: {
    name: string;
    role: string;
    email: string;
  };
  status: "draft_to_foreman";
  notProcore: true;
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
  writeList(RFI_DRAFTS_STORAGE_KEY, next);
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

export function foremanRecipient(): RfiDraftPacket["sentTo"] {
  return {
    name: DEMO_FOREMAN.name,
    role: DEMO_FOREMAN.role,
    email: DEMO_FOREMAN.email,
  };
}
