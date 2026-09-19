"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadLocalOverlay,
  newMarkupId,
  parseVectors,
  saveLocalOverlay,
  type MarkupOverlayRecord,
  type MarkupVector,
  type MarkupVectorsJson,
} from "@/lib/markup";

type StorageKind = "supabase" | "local" | "unconfigured" | "unavailable";

type ApiResponse = {
  ok?: boolean;
  persisted?: boolean;
  storage?: StorageKind;
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
  const [storage, setStorage] = useState<StorageKind>("unconfigured");
  const [ready, setReady] = useState(false);
  const recordRef = useRef<MarkupOverlayRecord>(emptyRecord(requestId, sheetId));

  const persist = useCallback(async (next: MarkupOverlayRecord) => {
    if (readOnly) return next;
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
        recordRef.current = saved;
        setRecord(saved);
        if (data.storage) setStorage(data.storage);
        if (data.storage === "supabase") return saved;
        saveLocalOverlay(saved);
        return saved;
      }
    } catch {
      // fall through to localStorage
    }
    saveLocalOverlay(next);
    setStorage("local");
    return next;
  }, [readOnly]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();
      if (cancelled) return;
      if (!requestId || !sheetId) {
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
        if (cancelled || !response.ok || !data.ok) {
          const fallback = local ?? emptyRecord(requestId, sheetId);
          recordRef.current = fallback;
          setRecord(fallback);
          setStorage("local");
          setReady(true);
          return;
        }

        if (data.storage) setStorage(data.storage);

        if (data.row?.vectors) {
          const next = applyRow(requestId, sheetId, local?.id ?? newMarkupId(), data.row);
          recordRef.current = next;
          setRecord(next);
          setReady(true);
          return;
        }

        const initial = local ?? emptyRecord(requestId, sheetId);
        recordRef.current = initial;
        setRecord(initial);
        setReady(true);

        if (
          !readOnly &&
          data.storage !== "unconfigured" &&
          initial.vectors.items.length > 0
        ) {
          void persist(initial);
        }
        return;
      } catch {
        const fallback = local ?? emptyRecord(requestId, sheetId);
        if (cancelled) return;
        recordRef.current = fallback;
        setRecord(fallback);
        setStorage("local");
        setReady(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [persist, readOnly, requestId, sheetId]);

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
      recordRef.current = next;
      setRecord(next);
      void persist(next);
    },
    [persist, readOnly],
  );

  const flush = useCallback(async () => {
    return persist(recordRef.current);
  }, [persist]);

  return {
    overlayId: record.id,
    items: record.vectors.items,
    vectors: record.vectors,
    storage,
    ready,
    setItems,
    flush,
  };
}
