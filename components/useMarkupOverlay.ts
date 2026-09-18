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

export function useMarkupOverlay(requestId: string, sheetId: string) {
  const [record, setRecord] = useState<MarkupOverlayRecord>(() =>
    emptyRecord(requestId, sheetId),
  );
  const [storage, setStorage] = useState<StorageKind>("local");
  const [ready, setReady] = useState(false);
  const recordRef = useRef<MarkupOverlayRecord>(emptyRecord(requestId, sheetId));

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
      const initial = local ?? emptyRecord(requestId, sheetId);
      recordRef.current = initial;
      setRecord(initial);
      setStorage("local");
      setReady(true);

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
        if (cancelled || !response.ok || !data.ok) return;
        if (data.storage) setStorage(data.storage);
        if (recordRef.current.vectors.items.length > 0) return;
        if (data.row?.vectors) {
          const next: MarkupOverlayRecord = {
            id: data.row.id || initial.id,
            request_id: requestId,
            sheet_id: sheetId,
            vectors: parseVectors(data.row.vectors),
            updated_at: data.row.updated_at,
          };
          recordRef.current = next;
          setRecord(next);
          saveLocalOverlay(next);
        }
      } catch {
        // localStorage still holds the overlay for the demo
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [requestId, sheetId]);

  const persist = useCallback((next: MarkupOverlayRecord) => {
    saveLocalOverlay(next);
    void (async () => {
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
          const saved: MarkupOverlayRecord = {
            ...next,
            id: data.row.id,
            vectors: parseVectors(data.row.vectors),
            updated_at: data.row.updated_at,
          };
          recordRef.current = saved;
          setRecord(saved);
          saveLocalOverlay(saved);
          if (data.storage) setStorage(data.storage);
        }
      } catch {
        // keep local
      }
    })();
  }, []);

  const setItems = useCallback(
    (items: MarkupVector[] | ((current: MarkupVector[]) => MarkupVector[])) => {
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
      persist(next);
    },
    [persist],
  );

  return {
    overlayId: record.id,
    items: record.vectors.items,
    vectors: record.vectors,
    storage,
    ready,
    setItems,
  };
}
