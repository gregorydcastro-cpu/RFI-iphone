"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  MAPLE_POINT_REQUEST_ID,
  packHrefForSheet,
  type ShareCatalog,
} from "@/lib/shareCatalog";
import type { PinnedSheetDiscipline } from "@/lib/schema";
import type { ShareFolderWithPins } from "@/lib/shareStore";
import type { ShareRefreshItem } from "@/lib/shareRefresh";

type NotifyPayload = {
  sent?: boolean;
  skipped?: boolean;
  code?: string;
  note?: string;
};

type RefreshPayload = {
  ok?: boolean;
  error?: string;
  scanned?: number;
  bumped?: number;
  unchanged?: number;
  missing?: number;
  refresh?: string;
  storage?: string;
  weeklyCron?: boolean;
  notify?: boolean | NotifyPayload;
  note?: string;
  items?: ShareRefreshItem[];
};

function notifyStatusLabel(notify: RefreshPayload["notify"]): string {
  if (!notify || notify === false) return "skipped (unconfigured)";
  if (notify === true) return "on";
  if (notify.sent) return "sent";
  if (notify.code === "no_bumps") return "skipped (no bumps)";
  if (notify.code === "notify_unconfigured") return "skipped (unconfigured)";
  if (notify.code === "send_failed") return "failed (refresh still saved)";
  if (notify.code === "persist_failed") return "skipped (persist failed)";
  return notify.code ?? "skipped";
}

type Props = {
  signedIn: boolean;
  canRefresh: boolean;
  roleLabel: string;
  catalog: ShareCatalog;
  initialFolders: ShareFolderWithPins[];
  initialStorage: string;
};

export function SharePortal({
  signedIn,
  canRefresh,
  roleLabel,
  catalog,
  initialFolders,
  initialStorage,
}: Props) {
  const [folders, setFolders] = useState(initialFolders);
  const [storage, setStorage] = useState(initialStorage);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<RefreshPayload | null>(null);
  const [packByFolder, setPackByFolder] = useState<Record<string, string>>(() => {
    const first = catalog.room_packs[0]?.id ?? "maple-point";
    const initial: Record<string, string> = {};
    for (const folder of initialFolders) {
      initial[folder.id] = first;
    }
    return initial;
  });

  const pinCount = useMemo(
    () => folders.reduce((sum, folder) => sum + folder.pins.length, 0),
    [folders],
  );

  async function reload() {
    const response = await fetch("/api/share/folders", { cache: "no-store" });
    const data = (await response.json()) as {
      ok?: boolean;
      folders?: ShareFolderWithPins[];
      storage?: string;
      error?: string;
    };
    if (!response.ok || !data.ok || !data.folders) {
      throw new Error(data.error ?? "Could not load folders");
    }
    setFolders(data.folders);
    if (data.storage) setStorage(data.storage);
  }

  async function run(label: string, work: () => Promise<void>) {
    if (pending) return;
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      await work();
      setStatus(label);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    } finally {
      setPending(false);
    }
  }

  async function createFolder() {
    await run("Folder created", async () => {
      const response = await fetch("/api/share/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not create folder");
      }
      setName("");
      await reload();
    });
  }

  async function deleteFolder(folderId: string) {
    await run("Folder deleted", async () => {
      const response = await fetch(
        `/api/share/folders?id=${encodeURIComponent(folderId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not delete folder");
      }
      await reload();
    });
  }

  async function pinDiscipline(folderId: string, discipline: PinnedSheetDiscipline) {
    await run(`Pinned ${discipline}`, async () => {
      const response = await fetch("/api/share/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id: folderId,
          kind: "discipline",
          discipline,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not pin discipline");
      }
      await reload();
    });
  }

  async function pinPack(folderId: string) {
    const packId = packByFolder[folderId] ?? catalog.room_packs[0]?.id;
    await run("Pinned room pack", async () => {
      const response = await fetch("/api/share/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder_id: folderId,
          kind: "room_pack",
          pack_id: packId,
        }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not pin room pack");
      }
      await reload();
    });
  }

  async function unpin(pinId: string) {
    await run("Sheet unpinned", async () => {
      const response = await fetch(
        `/api/share/pins?id=${encodeURIComponent(pinId)}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Could not unpin");
      }
      await reload();
    });
  }

  async function refreshAll() {
    await run("Refresh all finished", async () => {
      const response = await fetch("/api/share/refresh-all", { method: "POST" });
      const data = (await response.json()) as RefreshPayload;
      setRefresh(data);
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Refresh all failed");
      }
      await reload();
    });
  }

  if (!signedIn) {
    return (
      <section className="border border-line bg-panel p-5">
        <p className="text-sm text-muted">
          <Link href="/?next=/share" className="text-accent underline">
            Sign in
          </Link>{" "}
          (stub session) to create share folders and pin Maple Point sheets.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
              Viewer portal
            </p>
            <h2 className="font-display mt-1 text-2xl tracking-wide text-paper">
              Refresh pinned sheets
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Manual <span className="text-paper">Refresh all</span> is
              puller-gated. It walks pins, compares revs to{" "}
              <span className="font-mono text-xs text-metal">
                sheet_revision_cache
              </span>
              , and records bumps. Pack pulls still need Connect Procore.
              Weekly cron updates every pin when rev bumps. Mike is emailed
              only when a bump persists (
              <span className="font-mono text-xs text-metal">
                NOTIFY_MIKE_EMAIL
              </span>
              ).
            </p>
            <p className="mt-2 font-mono text-xs text-metal">
              {folders.length} folder{folders.length === 1 ? "" : "s"} · {pinCount}{" "}
              pin{pinCount === 1 ? "" : "s"} · {storage} · {roleLabel}
            </p>
          </div>
          <button
            type="button"
            disabled={!canRefresh || pending}
            onClick={() => void refreshAll()}
            className="bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-50"
          >
            {pending ? "Working…" : "Refresh all"}
          </button>
        </div>
        {!canRefresh ? (
          <p className="mt-3 text-sm text-tan">
            Sign in as a puller to run Refresh all. Viewers can still create
            folders and pin Maple Point packs. Pack pulls still need Connect
            Procore.
          </p>
        ) : null}
        {refresh?.ok ? (
          <p className="mt-3 text-sm text-accent-2" role="status">
            Scanned {refresh.scanned ?? 0}: {refresh.bumped ?? 0} bumped,{" "}
            {refresh.unchanged ?? 0} unchanged, {refresh.missing ?? 0} missing.
            Notify: {notifyStatusLabel(refresh.notify)}.
          </p>
        ) : null}
      </section>

      <section className="border border-line bg-panel p-5">
        <p className="font-display text-xs tracking-[0.22em] text-accent uppercase">
          New folder
        </p>
        <h2 className="font-display mt-1 text-xl tracking-wide text-paper">
          Create share folder
        </h2>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void createFolder();
          }}
        >
          <label className="block min-w-0 flex-1 text-xs font-semibold tracking-wide text-muted uppercase">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Electrical set"
              className="mt-1 w-full border border-line bg-ink px-3 py-2 text-sm font-normal tracking-normal text-paper outline-none focus:border-cta"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="self-end bg-cta px-5 py-2.5 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-cta">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-accent-2">
          {status}
        </p>
      ) : null}

      {folders.length === 0 ? (
        <p className="text-sm text-muted">
          No folders yet. Create one, then pin electrical, lighting,
          architectural, or a Maple Point room pack.
        </p>
      ) : (
        <ul className="space-y-4">
          {folders.map((folder) => (
            <li key={folder.id} className="border border-line bg-panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl tracking-wide text-paper">
                    {folder.name}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-metal">
                    {folder.pins.length} pin{folder.pins.length === 1 ? "" : "s"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void deleteFolder(folder.id)}
                  className="border border-line px-3 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase hover:border-cta hover:text-secondary disabled:opacity-50"
                >
                  Delete folder
                </button>
              </div>

              <p className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">
                Pin full discipline
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {catalog.disciplines.map((discipline) => (
                  <button
                    key={discipline}
                    type="button"
                    disabled={pending}
                    onClick={() => void pinDiscipline(folder.id, discipline)}
                    className="border border-line px-3 py-1.5 text-xs font-semibold tracking-wide text-secondary uppercase hover:border-cta disabled:opacity-50"
                  >
                    {discipline}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">
                Pin room pack
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <select
                  value={packByFolder[folder.id] ?? catalog.room_packs[0]?.id}
                  onChange={(event) =>
                    setPackByFolder((current) => ({
                      ...current,
                      [folder.id]: event.target.value,
                    }))
                  }
                  className="border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-cta"
                >
                  {catalog.room_packs.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void pinPack(folder.id)}
                  className="border border-cta/60 px-3 py-2 text-xs font-semibold tracking-wide text-secondary uppercase hover:bg-cta/10 disabled:opacity-50"
                >
                  Pin pack
                </button>
              </div>

              {folder.pins.length === 0 ? (
                <p className="mt-4 text-sm text-muted">No sheets pinned yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-line border border-line">
                  {folder.pins.map((pin) => (
                    <li
                      key={pin.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <div>
                        <p className="font-mono text-sm text-paper">
                          {pin.sheet_id}
                          {pin.last_seen_rev ? ` Rev ${pin.last_seen_rev}` : ""}
                        </p>
                        <p className="text-xs text-muted">
                          {pin.project_name}
                          {pin.discipline ? ` · ${pin.discipline}` : ""}
                          {pin.last_pulled_at
                            ? ` · pulled ${pin.last_pulled_at.slice(0, 16).replace("T", " ")}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={packHrefForSheet(MAPLE_POINT_REQUEST_ID)}
                          className="text-xs font-semibold tracking-wide text-accent-2 uppercase hover:text-secondary"
                        >
                          Open pack
                        </Link>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void unpin(pin.id)}
                          className="text-xs font-semibold tracking-wide text-muted uppercase hover:text-cta disabled:opacity-50"
                        >
                          Unpin
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
