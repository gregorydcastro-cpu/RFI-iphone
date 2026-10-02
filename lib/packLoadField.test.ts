import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PACK_EMPTY_BODY_TEXT,
  PACK_EMPTY_MESSAGE,
  PACK_EMPTY_TITLE,
  PACK_KEPT_TEXT,
  PACK_NETWORK_TEXT,
  PACK_NONE_MESSAGE,
  PACK_NONE_TITLE,
  PACK_PARTIAL_TEXT,
  classifyPackHttp,
  packEmptySpeak,
  packFieldAlert,
  packFieldSpeak,
  packFieldTitle,
  packNoneSpeak,
  packPayloadState,
  shouldAutoRetryPackLoad,
} from "./packLoadField.ts";
import { PACK_RECONNECT_TEXT, PACK_TIMEOUT_TEXT } from "./procoreAuthHealth.ts";
import { requestPackRefresh } from "./procorePackRefresh.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const maplePack = {
  project: { name: "Maple Point Medical Office", slug: "maple-point", id: "maple" },
  room: { id: "101", name: "101" },
  sheets: [{ id: "A-101", rev: "A", pdf: "" }],
};

test("empty pack is nothing to show; a partial body is a failed load", () => {
  assert.equal(packPayloadState(null), "missing");
  assert.equal(packPayloadState({ project: { name: "Maple Point Medical Office" } }), "partial");
  assert.equal(
    packPayloadState({
      project: { name: "Maple Point Medical Office" },
      room: { name: "101" },
      sheets: [],
    }),
    "empty",
  );
  assert.equal(
    packPayloadState({
      project: { name: "Maple Point Medical Office" },
      room: { name: "101" },
      sheets: [{ rev: "A" }],
    }),
    "partial",
  );
  assert.equal(packPayloadState(maplePack), "ready");
  assert.equal(packEmptySpeak(), `${PACK_EMPTY_TITLE}. ${PACK_EMPTY_MESSAGE}`);
  assert.equal(packNoneSpeak(), `${PACK_NONE_TITLE}. ${PACK_NONE_MESSAGE}`);
  assert.equal(forbidden.test(PACK_EMPTY_MESSAGE + PACK_NONE_MESSAGE + PACK_KEPT_TEXT), false);
});

test("pack field card matches the calm retry pattern and hides raw status text", () => {
  const network = classifyPackHttp({
    httpStatus: 0,
    ok: false,
    body: { error: "TypeError: Failed to fetch" },
    network: true,
  });
  assert.equal(network.notice?.text, PACK_NETWORK_TEXT);
  assert.equal(network.notice?.retry, true);
  assert.equal(network.autoRetry, true);
  assert.equal(packFieldAlert(network.notice!), true);
  assert.equal(packFieldTitle(network.notice!), "Pack did not load");
  assert.match(packFieldSpeak(network.notice!), /Tap Retry/);
  assert.equal(packFieldSpeak(network.notice!).includes("Failed to fetch"), false);

  const timeout = classifyPackHttp({
    httpStatus: 0,
    ok: false,
    body: null,
    timedOut: true,
  });
  assert.equal(timeout.notice?.text, PACK_TIMEOUT_TEXT);
  assert.equal(timeout.autoRetry, false);

  const upstream = classifyPackHttp({
    httpStatus: 503,
    ok: false,
    body: { ok: false, error: "HTTP 503 bad gateway" },
  });
  assert.equal(upstream.notice?.retry, true);
  assert.equal(upstream.autoRetry, true);
  assert.equal(JSON.stringify(upstream).includes("503"), true);
  assert.equal(upstream.notice?.text.includes("503"), false);
  assert.equal(upstream.notice?.text.includes("bad gateway"), false);

  const blank = classifyPackHttp({
    httpStatus: 200,
    ok: true,
    body: null,
    unreadable: true,
  });
  assert.equal(blank.notice?.text, PACK_EMPTY_BODY_TEXT);
  assert.equal(blank.empty, false);
  assert.equal(blank.autoRetry, true);

  const partial = classifyPackHttp({
    httpStatus: 200,
    ok: true,
    body: { ok: true, pack: { project: { name: "Cedar Ridge Outpatient" } } },
  });
  assert.equal(partial.pack, undefined);
  assert.equal(partial.notice?.text, PACK_PARTIAL_TEXT);
  assert.equal(partial.autoRetry, true);

  const none = classifyPackHttp({
    httpStatus: 404,
    ok: false,
    body: { ok: false, error: "Pack not available" },
  });
  assert.equal(none.empty, true);
  assert.equal(none.notice, null);
  assert.equal(none.autoRetry, false);
  assert.equal(JSON.stringify(none).includes("Pack not available"), false);

  const honestEmpty = classifyPackHttp({
    httpStatus: 200,
    ok: true,
    body: {
      ok: true,
      pack: {
        project: { name: "Cedar Ridge Outpatient" },
        room: { name: "210" },
        sheets: [],
      },
    },
  });
  assert.equal(honestEmpty.empty, true);
  assert.equal(honestEmpty.notice, null);
  assert.equal(honestEmpty.pack?.sheets.length, 0);
  assert.equal(honestEmpty.autoRetry, false);
});

test("reconnect is spoken and is not an automatic retry loop", () => {
  const reconnect = classifyPackHttp({
    httpStatus: 200,
    ok: true,
    body: {
      ok: true,
      reconnectNeeded: true,
      restReason: "token_refresh_failed",
      pull: "none",
      pack: maplePack,
    },
  });
  assert.equal(reconnect.notice?.text, PACK_RECONNECT_TEXT);
  assert.equal(reconnect.notice?.reconnect, true);
  assert.equal(reconnect.notice?.retry, true);
  assert.equal(reconnect.autoRetry, false);
  assert.equal(packFieldAlert(reconnect.notice!), false);
  assert.equal(packFieldTitle(reconnect.notice!), "Procore needs a reconnect");
  assert.equal(reconnect.pack?.project.name, "Maple Point Medical Office");
  assert.equal(
    shouldAutoRetryPackLoad({
      attempt: 0,
      reconnectNeeded: true,
      network: true,
      httpStatus: 500,
    }),
    false,
  );
  assert.equal(
    shouldAutoRetryPackLoad({ attempt: 0, restReason: "token_refresh_failed", network: true }),
    false,
  );
  assert.equal(shouldAutoRetryPackLoad({ attempt: 0, timedOut: true, network: true }), false);
  assert.equal(shouldAutoRetryPackLoad({ attempt: 0, viewOnly: true, httpStatus: 503 }), false);
  assert.equal(shouldAutoRetryPackLoad({ attempt: 0, httpStatus: 404 }), false);
  assert.equal(shouldAutoRetryPackLoad({ attempt: 1, network: true }), false);
  assert.equal(shouldAutoRetryPackLoad({ attempt: 0, network: true }), true);
});

test("pack refresh retries a 5xx once and does not retry reconnect or a timeout", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ ok: false, error: "upstream blew up" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        ok: true,
        source: "procore",
        pull: "procore",
        restReason: "ok",
        pack: maplePack,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const recovered = await requestPackRefresh({
    requestId: "maple-point",
    projectSlug: "maple-point",
    room: "101",
    fetchImpl,
    backoffMs: 0,
  });
  assert.equal(calls, 2);
  assert.equal(recovered.pack?.project.name, "Maple Point Medical Office");
  assert.equal(recovered.notice, null);

  let reconnectCalls = 0;
  const reconnectFetch: typeof fetch = async () => {
    reconnectCalls += 1;
    return new Response(
      JSON.stringify({
        ok: true,
        pull: "none",
        restReason: "token_refresh_failed",
        reconnectNeeded: true,
        pack: maplePack,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const dead = await requestPackRefresh({
    requestId: "maple-point",
    fetchImpl: reconnectFetch,
    backoffMs: 0,
  });
  assert.equal(reconnectCalls, 1);
  assert.equal(dead.notice?.reconnect, true);
  assert.equal(dead.pack?.sheets[0]?.id, "A-101");

  const hung: typeof fetch = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  const timed = await requestPackRefresh({
    requestId: "maple-point",
    fetchImpl: hung,
    timeoutMs: 20,
    backoffMs: 0,
  });
  assert.equal(timed.httpStatus, 0);
  assert.equal(timed.offline, true);
  assert.match(timed.notice?.text ?? "", /didn't finish/i);
  assert.equal(timed.notice?.reconnect, false);
});

test("pack failure UI keeps Retry and Hear this, and does not render raw errors", () => {
  const banner = readFileSync(
    new URL("../components/ProcoreReconnectBanner.tsx", import.meta.url),
    "utf8",
  );
  const card = readFileSync(
    new URL("../components/PackFieldBanner.tsx", import.meta.url),
    "utf8",
  );
  const viewer = readFileSync(
    new URL("../components/RoomPackViewer.tsx", import.meta.url),
    "utf8",
  );
  const live = readFileSync(
    new URL("../components/PackLiveReload.tsx", import.meta.url),
    "utf8",
  );
  const share = readFileSync(
    new URL("../components/SharePortal.tsx", import.meta.url),
    "utf8",
  );
  const form = readFileSync(
    new URL("../components/RequestPackForm.tsx", import.meta.url),
    "utf8",
  );
  assert.match(banner, /Reconnect/);
  assert.match(banner, /Retry/);
  assert.match(banner, /Hear this/);
  assert.match(card, /Hear this/);
  assert.match(card, /role=\{alert \? "alert" : "status"\}/);
  assert.match(viewer, /PackEmptyState/);
  assert.match(viewer, /Hear this/);
  assert.doesNotMatch(viewer, /This pack has no sheets/);
  assert.doesNotMatch(live, /data\.error/);
  assert.doesNotMatch(live, /Could not load a live pack/);
  assert.match(share, /Retry/);
  assert.match(share, /Hear this/);
  assert.match(form, /Hear this/);
  assert.match(form, /Retry/);
  assert.equal(
    forbidden.test([banner, card, viewer, live, share, form].join("\n")),
    false,
  );
});
