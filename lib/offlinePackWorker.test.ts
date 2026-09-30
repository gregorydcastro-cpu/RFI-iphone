import assert from "node:assert/strict";
import { test } from "node:test";
import {
  OFFLINE_PACK_SW_SCOPE,
  OFFLINE_PACK_SW_URL,
  registerOfflinePackWorker,
  SKIP_WAITING_MESSAGE,
  type OfflinePackWorkerContainer,
} from "./offlinePackWorker.ts";

type Worker = {
  state: string;
  postMessage: (message: unknown) => void;
  addEventListener: (type: "statechange", listener: () => void) => void;
};

test("registration bypasses HTTP cache and wakes a waiting worker before update", async () => {
  const messages: unknown[] = [];
  let updates = 0;
  const waiting: Worker = {
    state: "installed",
    postMessage(message) {
      messages.push(message);
    },
    addEventListener() {},
  };
  const container: OfflinePackWorkerContainer = {
    controller: {},
    async register(url, options) {
      assert.equal(url, OFFLINE_PACK_SW_URL);
      assert.equal(options.scope, OFFLINE_PACK_SW_SCOPE);
      assert.equal(options.updateViaCache, "none");
      return {
        waiting,
        installing: null,
        async update() {
          updates += 1;
          throw new Error("offline update check");
        },
        addEventListener() {},
      };
    },
  };
  await assert.rejects(() => registerOfflinePackWorker(container));
  assert.deepEqual(messages, [SKIP_WAITING_MESSAGE]);
  assert.equal(updates, 1);
});

test("an installed update is asked to skip waiting only when a page is already controlled", async () => {
  async function run(hasController: boolean) {
    const messages: unknown[] = [];
    let onUpdate: (() => void) | undefined;
    const installing: Worker = {
      state: "installed",
      postMessage(message) {
        messages.push(message);
      },
      addEventListener() {},
    };
    const registration = {
      waiting: null,
      installing: null as Worker | null,
      async update() {},
      addEventListener(type: string, listener: () => void) {
        if (type === "updatefound") onUpdate = listener;
      },
    };
    await registerOfflinePackWorker({
      controller: hasController ? {} : null,
      async register() {
        registration.installing = installing;
        return registration;
      },
    });
    onUpdate?.();
    return messages;
  }

  assert.deepEqual(await run(true), [SKIP_WAITING_MESSAGE]);
  assert.deepEqual(await run(false), []);
});
