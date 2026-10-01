import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dayHoursLabel,
  dayHoursParts,
  foremanPunchNotice,
  PUNCH_SAVE_FAILED_MESSAGE,
  punchPersistOutcome,
  punchWriteAccepted,
  workerPunchNeedsPin,
  workerPunchNotice,
  type TimePunch,
  type Worker,
} from "./time.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

function punch(partial: Partial<TimePunch> = {}): TimePunch {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    job_site_id: "00000000-0000-4000-8000-000000000001",
    worker_id: "00000000-0000-4000-8000-000000000012",
    punch_type: "in",
    punched_at: "2026-10-01T12:00:00.000Z",
    lat: 42.53,
    lng: -92.44,
    accuracy_m: 8,
    distance_m: 12,
    geofence_ok: true,
    edited_by_foreman: false,
    edit_note: null,
    created_at: "2026-10-01T12:00:00.000Z",
    updated_at: "2026-10-01T12:00:00.000Z",
    ...partial,
  };
}

function worker(id: string, email: string): Worker {
  return {
    id,
    job_site_id: "site",
    name: id === "alex" ? "Alex Rivera" : "Jordan Hale",
    role: "journeyman",
    email,
    pin_stub: "1041",
  };
}

test("configured insert failure is not a saved punch", () => {
  const row = punch();
  const result = punchPersistOutcome({
    punch: row,
    saved: null,
    writeConfigured: true,
    storageHint: "supabase",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 503);
  assert.equal(result.code, "save_failed");
  assert.equal(result.error, PUNCH_SAVE_FAILED_MESSAGE);
  assert.equal(forbidden.test(result.error), false);
});

test("configured insert success keeps the saved row", () => {
  const row = punch();
  const saved = punch({ id: "saved-row" });
  const result = punchPersistOutcome({
    punch: row,
    saved,
    writeConfigured: true,
    storageHint: "memory",
  });
  assert.deepEqual(result, { ok: true, punch: saved, storage: "supabase" });
});

test("demo memory still saves when time tables are not configured", () => {
  const row = punch();
  const result = punchPersistOutcome({
    punch: row,
    saved: null,
    writeConfigured: false,
    storageHint: "memory",
  });
  assert.deepEqual(result, { ok: true, punch: row, storage: "memory" });

  const hinted = punchPersistOutcome({
    punch: row,
    saved: null,
    writeConfigured: false,
    storageHint: "supabase",
  });
  assert.equal(hinted.ok, true);
  if (!hinted.ok) return;
  assert.equal(hinted.storage, "memory");
});

test("client treats unavailable storage as a failed punch", () => {
  assert.equal(punchWriteAccepted({ ok: true, storage: "supabase" }), true);
  assert.equal(punchWriteAccepted({ ok: true, storage: "memory" }), true);
  assert.equal(punchWriteAccepted({ ok: true, storage: "unavailable" }), false);
  assert.equal(punchWriteAccepted({ ok: false, storage: "supabase" }), false);
  assert.equal(punchWriteAccepted({ ok: true }), true);
});

test("punch notices say in or out in plain words", () => {
  const inn = workerPunchNotice("in", "2026-10-01T14:04:00.000Z");
  const out = workerPunchNotice("out", "2026-10-01T20:12:00.000Z");
  assert.match(inn, /^Punched in at .+ You are on the clock\.$/);
  assert.match(out, /^Punched out at .+ You are off the clock\.$/);
  assert.equal(foremanPunchNotice("add"), "Missed punch saved.");
  assert.equal(foremanPunchNotice("edit"), "Punch time updated.");
  assert.equal(forbidden.test(`${inn} ${out}`), false);
});

test("own name skips the shared iPad PIN", () => {
  const alex = worker("alex", "alex.rivera@crew.example");
  const jordan = worker("jordan", "jordan.hale@crew.example");
  const crew = [alex, jordan];
  assert.equal(workerPunchNeedsPin(alex, crew, "Alex.Rivera@crew.example"), false);
  assert.equal(workerPunchNeedsPin(jordan, crew, "alex.rivera@crew.example"), true);
  assert.equal(workerPunchNeedsPin(alex, crew, "someone@crew.example"), true);
  assert.equal(workerPunchNeedsPin(alex, crew, null), true);
});

test("week cells say on, no out, or hours", () => {
  assert.equal(dayHoursLabel({ hours: 0, open: false, missedOut: false }), "—");
  assert.equal(dayHoursLabel({ hours: 8, open: false, missedOut: false }), "8.0");
  assert.deepEqual(dayHoursParts({ hours: 8.2, open: true, missedOut: false }), {
    primary: "8.2",
    secondary: "on",
  });
  assert.equal(dayHoursLabel({ hours: 0, open: true, missedOut: false }), "On");
  assert.equal(dayHoursLabel({ hours: 3, open: false, missedOut: true }), "No out");
});
