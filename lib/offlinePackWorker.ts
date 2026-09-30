/**
 * Register /offline-pack-sw.js and activate an update without reloading.
 * A field crew may be mid-markup; controllerchange must not refresh the page.
 * The next sheet fetch uses the worker that just claimed the client.
 */

export const OFFLINE_PACK_SW_URL = "/offline-pack-sw.js";
export const OFFLINE_PACK_SW_SCOPE = "/";
export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

type WorkerLike = {
  state: string;
  postMessage: (message: unknown) => void;
  addEventListener: (type: "statechange", listener: () => void) => void;
};

type RegistrationLike = {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  update: () => Promise<unknown>;
  addEventListener: (type: "updatefound", listener: () => void) => void;
};

export type OfflinePackWorkerContainer = {
  controller: unknown;
  register: (
    url: string,
    options: { scope: string; updateViaCache: "none" },
  ) => Promise<RegistrationLike>;
};

function nudge(worker: WorkerLike | null | undefined): void {
  if (!worker) return;
  try {
    worker.postMessage(SKIP_WAITING_MESSAGE);
  } catch {
    // The worker may already be gone. The next navigation installs it.
  }
}

function watchInstalling(worker: WorkerLike, hasController: boolean): void {
  const poke = () => {
    if (worker.state === "installed" && hasController) nudge(worker);
  };
  worker.addEventListener("statechange", poke);
  poke();
}

/**
 * `updateViaCache: "none"` so a long-lived tablet does not keep a stale worker
 * script. A waiting worker is asked to skip waiting. `update()` is last so a
 * failed update check still activates a worker that was already waiting.
 */
export async function registerOfflinePackWorker(
  container: OfflinePackWorkerContainer,
): Promise<void> {
  const registration = await container.register(OFFLINE_PACK_SW_URL, {
    scope: OFFLINE_PACK_SW_SCOPE,
    updateViaCache: "none",
  });
  nudge(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    watchInstalling(installing, Boolean(container.controller));
  });
  await registration.update();
}
