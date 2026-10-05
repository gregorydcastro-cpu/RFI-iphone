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
import {
  putMarkupOverlay,
  type MarkupSaveFail,
} from "@/lib/markupSaveField";

export type MarkupPersistOutcome = {
  record: MarkupOverlayRecord;
  storage: MarkupStorageKind;
  persistFailed: boolean;
  fail: MarkupSaveFail | null;
  retryable: boolean;
};

type MarkupLoadResponse = {
  ok?: boolean;
  storage?: MarkupStorageKind;
  row?: MarkupOverlayRecord | null;
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
  const [saveFail, setSaveFail] = useState<MarkupSaveFail | null>(null);
  const [saveRetryable, setSaveRetryable] = useState(true);
  const [saveEmpty, setSaveEmpty] = useState(false);
  const recordRef = useRef<MarkupOverlayRecord>(emptyRecord(requestId, sheetId));
  const storageRef = useRef<MarkupStorageKind>("unconfigured");
  const failedRef = useRef(false);
  const failRef = useRef<MarkupSaveFail | null>(null);
  const retryableRef = useRef(true);
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
      fail: MarkupSaveFail | null = null,
      retryable = failed,
    ): MarkupPersistOutcome => {
      const reason = failed ? fail ?? "server" : null;
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
        failRef.current = reason;
        retryableRef.current = failed ? retryable : false;
        setRecord(recordToStore);
        setStorage(nextStorage);
        setPersistFailed(failed);
        setSaveFail(reason);
        setSaveRetryable(failed ? retryable : false);
        setSaveEmpty(!failed && recordToStore.vectors.items.length === 0 && revision > 0);
      }
      return {
        record: currentSession ? recordToStore : next,
        storage: nextStorage,
        persistFailed: failed,
        fail: reason,
        retryable: failed ? retryable : false,
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
          fail: null,
          retryable: false,
        };
      }
      const result = await putMarkupOverlay({
        id: next.id,
        requestId: next.request_id,
        sheetId: next.sheet_id,
        vectors: next.vectors,
      });
      if (result.storage === "supabase" && result.row && !result.fail) {
        const saved = applyRow(next.request_id, next.sheet_id, next.id, result.row);
        return publish(saved, "supabase", false, revision, session, null, false);
      }
      const saved = result.row
        ? applyRow(next.request_id, next.sheet_id, next.id, result.row)
        : next;
      saveLocalOverlay(saved);
      if (result.fail) {
        const storage: MarkupStorageKind =
          result.storage === "unavailable" ? "unavailable" : "local";
        return publish(
          saved,
          storage,
          true,
          revision,
          session,
          result.fail,
          result.retryable,
        );
      }
      const localKind: MarkupStorageKind =
        result.storage === "local" ? "local" : "unconfigured";
      return publish(saved, localKind, false, revision, session, null, false);
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
    failRef.current = null;
    retryableRef.current = true;
    recordRef.current = emptyRecord(requestId, sheetId);

    async function load() {
      await Promise.resolve();
      if (cancelled || session !== sessionRef.current) return;
      setPersistFailed(false);
      setSaveFail(null);
      setSaveRetryable(true);
      setSaveEmpty(false);
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
        const data = (await response.json()) as MarkupLoadResponse;
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
        fail: null,
        retryable: false,
      };
    }
    let outcome: MarkupPersistOutcome = {
      record: recordRef.current,
      storage: storageRef.current,
      persistFailed: failedRef.current,
      fail: failRef.current,
      retryable: retryableRef.current,
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
      fail: failRef.current,
      retryable: retryableRef.current,
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
    saveFail,
    saveRetryable,
    saveEmpty,
    ready: ready && settledKey === `${requestId}\0${sheetId}`,
    setItems,
    flush,
  };
}
