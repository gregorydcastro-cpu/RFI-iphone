import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  CREW_EMAIL_INVALID_MESSAGE,
  CREW_EMAIL_MESSAGE,
  CREW_FORBIDDEN_MESSAGE,
  CREW_OFFLINE_MESSAGE,
  CREW_SEND_CLIENT_MS,
  INVITE_EMPTY_MESSAGE,
  INVITE_EMPTY_TITLE,
  INVITE_FAIL_TITLE,
  INVITE_TIMEOUT_MESSAGE,
  INVITE_UNAVAILABLE_MESSAGE,
  SHARE_EMPTY_MESSAGE,
  SHARE_EMPTY_TITLE,
  SHARE_FAIL_TITLE,
  SHARE_LINK_PATH,
  SHARE_TIMEOUT_MESSAGE,
  SHARE_UNAVAILABLE_MESSAGE,
  classifyCrewSendDraft,
  classifyCrewSendResponse,
  crewSendBanner,
  crewSendConfirmed,
  crewSendEmpty,
  crewSendHttpStatus,
  inviteMail,
  postCrewSend,
  shareLinkMail,
  sharePortalUrl,
  shouldAutoRetryCrewSend,
} from "./crewSendField.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;
const jargon = /resend|stack|supabase_service_role|fetch failed|ECONN|status code/i;

const mapleBody = {
  recipient: "alex.rivera@crew.example",
  role: "viewer",
  job: "maple-point",
};

test("offline, timeout, and email service are Retry cards; view-only and a bad email are not", () => {
  const inviteOffline = crewSendBanner("invite", "offline");
  const inviteTimeout = crewSendBanner("invite", "timeout");
  const inviteMailFail = crewSendBanner("invite", "email_failed");
  const inviteStore = crewSendBanner("invite", "unavailable");
  const inviteForbidden = crewSendBanner("invite", "forbidden");
  const inviteSignedOut = crewSendBanner("invite", "forbidden", "signed_out");
  const inviteBadEmail = crewSendBanner("invite", "invalid");
  const inviteBadRole = crewSendBanner("invite", "invalid", "role");
  const shareOffline = crewSendBanner("share", "offline");
  const shareTimeout = crewSendBanner("share", "timeout");
  const shareMail = crewSendBanner("share", "email_failed");
  const shareStore = crewSendBanner("share", "unavailable");
  const shareForbidden = crewSendBanner("share", "forbidden");

  assert.equal(inviteOffline.title, INVITE_FAIL_TITLE);
  assert.equal(shareOffline.title, SHARE_FAIL_TITLE);
  assert.equal(inviteOffline.message, CREW_OFFLINE_MESSAGE);
  assert.equal(inviteTimeout.message, INVITE_TIMEOUT_MESSAGE);
  assert.equal(shareTimeout.message, SHARE_TIMEOUT_MESSAGE);
  assert.equal(inviteMailFail.message, CREW_EMAIL_MESSAGE);
  assert.equal(shareMail.message, CREW_EMAIL_MESSAGE);
  assert.equal(inviteStore.message, INVITE_UNAVAILABLE_MESSAGE);
  assert.equal(shareStore.message, SHARE_UNAVAILABLE_MESSAGE);
  assert.equal(inviteForbidden.message, CREW_FORBIDDEN_MESSAGE);
  assert.equal(inviteSignedOut.message, "Sign in first.");
  assert.equal(inviteBadEmail.message, CREW_EMAIL_INVALID_MESSAGE);
  assert.equal(inviteBadRole.message, "Pick full or view only.");
  assert.equal(crewSendBanner("share", "invalid", "job").message, "Pick a job.");

  for (const card of [
    inviteOffline,
    inviteTimeout,
    inviteMailFail,
    inviteStore,
    shareOffline,
    shareTimeout,
    shareMail,
    shareStore,
  ]) {
    assert.equal(card.retry, true);
    assert.match(card.message, /Tap Retry/);
    assert.equal(card.speak, `${card.title}. ${card.message}`);
    assert.equal(jargon.test(card.message), false);
    assert.equal(jargon.test(card.speak), false);
  }
  for (const card of [inviteForbidden, inviteSignedOut, inviteBadEmail, inviteBadRole, shareForbidden]) {
    assert.equal(card.retry, false);
    assert.equal(/tap retry/i.test(card.message), false);
    assert.equal(/tap retry/i.test(card.speak), false);
  }
});

test("a blank share send is a status, and a blank invite email can still mint a link", () => {
  const shareEmpty = classifyCrewSendDraft({
    kind: "share",
    recipient: "  ",
    role: "viewer",
    job: "cedar-ridge",
  });
  const inviteEmpty = classifyCrewSendDraft({
    kind: "invite",
    recipient: "",
    role: "full",
    job: "maple-point",
    emailOptional: false,
  });
  const inviteLink = classifyCrewSendDraft({
    kind: "invite",
    recipient: "  ",
    role: "full",
    job: "maple-point",
    emailOptional: true,
  });
  assert.equal(shareEmpty.ok, false);
  assert.equal(inviteEmpty.ok, false);
  if (!shareEmpty.ok && "empty" in shareEmpty && !inviteEmpty.ok && "empty" in inviteEmpty) {
    assert.equal(shareEmpty.empty.title, SHARE_EMPTY_TITLE);
    assert.equal(shareEmpty.empty.message, SHARE_EMPTY_MESSAGE);
    assert.equal(shareEmpty.empty.speak, crewSendEmpty("share").speak);
    assert.equal(/retry|failed|error/i.test(shareEmpty.empty.message), false);
    assert.equal(/retry|failed|error/i.test(shareEmpty.empty.speak), false);
    assert.equal(inviteEmpty.empty.title, INVITE_EMPTY_TITLE);
    assert.equal(inviteEmpty.empty.message, INVITE_EMPTY_MESSAGE);
    assert.equal(/retry|failed|error/i.test(inviteEmpty.empty.message), false);
  } else {
    assert.fail("blank send should be a status");
  }
  assert.equal(inviteLink.ok, true);
  if (inviteLink.ok) assert.equal(inviteLink.recipient, null);
});

test("bad email, bad role, and an unknown job do not retry", () => {
  const badEmail = classifyCrewSendDraft({
    kind: "invite",
    recipient: "not-an-email",
    role: "full",
    job: "maple-point",
    emailOptional: true,
  });
  const badRole = classifyCrewSendDraft({
    kind: "share",
    recipient: "alex.rivera@crew.example",
    role: "puller",
    job: "cedar-ridge",
  });
  const badJob = classifyCrewSendDraft({
    kind: "share",
    recipient: "alex.rivera@crew.example",
    role: "viewer",
    job: "not-a-job",
  });
  assert.equal(badEmail.ok, false);
  assert.equal(badRole.ok, false);
  assert.equal(badJob.ok, false);
  if (!badEmail.ok && "banner" in badEmail) {
    assert.equal(badEmail.banner.retry, false);
    assert.equal(badEmail.banner.code, "invalid");
    assert.equal(badEmail.banner.message, CREW_EMAIL_INVALID_MESSAGE);
  }
  if (!badRole.ok && "banner" in badRole) {
    assert.equal(badRole.banner.detail, "role");
    assert.equal(badRole.banner.retry, false);
  }
  if (!badJob.ok && "banner" in badJob) {
    assert.equal(badJob.banner.detail, "job");
    assert.equal(badJob.banner.retry, false);
  }
});

test("HTTP codes classify without using the provider body", () => {
  const offline = classifyCrewSendResponse({
    kind: "invite",
    thrown: true,
    httpStatus: 0,
    body: { error: "Failed to fetch", stack: "Error: fetch" },
  });
  const timeout = classifyCrewSendResponse({
    kind: "share",
    timedOut: true,
    httpStatus: 0,
    body: { message: "Resend timeout" },
  });
  const mailed = classifyCrewSendResponse({
    kind: "invite",
    httpStatus: 502,
    body: { ok: false, code: "email_failed", error: "resend_http_422 domain" },
  });
  const forbidden = classifyCrewSendResponse({
    kind: "share",
    httpStatus: 403,
    body: { ok: false, code: "forbidden" },
  });
  const signedOut = classifyCrewSendResponse({
    kind: "invite",
    httpStatus: 401,
    body: { ok: false, code: "forbidden", detail: "signed_out" },
  });
  const invalid = classifyCrewSendResponse({
    kind: "share",
    httpStatus: 400,
    body: { ok: false, code: "invalid", error: "invitee_email must be a valid email" },
  });
  const missingKey = classifyCrewSendResponse({
    kind: "share",
    httpStatus: 502,
    body: { ok: false, code: "email_failed" },
  });
  assert.equal(offline.code, "offline");
  assert.equal(offline.retry, true);
  assert.equal(jargon.test(offline.message), false);
  assert.equal(timeout.code, "timeout");
  assert.equal(timeout.retry, true);
  assert.equal(mailed.code, "email_failed");
  assert.equal(mailed.message, CREW_EMAIL_MESSAGE);
  assert.equal(forbidden.retry, false);
  assert.equal(signedOut.message, "Sign in first.");
  assert.equal(signedOut.retry, false);
  assert.equal(invalid.retry, false);
  assert.equal(invalid.message, CREW_EMAIL_INVALID_MESSAGE);
  assert.equal(missingKey.code, "email_failed");
  assert.equal(crewSendHttpStatus("email_failed"), 502);
  assert.equal(crewSendHttpStatus("timeout"), 504);
  assert.equal(crewSendHttpStatus("offline"), 503);
  assert.equal(crewSendHttpStatus("forbidden"), 403);
  assert.equal(crewSendHttpStatus("invalid"), 400);
  assert.equal(shouldAutoRetryCrewSend({ attempt: 0, code: "email_failed" }), true);
  assert.equal(shouldAutoRetryCrewSend({ attempt: 0, code: "offline" }), true);
  assert.equal(shouldAutoRetryCrewSend({ attempt: 0, code: "timeout" }), false);
  assert.equal(shouldAutoRetryCrewSend({ attempt: 0, code: "forbidden" }), false);
  assert.equal(shouldAutoRetryCrewSend({ attempt: 0, code: "invalid" }), false);
  assert.equal(shouldAutoRetryCrewSend({ attempt: 1, code: "email_failed" }), false);
});

test("success requires the API to confirm the send", () => {
  assert.equal(
    crewSendConfirmed({
      emailRequested: true,
      body: { ok: true, sent: false, url: "https://www.gcfieldlog.com/invite/tok" },
    }),
    null,
  );
  assert.equal(
    crewSendConfirmed({
      emailRequested: true,
      body: { ok: true, url: "https://www.gcfieldlog.com/share?job=maple-point" },
    }),
    null,
  );
  assert.deepEqual(
    crewSendConfirmed({
      emailRequested: true,
      body: { ok: true, sent: true, url: "https://www.gcfieldlog.com/share?job=maple-point" },
    }),
    { url: "https://www.gcfieldlog.com/share?job=maple-point", sent: true },
  );
  assert.deepEqual(
    crewSendConfirmed({
      emailRequested: false,
      body: { ok: true, sent: false, url: "https://www.gcfieldlog.com/invite/tok" },
    }),
    { url: "https://www.gcfieldlog.com/invite/tok", sent: false },
  );
  assert.equal(
    crewSendConfirmed({ emailRequested: false, body: { ok: true, sent: false } }),
    null,
  );
});

test("retry posts the same recipient, role, and job", async () => {
  const bodies: unknown[] = [];
  let calls = 0;
  const failed = await postCrewSend({
    kind: "share",
    path: SHARE_LINK_PATH,
    body: mapleBody,
    emailRequested: true,
    attempts: 2,
    backoffMs: 0,
    timeoutMs: 50,
    fetchImpl: async (_url, init) => {
      calls += 1;
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({ ok: false, code: "email_failed", error: "Resend exploded" }),
        { status: 502, headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(bodies[0], mapleBody);
  assert.deepEqual(bodies[1], mapleBody);
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.banner.title, SHARE_FAIL_TITLE);
    assert.equal(failed.banner.message, CREW_EMAIL_MESSAGE);
    assert.equal(jargon.test(failed.banner.message), false);
  }

  let forbiddenCalls = 0;
  const viewOnly = await postCrewSend({
    kind: "invite",
    path: "/api/invites",
    body: { role: "viewer", invitee_email: "alex.rivera@crew.example", job: "cedar-ridge" },
    emailRequested: true,
    backoffMs: 0,
    fetchImpl: async () => {
      forbiddenCalls += 1;
      return new Response(JSON.stringify({ ok: false, code: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(forbiddenCalls, 1);
  assert.equal(viewOnly.ok, false);
  if (!viewOnly.ok) assert.equal(viewOnly.banner.retry, false);

  let timeoutCalls = 0;
  const timed = await postCrewSend({
    kind: "invite",
    path: "/api/invites",
    body: { role: "full", invitee_email: "alex.rivera@crew.example", job: "maple-point" },
    emailRequested: true,
    attempts: 2,
    backoffMs: 0,
    timeoutMs: 20,
    fetchImpl: (_url, init) =>
      new Promise((_resolve, reject) => {
        timeoutCalls += 1;
        const abort = () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        };
        if (init?.signal?.aborted) abort();
        else init?.signal?.addEventListener("abort", abort);
      }),
  });
  assert.equal(timeoutCalls, 1);
  assert.equal(timed.ok, false);
  if (!timed.ok) {
    assert.equal(timed.banner.code, "timeout");
    assert.equal(timed.banner.retry, true);
  }

  const quiet = await postCrewSend({
    kind: "share",
    path: SHARE_LINK_PATH,
    body: mapleBody,
    emailRequested: true,
    offline: true,
    fetchImpl: async () => {
      throw new Error("should not send");
    },
  });
  assert.equal(quiet.ok, false);
  if (!quiet.ok) assert.equal(quiet.code, "offline");

  const lied = await postCrewSend({
    kind: "invite",
    path: "/api/invites",
    body: { role: "full", invitee_email: "alex.rivera@crew.example", job: "maple-point" },
    emailRequested: true,
    attempts: 1,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({ ok: true, sent: false, url: "https://www.gcfieldlog.com/invite/tok" }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });
  assert.equal(lied.ok, false);
  if (!lied.ok) assert.equal(lied.code, "email_failed");

  const sent = await postCrewSend({
    kind: "share",
    path: SHARE_LINK_PATH,
    body: mapleBody,
    emailRequested: true,
    attempts: 2,
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          sent: true,
          url: "https://www.gcfieldlog.com/share?job=maple-point",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  });
  assert.equal(sent.ok, true);
  if (sent.ok) {
    assert.equal(sent.sent, true);
    assert.match(sent.url ?? "", /maple-point/);
  }
  assert.ok(CREW_SEND_CLIENT_MS >= 8_000);
});

test("mail copy names Maple Point or Cedar Ridge and not the provider", () => {
  const invite = inviteMail({
    url: "https://www.gcfieldlog.com/invite/tok",
    role: "full",
    jobName: "Maple Point Medical Office",
  });
  const share = shareLinkMail({
    url: "https://www.gcfieldlog.com/share?job=cedar-ridge",
    role: "viewer",
    jobName: "Cedar Ridge Outpatient",
  });
  assert.match(invite.subject, /Maple Point/);
  assert.match(invite.text, /full crew/);
  assert.match(share.subject, /Cedar Ridge/);
  assert.match(share.text, /view only/);
  assert.equal(sharePortalUrl("https://www.gcfieldlog.com", "maple-point"), "https://www.gcfieldlog.com/share?job=maple-point");
  assert.equal(sharePortalUrl("https://www.gcfieldlog.com", "not-a-job"), null);
  const blob = [invite.subject, invite.text, share.subject, share.text].join("\n");
  assert.equal(forbidden.test(blob), false);
  assert.equal(jargon.test(blob), false);
});

test("invite and share cards keep Retry and Hear this, and empty stays a status", () => {
  const card = readFileSync(
    new URL("../components/FieldFailureCard.tsx", import.meta.url),
    "utf8",
  );
  const sheet = readFileSync(
    new URL("../components/SheetPdfErrorBanner.tsx", import.meta.url),
    "utf8",
  );
  const invite = readFileSync(
    new URL("../components/InviteCrewCard.tsx", import.meta.url),
    "utf8",
  );
  const shareCard = readFileSync(
    new URL("../components/ShareLinkCard.tsx", import.meta.url),
    "utf8",
  );
  const portal = readFileSync(
    new URL("../components/SharePortal.tsx", import.meta.url),
    "utf8",
  );
  const inviteRoute = readFileSync(
    new URL("../app/api/invites/route.ts", import.meta.url),
    "utf8",
  );
  const shareRoute = readFileSync(
    new URL("../app/api/share/link/route.ts", import.meta.url),
    "utf8",
  );
  const errorCard = card.slice(0, card.indexOf("type EmptyProps"));
  const emptyCard = card.slice(card.indexOf("type EmptyProps"));
  assert.match(errorCard, /role="alert"/);
  assert.match(errorCard, /min-h-12 w-full/);
  assert.match(errorCard, /Hear this/);
  assert.match(errorCard, /Retry/);
  assert.match(sheet, /min-h-12 w-full/);
  assert.match(sheet, /role="alert"/);
  assert.match(emptyCard, /role="status"/);
  assert.match(emptyCard, /Hear this/);
  assert.doesNotMatch(emptyCard, /Retry/);
  assert.doesNotMatch(emptyCard, /role="alert"/);

  assert.match(invite, /FieldFailureCard/);
  assert.match(invite, /FieldFailureEmpty/);
  assert.match(invite, /onGenerate\(\)/);
  assert.match(invite, /setEmail\(event\.target\.value\)/);
  assert.doesNotMatch(invite, /setEmail\(""\)/);
  assert.doesNotMatch(invite, /setJob\(""\)/);
  assert.match(invite, /failure\.retry \? \(\) => void onGenerate\(\)/);
  assert.match(shareCard, /FieldFailureCard/);
  assert.match(shareCard, /FieldFailureEmpty/);
  assert.match(shareCard, /setEmail\(event\.target\.value\)/);
  assert.doesNotMatch(shareCard, /setEmail\(""\)/);
  assert.match(shareCard, /failure\.retry \? \(\) => void onSend\(\)/);
  assert.match(shareCard, /crewSendBanner\("share", "forbidden"\)/);
  assert.match(portal, /ShareLinkCard/);
  assert.match(inviteRoute, /sendFieldEmail/);
  assert.match(inviteRoute, /sent: true/);
  assert.match(inviteRoute, /sent: false/);
  assert.match(shareRoute, /sendFieldEmail/);
  assert.match(shareRoute, /sent: true/);
  assert.doesNotMatch(inviteRoute, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(shareRoute, /ok: true, sent: true[\s\S]*sendFieldEmail/);
  assert.equal(invite.includes("RESEND_API_KEY"), false);
  assert.equal(shareCard.includes("RESEND_API_KEY"), false);
  assert.equal(
    forbidden.test([card, invite, shareCard, portal, inviteRoute, shareRoute].join("\n")),
    false,
  );
});
