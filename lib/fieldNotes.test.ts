import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deliverDueAlerts, runEscalationPass, type AlertContact } from "./fieldNoteAlerts.ts";
import {
  createFieldNote,
  listFieldNotes,
  listNotesForEscalation,
} from "./fieldNotesStore.ts";
import { isFieldNoteTableConfigured } from "./supabaseFieldNotes.ts";
import {
  MITIGATED_REMINDER_MS,
  UNACKED_ESCALATE_MS,
  applyNotePatch,
  createAlertSummary,
  dueSafetyAlerts,
  openSafetyBanner,
  parseFieldNoteCreate,
  visibleFieldNotes,
  type FieldNote,
  type NoteActor,
} from "./fieldNotes.ts";
import { DEMO_FIELD_NOTES } from "./fieldNotesDemo.ts";

const actor: NoteActor = { userId: "user-foreman", name: "Pat Nguyen" };
const NOW = "2026-10-09T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);

const CONTACTS: AlertContact[] = [
  { role: "foreman", name: "Pat Nguyen", notify_email: "pat@crew.example" },
  { role: "superintendent", name: "Morgan Ellis", notify_email: "morgan@crew.example" },
  { role: "gc", name: "Quinn Adler", notify_email: "quinn@crew.example" },
];

function note(partial: Partial<FieldNote> & Pick<FieldNote, "id" | "severity" | "created_at">): FieldNote {
  return {
    job_slug: "maple-point",
    room: "101",
    location: "Corridor",
    body: partial.body ?? "Note",
    photos: [],
    author_user_id: "user-alex",
    author_name: "Alex Rivera",
    updated_at: partial.created_at,
    hazard_type: partial.severity === "safety" ? (partial.hazard_type ?? "fall") : null,
    symptoms_reported: false,
    stop_work: false,
    status: "open",
    acknowledged_by: null,
    acknowledged_at: null,
    resolved_at: null,
    resolution_note: null,
    severity_changed_by: null,
    severity_changed_at: null,
    severity_change_reason: null,
    foreman_alerted_at: null,
    gc_escalated_at: null,
    unacked_realerted_at: null,
    mitigated_at: null,
    mitigated_reminded_at: null,
    ...partial,
  };
}

test("feed sort pins open safety oldest first, then other safety, then priority, then routine", () => {
  const notes = [
    note({ id: "routine-new", severity: "routine", created_at: "2026-10-09T18:00:00.000Z", body: "Routine new" }),
    note({ id: "priority-new", severity: "priority", created_at: "2026-10-09T17:00:00.000Z", body: "Priority new" }),
    note({ id: "priority-old", severity: "priority", created_at: "2026-10-09T09:00:00.000Z", body: "Priority old" }),
    note({
      id: "safety-open-new",
      severity: "safety",
      status: "open",
      created_at: "2026-10-09T15:00:00.000Z",
      body: "Open newer",
    }),
    note({
      id: "safety-open-old",
      severity: "safety",
      status: "open",
      created_at: "2026-10-08T08:00:00.000Z",
      body: "Open older",
    }),
    note({
      id: "safety-ack",
      severity: "safety",
      status: "acknowledged",
      created_at: "2026-10-07T08:00:00.000Z",
      body: "Acknowledged",
    }),
    note({
      id: "safety-mitigated-new",
      severity: "safety",
      status: "mitigated",
      created_at: "2026-10-09T11:00:00.000Z",
      body: "Mitigated newer",
    }),
    note({
      id: "routine-old",
      severity: "routine",
      created_at: "2026-10-01T08:00:00.000Z",
      body: "Routine old",
    }),
    note({
      id: "safety-closed",
      severity: "safety",
      status: "closed",
      created_at: "2026-10-09T19:00:00.000Z",
      body: "Closed safety",
    }),
  ];
  assert.deepEqual(
    visibleFieldNotes(notes, {}).map((item) => item.id),
    [
      "safety-open-old",
      "safety-open-new",
      "safety-ack",
      "safety-mitigated-new",
      "priority-new",
      "priority-old",
      "safety-closed",
      "routine-new",
      "routine-old",
    ],
  );
});

test("closed safety notes sort by date with routine notes", () => {
  const maple = visibleFieldNotes(
    DEMO_FIELD_NOTES.filter((item) => item.job_slug === "maple-point"),
    {},
  ).map((item) => item.id);
  assert.deepEqual(maple, [
    "00000000-0000-4000-8000-000000000101",
    "00000000-0000-4000-8000-000000000102",
    "00000000-0000-4000-8000-000000000104",
    "00000000-0000-4000-8000-000000000103",
  ]);
  const cedar = visibleFieldNotes(
    DEMO_FIELD_NOTES.filter((item) => item.job_slug === "cedar-ridge"),
    {},
  ).map((item) => item.id);
  assert.deepEqual(cedar, [
    "00000000-0000-4000-8000-000000000201",
    "00000000-0000-4000-8000-000000000202",
    "00000000-0000-4000-8000-000000000203",
  ]);
});

test("maple point demo safety note is the epoxy tent with symptoms and no assignee", () => {
  const epoxy = DEMO_FIELD_NOTES.find((item) => item.id === "00000000-0000-4000-8000-000000000101");
  assert.ok(epoxy);
  assert.equal(epoxy.job_slug, "maple-point");
  assert.equal(epoxy.severity, "safety");
  assert.equal(epoxy.hazard_type, "air_quality");
  assert.equal(epoxy.symptoms_reported, true);
  assert.equal(epoxy.stop_work, false);
  assert.equal(epoxy.status, "open");
  assert.match(epoxy.body, /epoxy-coating inside a plastic tent/);
  assert.match(epoxy.body, /HEPA only, no carbon/);
  assert.match(epoxy.body, /headaches/);
  assert.equal(Object.hasOwn(epoxy, "assignee"), false);
  assert.equal(Object.hasOwn(epoxy, "flag_immediately"), false);
  const jobs = [...new Set(DEMO_FIELD_NOTES.map((item) => item.job_slug))].sort();
  assert.deepEqual(jobs, ["cedar-ridge", "maple-point"]);
  assert.doesNotMatch(JSON.stringify(DEMO_FIELD_NOTES), /brown|rossi/i);
});

test("downgrade from safety requires a reason and records who changed it", () => {
  const safety = note({
    id: "s1",
    severity: "safety",
    hazard_type: "air_quality",
    created_at: NOW,
    symptoms_reported: true,
  });
  const rejected = applyNotePatch(safety, { severity: "routine" }, actor, NOW);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, "downgrade_reason_required");

  const blank = applyNotePatch(
    safety,
    { severity: "priority", severity_change_reason: "   " },
    actor,
    NOW,
  );
  assert.equal(blank.ok, false);

  const saved = applyNotePatch(
    safety,
    {
      severity: "routine",
      severity_change_reason: "Ventilation is on and the fumes cleared.",
    },
    actor,
    NOW,
  );
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.note.severity, "routine");
  assert.equal(saved.note.severity_changed_by, actor.userId);
  assert.equal(saved.note.severity_changed_at, NOW);
  assert.equal(saved.note.severity_change_reason, "Ventilation is on and the fumes cleared.");
  assert.deepEqual(dueSafetyAlerts(saved.note, NOW_MS), []);
});

test("raising a note to safety still needs a hazard and does not need a downgrade reason", () => {
  const routine = note({ id: "r1", severity: "routine", created_at: NOW });
  const missing = applyNotePatch(routine, { severity: "safety" }, actor, NOW);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "hazard_required");
  const raised = applyNotePatch(
    routine,
    { severity: "safety", hazard_type: "electrical" },
    actor,
    NOW,
  );
  assert.equal(raised.ok, true);
  if (!raised.ok) return;
  assert.equal(raised.note.severity_change_reason, null);
  assert.deepEqual(dueSafetyAlerts(raised.note, NOW_MS), ["create_foreman"]);
});

test("a safety note alerts the foreman on create", async () => {
  const safety = note({
    id: "alert-safety",
    severity: "safety",
    hazard_type: "air_quality",
    created_at: NOW,
    body: "Fumes in the corridor.",
    symptoms_reported: false,
    stop_work: false,
  });
  assert.deepEqual(dueSafetyAlerts(safety, NOW_MS), ["create_foreman"]);
  assert.match(createAlertSummary(safety) ?? "", /Foreman/);
  const sent: string[] = [];
  const delivered = await deliverDueAlerts({
    note: safety,
    nowMs: NOW_MS,
    contacts: CONTACTS,
    sendEmail: async (message) => {
      sent.push(message.to);
      if (message.to === "pat@crew.example") {
        assert.match(message.subject, /Safety note/);
        assert.match(message.text, /Foreman/);
      }
      return { ok: true };
    },
  });
  assert.deepEqual(sent, ["pat@crew.example", "morgan@crew.example"]);
  assert.equal(delivered.report.foreman, true);
  assert.equal(delivered.report.superintendent, true);
  assert.equal(delivered.report.gc, false);
  assert.equal(delivered.report.in_app, true);
  assert.equal(delivered.report.push, "not_wired");
  assert.equal(delivered.note.foreman_alerted_at, NOW);
  assert.equal(delivered.note.gc_escalated_at, null);

  const parsed = parseFieldNoteCreate(
    {
      job_slug: "maple-point",
      body: "Fumes in the corridor.",
      severity: "safety",
      hazard_type: "air_quality",
      flag_immediately: false,
    },
    actor,
    NOW,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(Object.hasOwn(parsed.note, "flag_immediately"), false);
  assert.equal(Object.hasOwn(parsed.note, "assignee"), false);
  assert.ok(dueSafetyAlerts(parsed.note, NOW_MS).includes("create_foreman"));
});

test("a safety note with no notify email still alerts in the app and does not send mail", async () => {
  const safety = note({
    id: "skip-mail",
    severity: "safety",
    hazard_type: "air_quality",
    created_at: NOW,
  });
  let calls = 0;
  const delivered = await deliverDueAlerts({
    note: safety,
    nowMs: NOW_MS,
    contacts: CONTACTS.map((contact) => ({ ...contact, notify_email: null })),
    sendEmail: async () => {
      calls += 1;
      return { ok: true };
    },
  });
  assert.equal(calls, 0);
  assert.equal(delivered.report.foreman, true);
  assert.equal(delivered.report.in_app, true);
  assert.equal(delivered.report.email, "skipped");
  assert.equal(delivered.report.push, "not_wired");
  assert.equal(delivered.note.foreman_alerted_at, NOW);
});

test("routine and priority notes never alert", async () => {
  const sent: string[] = [];
  for (const severity of ["routine", "priority"] as const) {
    const item = note({
      id: `never-${severity}`,
      severity,
      created_at: NOW,
      stop_work: true,
      symptoms_reported: true,
      hazard_type: "fire",
    });
    assert.deepEqual(dueSafetyAlerts(item, NOW_MS + UNACKED_ESCALATE_MS), []);
    assert.equal(createAlertSummary(item), null);
    const delivered = await deliverDueAlerts({
      note: item,
      nowMs: NOW_MS + UNACKED_ESCALATE_MS + 5_000,
      contacts: CONTACTS,
      sendEmail: async (message) => {
        sent.push(`${severity}:${message.to}`);
        return { ok: true };
      },
    });
    assert.deepEqual(delivered.report.kinds, []);
    assert.equal(delivered.report.foreman, false);
    assert.equal(delivered.report.gc, false);
    assert.equal(delivered.report.in_app, false);
    assert.equal(delivered.note.foreman_alerted_at, null);
    assert.equal(delivered.note.gc_escalated_at, null);
  }
  assert.deepEqual(sent, []);

  const parsed = parseFieldNoteCreate(
    {
      job_slug: "cedar-ridge",
      body: "Boxes are up.",
      severity: "priority",
      stop_work: true,
      symptoms_reported: true,
      flag_immediately: true,
    },
    actor,
    NOW,
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.note.stop_work, false);
  assert.equal(parsed.note.symptoms_reported, false);
  assert.equal(Object.hasOwn(parsed.note, "flag_immediately"), false);
  assert.deepEqual(dueSafetyAlerts(parsed.note, NOW_MS), []);
});

test("stop work or symptoms on a safety note escalate to the GC immediately", async () => {
  for (const flag of ["stop_work", "symptoms_reported"] as const) {
    const safety = note({
      id: `gc-${flag}`,
      severity: "safety",
      hazard_type: "air_quality",
      created_at: NOW,
      stop_work: flag === "stop_work",
      symptoms_reported: flag === "symptoms_reported",
    });
    assert.deepEqual(dueSafetyAlerts(safety, NOW_MS), ["create_foreman", "create_gc"]);
    const sent: string[] = [];
    const delivered = await deliverDueAlerts({
      note: safety,
      nowMs: NOW_MS,
      contacts: CONTACTS,
      sendEmail: async (message) => {
        sent.push(message.to);
        return { ok: true };
      },
    });
    assert.deepEqual(sent, ["pat@crew.example", "morgan@crew.example", "quinn@crew.example"]);
    assert.equal(delivered.report.gc, true);
    assert.equal(delivered.note.gc_escalated_at, NOW);
    assert.match(createAlertSummary(safety) ?? "", /GC is alerted now/);
  }
});

test("unacknowledged safety escalates after 15 minutes and does not repeat", async () => {
  const created = NOW_MS - UNACKED_ESCALATE_MS;
  const safety = note({
    id: "late",
    severity: "safety",
    created_at: new Date(created).toISOString(),
    foreman_alerted_at: new Date(created).toISOString(),
  });
  assert.deepEqual(dueSafetyAlerts(safety, created + UNACKED_ESCALATE_MS - 1), []);
  assert.deepEqual(dueSafetyAlerts(safety, created + UNACKED_ESCALATE_MS), [
    "unacked_realert",
    "unacked_gc",
  ]);

  const sent: string[] = [];
  const first = await deliverDueAlerts({
    note: safety,
    nowMs: created + UNACKED_ESCALATE_MS,
    contacts: CONTACTS,
    sendEmail: async (message) => {
      sent.push(message.to);
      return { ok: true };
    },
  });
  assert.deepEqual(sent, ["pat@crew.example", "morgan@crew.example", "quinn@crew.example"]);
  assert.ok(first.note.unacked_realerted_at);
  assert.ok(first.note.gc_escalated_at);

  const secondSent: string[] = [];
  const second = await deliverDueAlerts({
    note: first.note,
    nowMs: created + UNACKED_ESCALATE_MS + 60_000,
    contacts: CONTACTS,
    sendEmail: async (message) => {
      secondSent.push(message.to);
      return { ok: true };
    },
  });
  assert.deepEqual(secondSent, []);
  assert.deepEqual(second.report.kinds, []);

  const pass = await runEscalationPass({
    notes: [safety],
    nowMs: created + UNACKED_ESCALATE_MS,
    contactsForJob: () => CONTACTS,
    sendEmail: async () => ({ ok: true }),
  });
  assert.equal(pass.updated.length, 1);
  const again = await runEscalationPass({
    notes: pass.updated,
    nowMs: created + UNACKED_ESCALATE_MS + 60_000,
    contactsForJob: () => CONTACTS,
    sendEmail: async () => ({ ok: true }),
  });
  assert.equal(again.updated.length, 0);
});

test("a failed foreman email is not stamped so the timer can retry", async () => {
  const safety = note({
    id: "retry",
    severity: "safety",
    created_at: NOW,
  });
  const failed = await deliverDueAlerts({
    note: safety,
    nowMs: NOW_MS,
    contacts: CONTACTS,
    sendEmail: async () => ({ ok: false }),
  });
  assert.equal(failed.note.foreman_alerted_at, null);
  assert.equal(failed.report.email, "failed");
  assert.equal(failed.report.foreman, true);
  const retried = await deliverDueAlerts({
    note: failed.note,
    nowMs: NOW_MS,
    contacts: CONTACTS,
    sendEmail: async () => ({ ok: true }),
  });
  assert.equal(retried.note.foreman_alerted_at, NOW);
});

test("mitigated safety reminds after 24 hours and does not repeat", async () => {
  const mitigatedAt = NOW_MS - MITIGATED_REMINDER_MS;
  const safety = note({
    id: "mit",
    severity: "safety",
    status: "mitigated",
    created_at: new Date(mitigatedAt - 60_000).toISOString(),
    foreman_alerted_at: new Date(mitigatedAt - 60_000).toISOString(),
    mitigated_at: new Date(mitigatedAt).toISOString(),
  });
  assert.deepEqual(dueSafetyAlerts(safety, mitigatedAt + MITIGATED_REMINDER_MS - 1), []);
  assert.deepEqual(dueSafetyAlerts(safety, mitigatedAt + MITIGATED_REMINDER_MS), [
    "mitigated_reminder",
  ]);
  const sent: string[] = [];
  const first = await deliverDueAlerts({
    note: safety,
    nowMs: mitigatedAt + MITIGATED_REMINDER_MS,
    contacts: CONTACTS,
    sendEmail: async (message) => {
      sent.push(message.to);
      assert.match(message.text, /still not closed/i);
      return { ok: true };
    },
  });
  assert.deepEqual(sent, ["pat@crew.example", "morgan@crew.example"]);
  assert.ok(first.note.mitigated_reminded_at);
  const second = await deliverDueAlerts({
    note: first.note,
    nowMs: mitigatedAt + MITIGATED_REMINDER_MS + 3_600_000,
    contacts: CONTACTS,
    sendEmail: async () => ({ ok: true }),
  });
  assert.deepEqual(second.report.kinds, []);
});

test("closed safety and already-acknowledged safety do not escalate", () => {
  const closed = note({
    id: "closed",
    severity: "safety",
    status: "closed",
    created_at: new Date(NOW_MS - UNACKED_ESCALATE_MS * 4).toISOString(),
    stop_work: true,
  });
  assert.deepEqual(dueSafetyAlerts(closed, NOW_MS), []);
  const acknowledged = note({
    id: "ack",
    severity: "safety",
    status: "acknowledged",
    created_at: new Date(NOW_MS - UNACKED_ESCALATE_MS * 2).toISOString(),
    foreman_alerted_at: NOW,
  });
  assert.deepEqual(dueSafetyAlerts(acknowledged, NOW_MS), []);
});

test("filters and search keep non-closed safety notes", () => {
  const notes = [
    note({
      id: "epoxy",
      severity: "safety",
      status: "open",
      created_at: "2026-10-08T14:10:00.000Z",
      room: "733",
      body: "Epoxy fumes in the tent.",
    }),
    note({
      id: "ack-safety",
      severity: "safety",
      status: "acknowledged",
      created_at: "2026-10-07T12:00:00.000Z",
      room: "Stair",
      body: "Missing clip.",
    }),
    note({
      id: "fixtures",
      severity: "priority",
      created_at: "2026-10-09T16:00:00.000Z",
      room: "102",
      body: "Light fixtures are on site.",
    }),
    note({
      id: "devices",
      severity: "routine",
      created_at: "2026-10-09T17:00:00.000Z",
      room: "101",
      body: "Hung the devices.",
    }),
    note({
      id: "closed-wet",
      severity: "safety",
      status: "closed",
      created_at: "2026-10-09T18:30:00.000Z",
      room: "East",
      body: "Wet floor is dry.",
    }),
  ];
  const bySearch = visibleFieldNotes(notes, { query: "fixtures" }).map((item) => item.id);
  assert.deepEqual(bySearch, ["epoxy", "ack-safety", "fixtures"]);
  const byRoom = visibleFieldNotes(notes, { room: "102" }).map((item) => item.id);
  assert.ok(byRoom.includes("epoxy"));
  assert.ok(byRoom.includes("ack-safety"));
  assert.ok(byRoom.includes("fixtures"));
  assert.equal(byRoom.includes("devices"), false);
  const bySeverity = visibleFieldNotes(notes, { severity: "routine" }).map((item) => item.id);
  assert.ok(bySeverity.includes("epoxy"));
  assert.ok(bySeverity.includes("devices"));
  assert.equal(bySeverity.includes("fixtures"), false);
  const byStatus = visibleFieldNotes(notes, { status: "closed" }).map((item) => item.id);
  assert.ok(byStatus.includes("epoxy"));
  assert.ok(byStatus.includes("ack-safety"));
  assert.ok(byStatus.includes("closed-wet"));
  assert.equal(byStatus.includes("devices"), false);
});

test("open safety banner counts only open safety notes", () => {
  const notes = [
    note({ id: "a", severity: "safety", status: "open", created_at: NOW }),
    note({ id: "b", severity: "safety", status: "open", created_at: NOW }),
    note({ id: "c", severity: "safety", status: "acknowledged", created_at: NOW }),
    note({ id: "d", severity: "safety", status: "closed", created_at: NOW }),
    note({ id: "e", severity: "priority", created_at: NOW }),
  ];
  assert.deepEqual(openSafetyBanner(notes), {
    count: 2,
    text: "2 safety notes are still open.",
  });
  assert.equal(openSafetyBanner([notes[2]]), null);
});

test("migration defaults existing notes to routine and open and blocks a silent downgrade", () => {
  const sql = readFileSync(
    "supabase/migrations/20261009130000_field_notes_severity.sql",
    "utf8",
  );
  assert.match(sql, /severity text not null default 'routine'/);
  assert.match(sql, /status text not null default 'open'/);
  assert.match(sql, /downgrade_from_safety_requires_reason/);
  assert.match(sql, /severity_change_reason/);
  assert.match(sql, /foreman_alerted_at/);
  assert.match(sql, /gc_escalated_at/);
  assert.match(sql, /unacked_realerted_at/);
  assert.match(sql, /mitigated_reminded_at/);
  assert.doesNotMatch(sql, /flag_immediately/);
  assert.doesNotMatch(sql, /assignee/);
  assert.doesNotMatch(sql, /brown|rossi/i);

  const route = readFileSync("app/api/field-notes/[id]/route.ts", "utf8");
  assert.match(route, /updateFieldNote/);
  const escalate = readFileSync("app/api/field-notes/escalate/route.ts", "utf8");
  assert.match(escalate, /authorizeCronHeaders/);
  assert.match(escalate, /cronSecretConfigured/);
  assert.doesNotMatch(escalate, /process\.env/);
  const feed = readFileSync("components/FieldNoteFeed.tsx", "utf8");
  assert.match(feed, /Hear this/);
  assert.doesNotMatch(feed, /flag_immediately|flag immediately/i);
  assert.doesNotMatch(feed, /assignee/i);
});

test("vercel cron stays once a day, like the existing weekly share cron", () => {
  const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as {
    crons: { path: string; schedule: string }[];
  };
  const weekly = vercel.crons.find((item) => item.path === "/api/share/weekly-refresh");
  const safety = vercel.crons.find((item) => item.path === "/api/field-notes/escalate");
  assert.equal(weekly?.schedule, "0 12 * * 1");
  assert.equal(safety?.schedule, "0 12 * * *");
  assert.equal(vercel.crons.length, 2);
  for (const cron of vercel.crons) {
    assert.match(cron.schedule, /^\d+ \d+ /);
    assert.doesNotMatch(cron.schedule, /\*\//);
  }
});

test("opening the feed or saving a note escalates due safety notes", async (t) => {
  if (isFieldNoteTableConfigured()) {
    t.skip("service role is set; this check stays off the live table");
    return;
  }
  const start = new Date(Date.now() - 16 * 60 * 1000);
  const maple = await createFieldNote({
    raw: {
      job_slug: "maple-point",
      body: "Open trench at the east entry.",
      severity: "safety",
      hazard_type: "fall",
    },
    actor,
    now: start,
  });
  assert.equal(maple.ok, true);
  if (!maple.ok) return;
  assert.equal(maple.note.unacked_realerted_at, null);

  const feed = await listFieldNotes("maple-point");
  assert.equal(feed.ok, true);
  if (!feed.ok) return;
  const mapleNote = feed.notes.find((item) => item.id === maple.note.id);
  assert.ok(mapleNote?.unacked_realerted_at);
  assert.ok(mapleNote?.gc_escalated_at);
  const again = await listFieldNotes("maple-point");
  assert.equal(again.ok, true);
  if (!again.ok) return;
  const mapleAgain = again.notes.find((item) => item.id === maple.note.id);
  assert.equal(mapleAgain?.unacked_realerted_at, mapleNote?.unacked_realerted_at);
  assert.equal(mapleAgain?.gc_escalated_at, mapleNote?.gc_escalated_at);

  const cedar = await createFieldNote({
    raw: {
      job_slug: "cedar-ridge",
      body: "Loose rail at stair B.",
      severity: "safety",
      hazard_type: "fall",
    },
    actor,
    now: start,
  });
  assert.equal(cedar.ok, true);
  if (!cedar.ok) return;
  assert.equal(cedar.note.unacked_realerted_at, null);
  const routine = await createFieldNote({
    raw: {
      job_slug: "cedar-ridge",
      body: "Device boxes are up in waiting 200.",
      severity: "routine",
    },
    actor,
    now: new Date(),
  });
  assert.equal(routine.ok, true);
  const saved = await listNotesForEscalation();
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const cedarNote = saved.notes.find((item) => item.id === cedar.note.id);
  assert.ok(cedarNote?.unacked_realerted_at);
  assert.ok(cedarNote?.gc_escalated_at);
});
