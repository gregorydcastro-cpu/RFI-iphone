import assert from "node:assert/strict";
import { test } from "node:test";
import { PUNCH_SAVE_FAILED_MESSAGE } from "./time.ts";
import {
  PUNCH_EMPTY_NEXT,
  PUNCH_EMPTY_TITLE,
  PUNCH_FAIL_FIX,
  PUNCH_FAIL_NEXT,
  PUNCH_FAIL_TITLE,
  PUNCH_IN_LINE,
  PUNCH_IN_TITLE,
  PUNCH_OFFLINE_NEXT,
  PUNCH_OFFLINE_TITLE,
  PUNCH_OUT_LINE,
  PUNCH_OUT_TITLE,
  PUNCH_SAVED_NEXT,
  PUNCH_SAVED_TITLE,
  punchClockCopy,
  punchClockSpeak,
  punchClockState,
  punchFailureSpeak,
  punchFailureView,
  punchSuccessSpeak,
} from "./punchResult.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107|supabase|api[_ ]?key|cookie|header|PGRST|jwt/i;

test("punch empty, in, and out stay short and do not repeat the title", () => {
  const empty = punchClockCopy("empty");
  const inn = punchClockCopy("in");
  const out = punchClockCopy("out");
  assert.deepEqual(empty, { title: PUNCH_EMPTY_TITLE, line: PUNCH_EMPTY_NEXT });
  assert.deepEqual(inn, { title: PUNCH_IN_TITLE, line: PUNCH_IN_LINE });
  assert.deepEqual(out, { title: PUNCH_OUT_TITLE, line: PUNCH_OUT_LINE });
  assert.equal(punchClockState({ onClock: false, lastType: null }), "empty");
  assert.equal(punchClockState({ onClock: true, lastType: "in" }), "in");
  assert.equal(punchClockState({ onClock: false, lastType: "out" }), "out");
  assert.match(empty.line, /No punches yet/);
  assert.match(empty.line, /Punch in/);
  assert.equal(/off the clock/i.test(empty.line), false);
  assert.equal(inn.line.includes(PUNCH_IN_TITLE), false);
  assert.equal(out.line.includes(PUNCH_OUT_TITLE), false);
  assert.match(punchClockSpeak("empty"), /Not punched in/);
  assert.match(punchClockSpeak("in"), /on the clock/);
  for (const line of [empty.title, empty.line, inn.title, inn.line, out.title, out.line]) {
    assert.ok(line.length <= 48, line);
  }
});

test("a saved punch names the result and the jobs next step", () => {
  const spoken = punchSuccessSpeak("Punched in at 9:04 AM. You are on the clock.");
  assert.match(spoken, /^Saved\./);
  assert.match(spoken, /Punched in at 9:04 AM/);
  assert.match(spoken, /open a job/i);
  assert.equal(PUNCH_SAVED_TITLE, "Saved.");
  assert.equal(PUNCH_SAVED_NEXT, "Next, open a job.");
  assert.ok(PUNCH_SAVED_NEXT.length <= 32);
});

test("a dropped punch offers retry and hides the server string", () => {
  const offline = punchFailureView({ thrown: true, error: "TypeError: Failed to fetch" });
  assert.deepEqual(offline, {
    title: PUNCH_OFFLINE_TITLE,
    next: PUNCH_OFFLINE_NEXT,
    retry: true,
  });
  assert.equal(punchFailureView({ status: 0, error: "Failed to fetch" }).retry, true);
  assert.equal(/failed to fetch/i.test(punchFailureSpeak(offline)), false);

  const missed = punchFailureView({
    status: 503,
    code: "save_failed",
    error: PUNCH_SAVE_FAILED_MESSAGE,
    storage: "unavailable",
  });
  assert.deepEqual(missed, {
    title: PUNCH_FAIL_TITLE,
    next: PUNCH_FAIL_NEXT,
    retry: true,
  });
  const boom = punchFailureView({ status: 500, error: "supabase jwt cookie boom" });
  assert.equal(boom.retry, true);
  assert.equal(boom.next, PUNCH_FAIL_NEXT);
  assert.doesNotMatch(punchFailureSpeak(boom), forbidden);
  assert.equal(/boom|supabase|jwt|cookie/i.test(punchFailureSpeak(boom)), false);
});

test("a locked punch does not offer a retry of the same tap", () => {
  const off = punchFailureView({
    status: 403,
    code: "off_site",
    error: "Off site — punch-in is locked outside the job fence",
    distance_m: 840,
    radius_m: 300,
  });
  assert.equal(off.retry, false);
  assert.equal(
    punchFailureView({
      offline: true,
      status: 403,
      code: "off_site",
      distance_m: 10,
      radius_m: 300,
    }).title,
    off.title,
  );
  assert.match(off.title, /Off site/);
  assert.match(off.next, /840 m away/);
  assert.match(off.next, /300 m/);
  assert.equal(/—/.test(`${off.title} ${off.next}`), false);

  assert.deepEqual(punchFailureView({ code: "bad_pin", error: "PIN does not match" }), {
    title: "PIN does not match.",
    next: "Check the PIN.",
    retry: false,
  });
  assert.equal(punchFailureView({ code: "already_in" }).next, "Punch out first.");
  assert.equal(punchFailureView({ code: "not_in" }).next, "Punch in first.");
  assert.equal(punchFailureView({ code: "gps_required" }).retry, false);
  assert.equal(punchFailureView({ status: 401, error: "Sign in first." }).retry, false);

  const junk = punchFailureView({ status: 400, error: "Invalid JSON workerId" });
  assert.equal(junk.retry, false);
  assert.equal(junk.next, PUNCH_FAIL_FIX);
  assert.equal(/JSON|workerId/i.test(punchFailureSpeak(junk)), false);

  const blob = [
    PUNCH_EMPTY_TITLE,
    PUNCH_EMPTY_NEXT,
    PUNCH_FAIL_TITLE,
    PUNCH_FAIL_NEXT,
    PUNCH_FAIL_FIX,
    PUNCH_OFFLINE_TITLE,
    PUNCH_SAVED_TITLE,
    PUNCH_SAVED_NEXT,
    punchFailureSpeak(off),
    punchFailureSpeak(junk),
  ].join(" ");
  assert.doesNotMatch(blob, forbidden);
});
