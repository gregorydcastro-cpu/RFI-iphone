import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { connectionStatusFromRow } from "./procoreConnections.ts";
import {
  PACK_RECONNECT_TEXT,
  PACK_RETRY_TEXT,
  PROCORE_RECONNECT_EXPIRES_AT,
  classifyProcoreTokenFailure,
  packPullNotice,
  procoreReconnectHref,
  procoreReconnectNeeded,
  procoreReturnFromCookie,
  restNeedsReconnect,
  safeProcoreReturnPath,
} from "./procoreAuthHealth.ts";
import { requestPackRefresh } from "./procorePackRefresh.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("token HTTP 400/401/403 is reconnect; timeouts and 5xx stay retryable", () => {
  assert.equal(classifyProcoreTokenFailure(400), "rejected");
  assert.equal(classifyProcoreTokenFailure(401), "rejected");
  assert.equal(classifyProcoreTokenFailure(403), "rejected");
  assert.equal(classifyProcoreTokenFailure(0), "transient");
  assert.equal(classifyProcoreTokenFailure(429), "transient");
  assert.equal(classifyProcoreTokenFailure(500), "transient");
  assert.equal(classifyProcoreTokenFailure(503), "transient");
});

test("expired access without a refresh token needs reconnect", () => {
  const now = Date.parse("2026-09-18T12:00:00.000Z");
  assert.equal(
    procoreReconnectNeeded({
      expiresAt: "2026-09-18T11:00:00.000Z",
      hasRefreshToken: false,
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    procoreReconnectNeeded({
      expiresAt: PROCORE_RECONNECT_EXPIRES_AT,
      hasRefreshToken: false,
      nowMs: now,
    }),
    true,
  );
  assert.equal(
    procoreReconnectNeeded({
      expiresAt: "2026-09-18T11:00:00.000Z",
      hasRefreshToken: true,
      nowMs: now,
    }),
    false,
  );
  assert.equal(
    procoreReconnectNeeded({
      expiresAt: "2026-09-18T13:30:00.000Z",
      hasRefreshToken: false,
      nowMs: now,
    }),
    false,
  );
});

test("status row drops tokens and only reports that a refresh token exists", () => {
  const status = connectionStatusFromRow({
    user_id: "user-maple",
    email: "foreman@example.com",
    company_id: "77",
    expires_at: PROCORE_RECONNECT_EXPIRES_AT,
    updated_at: "2026-09-18T12:00:00.000Z",
    refresh_token: "refresh-secret-value",
    access_token: "access-secret-value",
  });
  assert.equal(status?.hasRefreshToken, true);
  assert.equal(status?.connected, true);
  assert.equal("refresh_token" in (status ?? {}), false);
  assert.equal("access_token" in (status ?? {}), false);
  assert.equal(JSON.stringify(status).includes("secret"), false);
  assert.equal(
    connectionStatusFromRow({
      user_id: "user-maple",
      refresh_token: null,
      expires_at: PROCORE_RECONNECT_EXPIRES_AT,
    })?.hasRefreshToken,
    false,
  );
});

test("pack pull notices stay soft and do not claim a live pull", () => {
  assert.equal(
    packPullNotice({ pull: "procore", restReason: "ok" }),
    null,
  );
  const reconnect = packPullNotice({ restReason: "token_refresh_failed", pull: "none" });
  assert.equal(reconnect?.reconnect, true);
  assert.equal(reconnect?.retry, true);
  assert.match(reconnect?.text ?? "", /stays on screen/);
  assert.equal(packPullNotice({ reconnectNeeded: true })?.text, PACK_RECONNECT_TEXT);
  const retry = packPullNotice({ restReason: "procore_unreachable", pull: "none" });
  assert.equal(retry?.text, PACK_RETRY_TEXT);
  assert.equal(retry?.reconnect, false);
  assert.equal(retry?.retry, true);
  assert.match(packPullNotice({ restReason: "api_error" })?.text ?? "", /Retry/);
  assert.equal(packPullNotice({ restReason: "project_not_found" })?.retry, false);
  assert.match(packPullNotice({ timedOut: true })?.text ?? "", /didn't finish/i);
  assert.equal(packPullNotice({ viewOnly: true, restReason: "token_refresh_failed" }), null);
  assert.equal(restNeedsReconnect("token_refresh_failed"), true);
  assert.equal(restNeedsReconnect("missing_tokens"), true);
  assert.equal(restNeedsReconnect("procore_unreachable"), false);
  assert.equal(forbidden.test(PACK_RECONNECT_TEXT + PACK_RETRY_TEXT), false);
});

test("reconnect return path stays on this site", () => {
  assert.equal(safeProcoreReturnPath("/pack/maple-point?job=maple-point&room=101"), "/pack/maple-point?job=maple-point&room=101");
  assert.equal(safeProcoreReturnPath("/jobs/cedar-ridge"), "/jobs/cedar-ridge");
  assert.equal(safeProcoreReturnPath("/account"), "/account");
  assert.equal(safeProcoreReturnPath("/share"), "/share");
  assert.equal(safeProcoreReturnPath("//evil.example"), null);
  assert.equal(safeProcoreReturnPath("https://evil.example/pack/maple-point"), null);
  assert.equal(safeProcoreReturnPath("/pack/../account"), null);
  assert.equal(safeProcoreReturnPath("/api/procore/connect"), null);
  assert.equal(
    procoreReconnectHref("/pack/maple-point?room=101"),
    "/api/procore/connect?next=%2Fpack%2Fmaple-point%3Froom%3D101",
  );
  assert.equal(procoreReconnectHref("https://evil.example"), "/api/procore/connect");
  assert.equal(
    procoreReturnFromCookie(encodeURIComponent("/pack/maple-point?job=maple-point&room=101")),
    "/pack/maple-point?job=maple-point&room=101",
  );
  assert.equal(procoreReturnFromCookie(encodeURIComponent("https://evil.example")), null);
});

test("pack refresh keeps the pack on a dead Procore session and does not hang", async () => {
  const calls: Array<{ signal: AbortSignal | null | undefined }> = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    calls.push({ signal: init?.signal });
    return new Response(
      JSON.stringify({
        ok: true,
        source: "supabase",
        pull: "none",
        restReason: "token_refresh_failed",
        reconnectNeeded: true,
        pack: { project: { name: "Maple Point Medical Office" } },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const result = await requestPackRefresh({
    requestId: "maple-point",
    projectSlug: "maple-point",
    room: "101",
    fetchImpl,
    timeoutMs: 50,
  });
  assert.equal(result.httpStatus, 200);
  assert.equal(result.offline, false);
  assert.equal(result.notice?.tone, "reconnect");
  assert.equal(result.pack?.project.name, "Maple Point Medical Office");
  assert.ok(calls[0]?.signal);

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
  });
  assert.equal(timed.httpStatus, 0);
  assert.equal(timed.offline, true);
  assert.match(timed.notice?.text ?? "", /didn't finish/i);
  assert.equal(timed.notice?.reconnect, false);
});

test("reconnect copy is wired through status, pack, and refresh-all", () => {
  const status = readFileSync(new URL("./procoreStatus.ts", import.meta.url), "utf8");
  const card = readFileSync(
    new URL("../components/ProcoreConnectCard.tsx", import.meta.url),
    "utf8",
  );
  const banner = readFileSync(
    new URL("../components/ProcoreReconnectBanner.tsx", import.meta.url),
    "utf8",
  );
  const refresh = readFileSync(
    new URL("../app/api/room-pack/refresh/route.ts", import.meta.url),
    "utf8",
  );
  const rest = readFileSync(new URL("./procoreRest.ts", import.meta.url), "utf8");
  const token = readFileSync(new URL("./procoreToken.ts", import.meta.url), "utf8");
  const share = readFileSync(
    new URL("../components/SharePortal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(status, /reconnectNeeded/);
  assert.match(status, /probe/);
  assert.doesNotMatch(status, /access_token/);
  assert.doesNotMatch(status, /refresh_token/);
  assert.match(card, /Reconnect Procore/);
  assert.match(card, /Hear this/);
  assert.match(banner, /Hear this/);
  assert.match(banner, /Reconnect/);
  assert.match(banner, /Retry/);
  assert.match(refresh, /reconnectNeeded: restNeedsReconnect/);
  assert.match(refresh, /maxDuration = 30/);
  assert.match(rest, /PACK_REST_BUDGET_MS/);
  assert.match(rest, /token_refresh_failed/);
  assert.match(rest, /procore_unreachable/);
  assert.match(token, /markProcoreReconnectNeeded/);
  assert.match(share, /SHARE_REFRESH_CLIENT_MS/);
  assert.match(share, /AbortError/);
  assert.equal(
    forbidden.test([status, card, banner, refresh, rest, token, share].join("\n")),
    false,
  );
});
