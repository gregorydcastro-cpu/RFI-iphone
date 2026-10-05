/**
 * Phone copy for the pack RFI inbox.
 * Empty is a status. A dropped drafts load is a short retry, not a blank list.
 * Linked room RFIs stay on screen when the crew-draft read fails.
 */

export const RFI_INBOX_EMPTY_TITLE = "No RFIs yet.";
export const RFI_INBOX_DRAFTS_EMPTY = "No drafts on this phone. Tap Create RFI.";
export const RFI_INBOX_ERROR_TITLE = "Drafts did not load.";
export const RFI_INBOX_ERROR_NEXT = "Tap Retry.";
export const RFI_INBOX_LOADING = "Loading drafts…";

export type RfiInboxDraft = {
  id: string;
  subject: string;
  status: string;
  requestId?: string | null;
  sheetId?: string | null;
};

export type RfiInboxLinked = {
  id: string;
  number: string;
  title: string;
  status: string;
  url?: string | null;
};

export type RfiInboxItem = {
  id: string;
  kind: "draft" | "rfi";
  number: string;
  title: string;
  status: string;
  url?: string | null;
};

/** Phone wait for GET /api/rfis. A hung auth check must not leave the inbox spinning. */
export const RFI_INBOX_CLIENT_TIMEOUT_MS = 12_000;

export type RfiInboxCrew = "loading" | "ok" | "error" | "skipped";

export type RfiInboxView =
  | { kind: "loading" }
  | { kind: "idle" }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "list"; retry: boolean; pending: boolean; draftsEmpty: boolean };

export function rfiInboxEmptySpeak(): string {
  return `${RFI_INBOX_EMPTY_TITLE} ${RFI_INBOX_DRAFTS_EMPTY}`;
}

export function rfiInboxErrorSpeak(): string {
  return `${RFI_INBOX_ERROR_TITLE} ${RFI_INBOX_ERROR_NEXT}`;
}

/**
 * 401/403 is signed-out or view-only: drafts are not for this viewer.
 * A timeout or any other miss is a retry. A 200 is the crew list.
 */
export function rfiInboxCrewStatus(input: {
  thrown?: boolean;
  timedOut?: boolean;
  httpStatus?: number;
  ok?: boolean;
}): Exclude<RfiInboxCrew, "loading"> {
  if (input.httpStatus === 401 || input.httpStatus === 403) return "skipped";
  if (input.thrown || input.timedOut) return "error";
  if (input.ok) return "ok";
  return "error";
}

export function rfiInboxShowsLoading(view: RfiInboxView): boolean {
  if (view.kind === "loading") return true;
  return view.kind === "list" && view.pending;
}

export function rfiInboxView(input: {
  crew: RfiInboxCrew;
  itemCount: number;
  draftCount: number;
}): RfiInboxView {
  if (input.crew === "loading" && input.itemCount === 0) return { kind: "loading" };
  if (input.crew === "error" && input.itemCount === 0) return { kind: "error" };
  if (input.crew === "skipped" && input.itemCount === 0) return { kind: "idle" };
  if (input.itemCount === 0) return { kind: "empty" };
  return {
    kind: "list",
    retry: input.crew === "error",
    pending: input.crew === "loading",
    draftsEmpty: input.crew === "ok" && input.draftCount === 0,
  };
}

function draftTitle(subject: string): string {
  const trimmed = subject.trim();
  return trimmed || "Untitled draft";
}

function belongsHere(
  draft: RfiInboxDraft,
  requestId: string | undefined,
  sheetIds: ReadonlySet<string>,
  source: "local" | "crew",
): boolean {
  if (source === "local") {
    if (!requestId) return true;
    return (draft.requestId ?? "").trim() === requestId;
  }
  const sheetId = draft.sheetId?.trim() ?? "";
  if (!sheetId) return true;
  if (sheetIds.size === 0) return false;
  return sheetIds.has(sheetId);
}

export function buildRfiInboxItems(input: {
  rfis: RfiInboxLinked[];
  localDrafts: RfiInboxDraft[];
  crewDrafts: RfiInboxDraft[];
  requestId?: string;
  sheetIds?: string[];
}): RfiInboxItem[] {
  const sheets = new Set(
    (input.sheetIds ?? []).map((id) => id.trim()).filter(Boolean),
  );
  const items: RfiInboxItem[] = [];
  const seen = new Set<string>();

  function pushDraft(draft: RfiInboxDraft, source: "local" | "crew") {
    const id = draft.id.trim();
    if (!id || seen.has(id)) return;
    if (!belongsHere(draft, input.requestId, sheets, source)) return;
    seen.add(id);
    items.push({
      id,
      kind: "draft",
      number: "Draft",
      title: draftTitle(draft.subject),
      status: draft.status.trim() || "draft",
      url: null,
    });
  }

  for (const draft of input.localDrafts) pushDraft(draft, "local");
  for (const draft of input.crewDrafts) pushDraft(draft, "crew");

  for (const rfi of input.rfis) {
    const id = rfi.id.trim();
    if (!id || seen.has(id)) continue;
    const title = rfi.title.trim();
    if (!title) continue;
    seen.add(id);
    items.push({
      id,
      kind: "rfi",
      number: rfi.number.trim() || "RFI",
      title,
      status: rfi.status.trim() || "open",
      url: rfi.url ?? null,
    });
  }

  return items;
}

export function parseCrewDraftRows(value: unknown): RfiInboxDraft[] {
  if (!Array.isArray(value)) return [];
  const drafts: RfiInboxDraft[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || !record.id.trim()) continue;
    const subject = typeof record.subject === "string" ? record.subject : "";
    const status = typeof record.status === "string" ? record.status : "draft";
    drafts.push({
      id: record.id.trim(),
      subject,
      status,
      sheetId: typeof record.sheet_id === "string" ? record.sheet_id : null,
    });
  }
  return drafts;
}
