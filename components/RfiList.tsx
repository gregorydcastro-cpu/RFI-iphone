"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ReadAloudButton } from "@/components/ReadAloudButton";
import { VoiceSetupNote } from "@/components/VoiceSetupNote";
import { loadRfiDrafts, RFI_DRAFTS_STORAGE_KEY } from "@/lib/fieldDrafts";
import {
  buildRfiInboxItems,
  parseCrewDraftRows,
  RFI_INBOX_DRAFTS_EMPTY,
  RFI_INBOX_EMPTY_TITLE,
  RFI_INBOX_ERROR_NEXT,
  RFI_INBOX_ERROR_TITLE,
  RFI_INBOX_CLIENT_TIMEOUT_MS,
  RFI_INBOX_LOADING,
  rfiInboxCrewStatus,
  rfiInboxEmptySpeak,
  rfiInboxErrorSpeak,
  rfiInboxView,
  type RfiInboxCrew,
  type RfiInboxDraft,
  type RfiInboxItem,
} from "@/lib/rfiInbox";
import { rfiSpeakText } from "@/lib/rfiDictation";
import type { Rfi } from "@/lib/pack";

const STATUS_CLASS: Record<string, string> = {
  open: "border-cta/60 bg-accent-1/40 text-secondary",
  answered: "border-accent-3/50 bg-panel-2 text-accent-3",
  closed: "border-line bg-ink text-tan",
  draft: "border-tan/80 bg-ink text-tan",
  ready: "border-accent-3/50 bg-panel-2 text-accent-3",
};

type Props = {
  rfis: Rfi[];
  requestId?: string;
  sheetIds?: string[];
  /** Signed-out viewers do not have crew drafts. Skip that fetch. */
  signedIn?: boolean;
};

function speakOne(item: RfiInboxItem): string {
  return rfiSpeakText({
    number: item.kind === "draft" ? undefined : item.number,
    title: item.title,
    status: item.status,
    draftToForeman: item.kind === "draft",
  });
}

function speakAll(items: RfiInboxItem[], footnote?: string): string {
  const body = items.map((item, index) => `${index + 1}. ${speakOne(item)}`).join(" ");
  return footnote ? `${body} ${footnote}` : body;
}

const EMPTY_DRAFTS: RfiInboxDraft[] = [];

let localCache: { raw: string; drafts: RfiInboxDraft[] } = {
  raw: "",
  drafts: EMPTY_DRAFTS,
};

function subscribeLocalDrafts(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function readLocalDrafts(): RfiInboxDraft[] {
  let raw = "";
  try {
    raw = window.localStorage.getItem(RFI_DRAFTS_STORAGE_KEY) ?? "";
  } catch {
    raw = "";
  }
  if (localCache.raw === raw) return localCache.drafts;
  const drafts = loadRfiDrafts().map((draft) => ({
    id: draft.id,
    subject: draft.subject,
    status: draft.status,
    requestId: draft.requestId,
    sheetId: draft.sheetId,
  }));
  localCache = { raw, drafts };
  return drafts;
}

function localDraftsServerSnapshot(): RfiInboxDraft[] {
  return EMPTY_DRAFTS;
}

export function RfiList({ rfis, requestId, sheetIds, signedIn = true }: Props) {
  const localDrafts = useSyncExternalStore(
    subscribeLocalDrafts,
    readLocalDrafts,
    localDraftsServerSnapshot,
  );
  const [crewDrafts, setCrewDrafts] = useState<RfiInboxDraft[]>([]);
  const [crew, setCrew] = useState<RfiInboxCrew>(signedIn ? "loading" : "skipped");
  const [attempt, setAttempt] = useState(0);
  const [authSeen, setAuthSeen] = useState(signedIn);
  if (signedIn !== authSeen) {
    setAuthSeen(signedIn);
    setCrew(signedIn ? "loading" : "skipped");
    if (!signedIn) setCrewDrafts([]);
  }

  useEffect(() => {
    if (!signedIn) return;

    const controller = new AbortController();
    let cancelled = false;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, RFI_INBOX_CLIENT_TIMEOUT_MS);

    async function load() {
      try {
        const response = await fetch("/api/rfis", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as {
          ok?: boolean;
          rows?: unknown;
        } | null;
        if (cancelled) return;
        const status = rfiInboxCrewStatus({
          httpStatus: response.status,
          ok: Boolean(data?.ok),
          timedOut,
        });
        setCrew(status);
        setCrewDrafts(status === "ok" ? parseCrewDraftRows(data?.rows) : []);
      } catch {
        if (cancelled) return;
        setCrew(rfiInboxCrewStatus({ thrown: true, timedOut }));
        setCrewDrafts([]);
      } finally {
        clearTimeout(timer);
      }
    }

    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [attempt, signedIn]);

  const items = useMemo(
    () =>
      buildRfiInboxItems({
        rfis,
        localDrafts,
        crewDrafts,
        requestId,
        sheetIds,
      }),
    [crewDrafts, localDrafts, requestId, rfis, sheetIds],
  );
  const draftCount = items.filter((item) => item.kind === "draft").length;
  const view = rfiInboxView({
    crew,
    itemCount: items.length,
    draftCount,
  });
  const footnote =
    view.kind === "list" && view.draftsEmpty ? RFI_INBOX_DRAFTS_EMPTY : undefined;

  function retry() {
    setCrew("loading");
    setCrewDrafts([]);
    setAttempt((current) => current + 1);
  }

  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xs tracking-[0.18em] text-muted uppercase">
          RFIs
        </h2>
        {view.kind === "list" ? (
          <ReadAloudButton
            id="pack-rfis-all"
            text={speakAll(items, footnote)}
            label="Read all"
          />
        ) : null}
      </div>
      <VoiceSetupNote />
      {view.kind === "loading" ? (
        <p role="status" className="text-base text-tan">
          {RFI_INBOX_LOADING}
        </p>
      ) : null}
      {view.kind === "empty" ? <InboxEmpty /> : null}
      {view.kind === "error" ? <InboxError onRetry={retry} /> : null}
      {view.kind === "list" ? (
        <>
          <ul className="divide-y divide-line border border-line bg-ink">
            {items.map((item) => (
              <li key={item.id} className="px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-metal">{item.number}</p>
                    {item.url ? (
                      <a
                        href={item.url}
                        className="text-base font-medium text-paper underline-offset-2 hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p className="text-base font-medium text-paper">{item.title}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                      STATUS_CLASS[item.status] ?? "border-line bg-panel text-muted"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <div className="mt-2">
                  <ReadAloudButton
                    id={`pack-rfi-${item.id}`}
                    text={speakOne(item)}
                    label="Speak"
                  />
                </div>
              </li>
            ))}
          </ul>
          {view.pending ? (
            <p role="status" className="text-base text-tan">
              {RFI_INBOX_LOADING}
            </p>
          ) : null}
          {view.retry ? <InboxError onRetry={retry} /> : null}
          {footnote ? (
            <p role="status" className="text-base leading-snug text-paper">
              {footnote}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function InboxEmpty() {
  return (
    <div role="status" className="border border-line bg-ink px-4 py-4">
      <p className="text-lg font-semibold text-paper">{RFI_INBOX_EMPTY_TITLE}</p>
      <p className="mt-2 text-base leading-snug text-tan">{RFI_INBOX_DRAFTS_EMPTY}</p>
      <ReadAloudButton
        id="pack-rfis-empty"
        text={rfiInboxEmptySpeak()}
        label="Hear this"
        className="mt-3"
      />
    </div>
  );
}

function InboxError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="border border-cta/60 bg-ink px-4 py-4">
      <p className="text-lg font-semibold text-cta">{RFI_INBOX_ERROR_TITLE}</p>
      <p className="mt-2 text-base leading-snug text-paper">{RFI_INBOX_ERROR_NEXT}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-12 items-center justify-center bg-cta px-4 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
      >
        Retry
      </button>
      <ReadAloudButton
        id="pack-rfis-error"
        text={rfiInboxErrorSpeak()}
        label="Hear this"
        className="mt-3"
      />
    </div>
  );
}
