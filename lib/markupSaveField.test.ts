import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { foremanDraftStillAllowed } from "./markup.ts";
import {
  MARKUP_ABORT_MESSAGE,
  MARKUP_EMPTY_MESSAGE,
  MARKUP_EMPTY_TITLE,
  MARKUP_NETWORK_MESSAGE,
  MARKUP_SAVE_ATTEMPTS,
  MARKUP_SAVE_BACKOFF_MS,
  MARKUP_SERVER_MESSAGE,
  MARKUP_VIEW_ONLY_MESSAGE,
  classifyMarkupPutResponse,
  markupSaveBanner,
  markupSaveDraftBanner,
  markupSaveEmptySpeak,
  markupSaveFromQuery,
  markupSaveSurface,
  putMarkupOverlay,
  shouldAutoRetryMarkupSave,
} from "./markupSaveField.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const overlay = {
  id: "11111111-1111-4111-8111-111111111111",
  requestId: "maple-point",
  sheetId: "A-101",
  vectors: {
    items: [{ id: "box-1", kind: "box" as const, x: 0.1, y: 0.1, w: 0.2, h: 0.2 }],
  },
};

test("network, server, and a stopped save are Retry cards, and nothing to save is a status", () => {
  const network = markupSaveBanner("network");
  const server = markupSaveBanner("server");
  const abort = markupSaveBanner("abort");
  const viewOnly = markupSaveBanner("view_only");
  const signedOut = markupSaveBanner("signed_out");
  const bad = markupSaveBanner("server", false);
  assert.equal(network.message, MARKUP_NETWORK_MESSAGE);
  assert.equal(server.message, MARKUP_SERVER_MESSAGE);
  assert.equal(abort.message, MARKUP_ABORT_MESSAGE);
  assert.equal(viewOnly.message, MARKUP_VIEW_ONLY_MESSAGE);
  assert.equal(network.retry, true);
  assert.equal(server.retry, true);
  assert.equal(abort.retry, true);
  assert.equal(viewOnly.retry, false);
  assert.equal(signedOut.retry, false);
  assert.equal(bad.retry, false);
  assert.match(network.message, /Tap Retry/);
  assert.match(network.message, /Kept on this device/);
  assert.equal(network.speak, `${network.title}. ${network.message}`);
  assert.equal(/tap retry/i.test(viewOnly.message), false);
  assert.equal(/tap retry/i.test(viewOnly.speak), false);
  assert.equal(/tap retry/i.test(bad.message), false);

  const draft = markupSaveDraftBanner("network");
  assert.match(draft.message, /Draft still goes to the foreman/);
  assert.match(draft.message, /Tap Retry/);
  assert.equal(draft.speak, `${draft.title}. ${draft.message}`);
  const viewDraft = markupSaveDraftBanner("view_only");
  assert.match(viewDraft.message, /Draft still goes to the foreman/);
  assert.equal(viewDraft.retry, false);

  const resting = markupSaveSurface({
    itemCount: 0,
    storage: "supabase",
    saving: false,
  });
  const idleLocal = markupSaveSurface({
    itemCount: 0,
    storage: "unconfigured",
  });
  const empty = markupSaveSurface({
    itemCount: 0,
    storage: "supabase",
    settledEmpty: true,
  });
  const saving = markupSaveSurface({
    saving: true,
    itemCount: 0,
    storage: "local",
  });
  const saved = markupSaveSurface({
    itemCount: 1,
    storage: "supabase",
  });
  const local = markupSaveSurface({
    itemCount: 2,
    storage: "local",
  });
  const dropped = markupSaveSurface({
    saving: true,
    itemCount: 1,
    storage: "unavailable",
    fail: "abort",
    persistFailed: true,
  });
  const cleared = markupSaveSurface({
    itemCount: 0,
    storage: "unavailable",
    fail: "server",
    persistFailed: true,
  });
  assert.equal(resting.kind, "saved");
  assert.equal(idleLocal.kind, "local");
  assert.equal(empty.kind, "empty");
  assert.equal(saving.kind, "saving");
  assert.equal(saved.kind, "saved");
  assert.equal(local.kind, "local");
  assert.equal(dropped.kind, "error");
  assert.equal(cleared.kind, "error");
  if (empty.kind === "empty" && dropped.kind === "error" && cleared.kind === "error") {
    assert.equal(empty.title, MARKUP_EMPTY_TITLE);
    assert.equal(empty.message, MARKUP_EMPTY_MESSAGE);
    assert.equal(empty.speak, markupSaveEmptySpeak());
    assert.equal(/retry|failed|error/i.test(empty.message), false);
    assert.equal(/retry|failed|error/i.test(empty.speak), false);
    assert.equal(dropped.retry, true);
    assert.match(dropped.message, /stopped early/);
    assert.equal(cleared.retry, true);
    assert.notEqual(empty.title, dropped.title);
  }

  assert.equal(markupSaveFromQuery("failed").fail, "server");
  assert.equal(markupSaveFromQuery("network").fail, "network");
  assert.equal(markupSaveFromQuery(undefined).fail, null);
  assert.equal(
    foremanDraftStillAllowed({ selected: true, persistFailed: true }),
    true,
  );
  assert.equal(forbidden.test(JSON.stringify({ network, empty, draft })), false);
});

test("a dropped markup save retries once, and view-only does not", async () => {
  assert.equal(MARKUP_SAVE_ATTEMPTS, 2);
  assert.equal(MARKUP_SAVE_BACKOFF_MS, 400);
  assert.equal(
    shouldAutoRetryMarkupSave({ attempt: 0, fail: "network", retryable: true }),
    true,
  );
  assert.equal(
    shouldAutoRetryMarkupSave({ attempt: 1, fail: "network", retryable: true }),
    false,
  );
  assert.equal(
    shouldAutoRetryMarkupSave({ attempt: 0, fail: "view_only", retryable: false }),
    false,
  );

  const noisy = classifyMarkupPutResponse({
    httpStatus: 200,
    ok: true,
    body: {
      ok: true,
      storage: "unavailable",
      fail: "server",
      error: "supabase exploded with a service role",
    },
  });
  assert.equal(noisy.fail, "server");
  assert.equal(noisy.storage, "unavailable");
  assert.equal(JSON.stringify(markupSaveBanner("server")).includes("service role"), false);

  assert.equal(
    classifyMarkupPutResponse({
      httpStatus: 200,
      ok: true,
      body: { ok: true, storage: "unconfigured", row: null },
    }).fail,
    null,
  );
  assert.equal(
    classifyMarkupPutResponse({ thrown: true, httpStatus: 0, body: null }).fail,
    "network",
  );
  assert.equal(
    classifyMarkupPutResponse({ aborted: true, httpStatus: 0, body: null }).fail,
    "abort",
  );
  assert.equal(
    classifyMarkupPutResponse({
      httpStatus: 200,
      ok: true,
      unreadable: true,
      body: null,
    }).fail,
    "abort",
  );
  assert.equal(classifyMarkupPutResponse({ httpStatus: 403, ok: false, body: {} }).fail, "view_only");
  assert.equal(
    classifyMarkupPutResponse({ httpStatus: 403, ok: false, body: {} }).retryable,
    false,
  );
  assert.equal(classifyMarkupPutResponse({ httpStatus: 500, ok: false, body: {} }).fail, "server");
  assert.equal(
    classifyMarkupPutResponse({
      httpStatus: 200,
      ok: true,
      body: { ok: true, storage: "unavailable", fail: "abort" },
    }).fail,
    "abort",
  );

  let networkCalls = 0;
  const dropped = await putMarkupOverlay({
    ...overlay,
    backoffMs: 0,
    fetchImpl: async () => {
      networkCalls += 1;
      throw new TypeError("failed to fetch");
    },
  });
  assert.equal(networkCalls, 2);
  assert.equal(dropped.fail, "network");
  assert.equal(dropped.storage, "local");
  assert.equal(dropped.retryable, true);

  let serverCalls = 0;
  const server = await putMarkupOverlay({
    ...overlay,
    backoffMs: 0,
    fetchImpl: async () => {
      serverCalls += 1;
      return new Response(
        JSON.stringify({ ok: true, storage: "unavailable", fail: "server", row: { id: overlay.id } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(serverCalls, 2);
  assert.equal(server.fail, "server");
  assert.equal(server.storage, "unavailable");

  let abortCalls = 0;
  const stopped = await putMarkupOverlay({
    ...overlay,
    backoffMs: 0,
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        abortCalls += 1;
        const abort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener("abort", abort);
      }),
  });
  assert.equal(abortCalls, 2);
  assert.equal(stopped.fail, "abort");

  let viewCalls = 0;
  const viewOnly = await putMarkupOverlay({
    ...overlay,
    backoffMs: 0,
    fetchImpl: async () => {
      viewCalls += 1;
      return new Response(JSON.stringify({ ok: false, error: "View-only session." }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(viewCalls, 1);
  assert.equal(viewOnly.fail, "view_only");
  assert.equal(viewOnly.retryable, false);

  let savedCalls = 0;
  const saved = await putMarkupOverlay({
    ...overlay,
    backoffMs: 0,
    fetchImpl: async () => {
      savedCalls += 1;
      return new Response(
        JSON.stringify({
          ok: true,
          storage: "supabase",
          row: {
            id: overlay.id,
            request_id: overlay.requestId,
            sheet_id: overlay.sheetId,
            vectors: overlay.vectors,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(savedCalls, 1);
  assert.equal(saved.fail, null);
  assert.equal(saved.storage, "supabase");
  assert.equal(saved.row?.id, overlay.id);
});

test("markup save cards keep Retry and Hear this, and empty stays a status", () => {
  const banner = readFileSync(
    new URL("../components/MarkupFieldBanner.tsx", import.meta.url),
    "utf8",
  );
  const toolbar = readFileSync(
    new URL("../components/MarkupToolbar.tsx", import.meta.url),
    "utf8",
  );
  const form = readFileSync(
    new URL("../components/GenerateRfiForm.tsx", import.meta.url),
    "utf8",
  );
  const viewer = readFileSync(
    new URL("../components/SheetViewer.tsx", import.meta.url),
    "utf8",
  );
  const hook = readFileSync(
    new URL("../components/useMarkupOverlay.ts", import.meta.url),
    "utf8",
  );
  const chip = readFileSync(
    new URL("../components/MarkupSaveChip.tsx", import.meta.url),
    "utf8",
  );
  const sheet = readFileSync(
    new URL("../components/SheetPdfErrorBanner.tsx", import.meta.url),
    "utf8",
  );
  const errorCard = banner.slice(0, banner.indexOf("type EmptyProps"));
  const emptyCard = banner.slice(banner.indexOf("type EmptyProps"));
  assert.match(errorCard, /role="alert"/);
  assert.match(errorCard, /min-h-12 w-full/);
  assert.match(errorCard, /Hear this/);
  assert.match(errorCard, /Retry/);
  assert.match(sheet, /min-h-12 w-full/);
  assert.match(emptyCard, /role="status"/);
  assert.match(emptyCard, /Hear this/);
  assert.doesNotMatch(emptyCard, /Retry/);
  assert.doesNotMatch(emptyCard, /role="alert"/);

  assert.match(toolbar, /MarkupFieldBanner/);
  assert.match(toolbar, /MarkupFieldEmptyState/);
  assert.match(toolbar, /onRetrySave/);
  assert.doesNotMatch(toolbar, /Couldn't save/);
  assert.doesNotMatch(chip, /Couldn't save/);
  assert.match(form, /MarkupFieldBanner/);
  assert.match(form, /MarkupFieldEmptyState/);
  assert.match(form, /markupSaveDraftBanner/);
  assert.match(form, /speakId="markup-save-error"/);
  assert.match(form, /speakId="markup-save-empty"/);
  assert.match(form, /retryMarkupCloudSave/);
  assert.doesNotMatch(form, /Couldn't save/);
  assert.match(viewer, /foremanDraftStillAllowed/);
  assert.match(viewer, /onRetrySave/);
  assert.match(hook, /putMarkupOverlay/);
  assert.match(hook, /saveLocalOverlay/);
  assert.equal(form.includes("SUPABASE_SERVICE_ROLE"), false);
  assert.equal(toolbar.includes("SUPABASE_SERVICE_ROLE"), false);
  assert.equal(
    forbidden.test([banner, toolbar, form, viewer, hook, chip].join("\n")),
    false,
  );
});
