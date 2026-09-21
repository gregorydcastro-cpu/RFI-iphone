"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadLocalOverlay,
  newMarkupId,
  parseVectors,
  saveLocalOverlay,
  type MarkupOverlayRecord,
  type MarkupStorageKind,
  type MarkupVector,
  type MarkupVectorsJson,
} from "@/lib/markup";

type ApiResponse = {
  ok?: boolean;
  persisted?: boolean;
  storage?: MarkupStorageKind;
  row?: MarkupOverlayRecord | null;
};

export type MarkupPersistOutcome = {
  record: MarkupOverlayRecord;
  storage: MarkupStorageKind;
  persistFailed: boolean;
};

function emptyRecord(requestId: string, sheetId: string): MarkupOverlayRecord {
  return {
    id: newMarkupId(),
    request_id: requestId,
    sheet_id: sheetId,
    vectors: { items: [] },
    updated_at: new Date().toISOString(),
  };
}

function applyRow(
  requestId: string,
  sheetId: string,
  fallbackId: string,
  row: MarkupOverlayRecord,
): MarkupOverlayRecord {
  return {
    id: row.id || fallbackId,
    request_id: requestId,
    sheet_id: sheetId,
    vectors: parseVectors(row.vectors),
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function useMarkupOverlay(
  requestId: string,
  sheetId: string,
  options: { readOnly?: boolean } = {},
) {
  const readOnly = Boolean(options.readOnly);
  const [record, setRecord] = useState<MarkupOverlayRecord>(() =>
    emptyRecord(requestId, sheetId),
  );
  const [storage, setStorage] = useState<MarkupStorageKind>("unconfigured");
  const [ready, setReady] = useState(false);
  const [settledKey, setSettledKey] = useState("");
  const [savingCount, setSavingCount] = useState(0);
  const [persistFailed, setPersistFailed] = useState(false);
  const recordRef = useRef<MarkupOverlayRecord>(emptyRecord(requestId, sheetId));
  const storageRef = useRef<MarkupStorageKind>("unconfigured");
  const failedRef = useRef(false);
  const revisionRef = useRef(0);
  const sessionRef = useRef(0);
  const chainRef = useRef<Promise<void>>(Promise.resolve());

  const publish = useCallback(
    (
      next: MarkupOverlayRecord,
      nextStorage: MarkupStorageKind,
      failed: boolean,
      revision: number,
      session: number,
    ): MarkupPersistOutcome => {
      const currentSession = session === sessionRef.current;
      const latest = currentSession && revision === revisionRef.current;
      const recordToStore = latest
        ? next
        : {
            ...recordRef.current,
            id: next.id || recordRef.current.id,
            user_id: next.user_id ?? recordRef.current.user_id,
          };
      if (currentSession) {
        recordRef.current = recordToStore;
        storageRef.current = nextStorage;
        failedRef.current = failed;
        setRecord(recordToStore);
        setStorage(nextStorage);
        setPersistFailed(failed);
      }
      return {
        record: currentSession ? recordToStore : next,
        storage: nextStorage,
        persistFailed: failed,
      };
    },
    [],
  );

  const writeRemote = useCallback(
    async (
      next: MarkupOverlayRecord,
      revision: number,
      session: number,
    ): Promise<MarkupPersistOutcome> => {
      if (readOnly) {
        return {
          record: next,
          storage: storageRef.current,
          persistFailed: false,
        };
      }
      try {
        const response = await fetch("/api/markups", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: next.id,
            request_id: next.request_id,
            sheet_id: next.sheet_id,
            vectors: next.vectors,
          }),
        });
        const data = (await response.json()) as ApiResponse;
        if (response.ok && data.ok && data.row?.id) {
          const saved = applyRow(next.request_id, next.sheet_id, next.id, data.row);
          const kind = data.storage ?? "unconfigured";
          if (kind === "supabase") {
            return publish(saved, "supabase", false, revision, session);
          }
          saveLocalOverlay(saved);
          if (kind === "unavailable") {
            return publish(saved, "unavailable", true, revision, session);
          }
          const localKind: MarkupStorageKind = kind === "local" ? "local" : "unconfigured";
          return publish(saved, localKind, false, revision, session);
        }
      } catch {
        // local copy below — Create RFI still proceeds
      }
      saveLocalOverlay(next);
      return publish(next, "local", true, revision, session);
    },
    [publish, readOnly],
  );

  const enqueue = useCallback(
    (next: MarkupOverlayRecord, revision: number, session: number) => {
      if (session === sessionRef.current) {
        setSavingCount((count) => count + 1);
      }
      const job = chainRef.current.then(() => writeRemote(next, revision, session));
      chainRef.current = job.then(
        () => undefined,
        () => undefined,
      );
      return job.finally(() => {
        if (session === sessionRef.current) {
          setSavingCount((count) => Math.max(0, count - 1));
        }
      });
    },
    [writeRemote],
  );

  useEffect(() => {
    const session = ++sessionRef.current;
    const sheetKey = `${requestId}\0${sheetId}`;
    let cancelled = false;
    revisionRef.current = 0;
    failedRef.current = false;
    recordRef.current = emptyRecord(requestId, sheetId);

    async function load() {
      await Promise.resolve();
      if (cancelled || session !== sessionRef.current) return;
      setPersistFailed(false);
      setSavingCount(0);
      if (!requestId || !sheetId) {
        setSettledKey(sheetKey);
        setReady(true);
        return;
      }

      const local = loadLocalOverlay(requestId, sheetId);

      try {
        const params = new URLSearchParams({
          request_id: requestId,
          sheet_id: sheetId,
        });
        const response = await fetch(`/api/markups?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await response.json()) as ApiResponse;
        if (cancelled || session !== sessionRef.current) return;
        if (revisionRef.current > 0) {
          setSettledKey(sheetKey);
          setReady(true);
          return;
        }
        if (!response.ok || !data.ok) {
          const fallback = local ?? emptyRecord(requestId, sheetId);
          recordRef.current = fallback;
          storageRef.current = "local";
          setRecord(fallback);
          setStorage("local");
          setSettledKey(sheetKey);
          setReady(true);
          return;
        }

        const loadedKind = data.storage ?? "unconfigured";
        storageRef.current = loadedKind;
        setStorage(loadedKind);

        if (data.row?.vectors) {
          const next = applyRow(requestId, sheetId, local?.id ?? newMarkupId(), data.row);
          recordRef.current = next;
          setRecord(next);
          setSettledKey(sheetKey);
          setReady(true);
          return;
        }

        const initial = local ?? emptyRecord(requestId, sheetId);
        recordRef.current = initial;
        setRecord(initial);
        setSettledKey(sheetKey);
        setReady(true);

        if (
          !readOnly &&
          data.storage !== "unconfigured" &&
          initial.vectors.items.length > 0
        ) {
          void enqueue(initial, revisionRef.current, session);
        }
        return;
      } catch {
        if (cancelled || session !== sessionRef.current) return;
        if (revisionRef.current > 0) {
          setSettledKey(sheetKey);
          setReady(true);
          return;
        }
        const fallback = local ?? emptyRecord(requestId, sheetId);
        recordRef.current = fallback;
        storageRef.current = "local";
        setRecord(fallback);
        setStorage("local");
        setSettledKey(sheetKey);
        setReady(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [enqueue, readOnly, requestId, sheetId]);

  const setItems = useCallback(
    (items: MarkupVector[] | ((current: MarkupVector[]) => MarkupVector[])) => {
      if (readOnly) return;
      const current = recordRef.current;
      const nextItems =
        typeof items === "function" ? items(current.vectors.items) : items;
      const vectors: MarkupVectorsJson = { items: nextItems };
      const next: MarkupOverlayRecord = {
        ...current,
        vectors,
        updated_at: new Date().toISOString(),
      };
      revisionRef.current += 1;
      recordRef.current = next;
      setRecord(next);
      void enqueue(next, revisionRef.current, sessionRef.current);
    },
    [enqueue, readOnly],
  );

  const flush = useCallback(async (): Promise<MarkupPersistOutcome> => {
    if (readOnly) {
      return {
        record: recordRef.current,
        storage: storageRef.current,
        persistFailed: false,
      };
    }
    let outcome: MarkupPersistOutcome = {
      record: recordRef.current,
      storage: storageRef.current,
      persistFailed: failedRef.current,
    };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const revision = revisionRef.current;
      await chainRef.current;
      if (revisionRef.current !== revision) continue;
      outcome = await enqueue(recordRef.current, revision, sessionRef.current);
      if (revisionRef.current === revision) return outcome;
    }
    return {
      record: recordRef.current,
      storage: storageRef.current,
      persistFailed: failedRef.current,
    };
  }, [enqueue, readOnly]);

  const aligned =
    record.request_id === requestId && record.sheet_id === sheetId;
  const emptyVectors = { items: [] as MarkupVector[] };

  return {
    overlayId: aligned ? record.id : "",
    items: aligned ? record.vectors.items : emptyVectors.items,
    vectors: aligned ? record.vectors : emptyVectors,
    storage,
    saving: savingCount > 0,
    persistFailed,
    ready: ready && settledKey === `${requestId}\0${sheetId}`,
    setItems,
    flush,
  };
}
