/**
 * Safety-note alerts. Reuses sendFieldEmail (Resend). No new env vars.
 * Push is not on the current notify path.
 * Missing notify_email or RESEND_API_KEY skips mail and leaves the in-app banner.
 */

import { sendFieldEmail } from "./fieldEmail.ts";
import {
  HAZARD_LABEL,
  audiencesForAlerts,
  createAlertSummary,
  dueSafetyAlerts,
  fieldNoteJobName,
  rolesForAlert,
  type AlertRole,
  type DueAlertKind,
  type FieldNote,
} from "./fieldNotes.ts";

export type AlertContact = {
  role: AlertRole;
  name: string;
  /** Existing notify_email. Null skips mail. */
  notify_email: string | null;
};

export type SendSafetyEmail = (input: {
  to: string;
  subject: string;
  text: string;
}) => Promise<{ ok: boolean }>;

export type SafetyAlertReport = {
  in_app: boolean;
  foreman: boolean;
  superintendent: boolean;
  gc: boolean;
  email: "sent" | "skipped" | "failed" | "none";
  push: "not_wired";
  summary: string | null;
  kinds: DueAlertKind[];
};

/**
 * Named demo contacts. notify_email stays empty until an existing
 * notify_email row is filled in. Assignees on the note stay empty.
 */
export const DEMO_ALERT_CONTACTS: Record<string, AlertContact[]> = {
  "maple-point": [
    { role: "foreman", name: "Pat Nguyen", notify_email: null },
    { role: "superintendent", name: "Morgan Ellis", notify_email: null },
    { role: "gc", name: "Quinn Adler", notify_email: null },
  ],
  "cedar-ridge": [
    { role: "foreman", name: "Riley Cho", notify_email: null },
    { role: "superintendent", name: "Avery Singh", notify_email: null },
    { role: "gc", name: "Quinn Adler", notify_email: null },
  ],
};

export function alertContactsForJob(jobSlug: string): AlertContact[] {
  const contacts = DEMO_ALERT_CONTACTS[jobSlug];
  if (!contacts) return [];
  return contacts.map((contact) => ({ ...contact }));
}

export function safetyAlertMessage(input: {
  note: FieldNote;
  jobName: string;
  role: AlertRole;
  kinds: readonly DueAlertKind[];
}): { subject: string; text: string } {
  const { note, jobName, role, kinds } = input;
  const reminder = kinds.includes("mitigated_reminder");
  const realert = kinds.includes("unacked_realert") || kinds.includes("unacked_gc");
  const subject = reminder
    ? `Safety note still not closed — ${jobName}`
    : realert
      ? `Safety note still open — ${jobName}`
      : `Safety note — ${jobName}`;
  const who =
    role === "gc"
      ? "GC: this safety note needs you."
      : role === "superintendent"
        ? "Superintendent: safety note on your job."
        : "Foreman: safety note on your job.";
  const where = [note.room, note.location].filter(Boolean).join(", ");
  const lines = [
    who,
    jobName,
    where,
    note.hazard_type ? HAZARD_LABEL[note.hazard_type] : "",
    note.body,
    note.symptoms_reported ? "People reported symptoms." : "",
    note.stop_work ? "Stop work." : "",
    realert ? "Still open. Nobody has acknowledged it." : "",
    reminder ? "Mitigated, and still not closed." : "",
    `From ${note.author_name}.`,
  ].filter((line) => line.length > 0);
  return { subject, text: lines.join("\n") };
}

function stampKinds(note: FieldNote, kinds: readonly DueAlertKind[], nowIso: string): FieldNote {
  const next: FieldNote = { ...note, updated_at: nowIso };
  if (kinds.includes("create_foreman") && !next.foreman_alerted_at) {
    next.foreman_alerted_at = nowIso;
  }
  if (
    (kinds.includes("create_gc") || kinds.includes("unacked_gc")) &&
    !next.gc_escalated_at
  ) {
    next.gc_escalated_at = nowIso;
  }
  if (kinds.includes("unacked_realert") && !next.unacked_realerted_at) {
    next.unacked_realerted_at = nowIso;
  }
  if (kinds.includes("mitigated_reminder") && !next.mitigated_reminded_at) {
    next.mitigated_reminded_at = nowIso;
  }
  return next;
}

async function defaultSend(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ ok: boolean }> {
  const result = await sendFieldEmail(input);
  return { ok: result.ok };
}

export async function deliverDueAlerts(input: {
  note: FieldNote;
  nowMs: number;
  jobName?: string;
  contacts?: AlertContact[];
  sendEmail?: SendSafetyEmail;
}): Promise<{ note: FieldNote; report: SafetyAlertReport }> {
  const kinds = dueSafetyAlerts(input.note, input.nowMs);
  const roles = audiencesForAlerts(kinds);
  const summary = kinds.includes("create_foreman")
    ? createAlertSummary(input.note)
    : kinds.includes("unacked_realert")
      ? "Still open. Foreman and the superintendent are alerted again."
      : kinds.includes("mitigated_reminder")
        ? "This safety note is mitigated and still not closed."
        : createAlertSummary(input.note);
  if (kinds.length === 0) {
    return {
      note: input.note,
      report: {
        in_app: false,
        foreman: false,
        superintendent: false,
        gc: false,
        email: "none",
        push: "not_wired",
        summary: null,
        kinds: [],
      },
    };
  }

  const contacts = input.contacts ?? alertContactsForJob(input.note.job_slug);
  const jobName = input.jobName ?? fieldNoteJobName(input.note.job_slug);
  const send = input.sendEmail ?? defaultSend;
  const nowIso = new Date(input.nowMs).toISOString();
  const sent = new Set<AlertRole>();
  const skipped = new Set<AlertRole>();
  const failed = new Set<AlertRole>();

  for (const role of roles) {
    const contact = contacts.find((item) => item.role === role);
    const email = contact?.notify_email?.trim() || "";
    if (!email) {
      skipped.add(role);
      continue;
    }
    const roleKinds = kinds.filter((kind) => rolesForAlert(kind).includes(role));
    const message = safetyAlertMessage({
      note: input.note,
      jobName,
      role,
      kinds: roleKinds,
    });
    try {
      const result = await send({ to: email, subject: message.subject, text: message.text });
      if (result.ok) sent.add(role);
      else failed.add(role);
    } catch {
      failed.add(role);
    }
  }

  const stamped = kinds.filter((kind) =>
    rolesForAlert(kind).every((role) => sent.has(role) || skipped.has(role)),
  );
  const email =
    failed.size > 0 ? "failed" : sent.size > 0 ? "sent" : skipped.size > 0 ? "skipped" : "none";

  return {
    note: stampKinds(input.note, stamped, nowIso),
    report: {
      in_app: true,
      foreman: roles.includes("foreman"),
      superintendent: roles.includes("superintendent"),
      gc: roles.includes("gc"),
      email,
      push: "not_wired",
      summary,
      kinds,
    },
  };
}

export async function runEscalationPass(input: {
  notes: readonly FieldNote[];
  nowMs: number;
  contactsForJob?: (jobSlug: string) => AlertContact[];
  sendEmail?: SendSafetyEmail;
}): Promise<{
  updated: FieldNote[];
  sent: number;
  skipped: number;
  failed: number;
}> {
  const updated: FieldNote[] = [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const note of input.notes) {
    const delivered = await deliverDueAlerts({
      note,
      nowMs: input.nowMs,
      contacts: input.contactsForJob
        ? input.contactsForJob(note.job_slug)
        : undefined,
      sendEmail: input.sendEmail,
    });
    if (delivered.report.kinds.length === 0) continue;
    if (delivered.report.email === "sent") sent += 1;
    else if (delivered.report.email === "failed") failed += 1;
    else if (delivered.report.email === "skipped") skipped += 1;
    const changed =
      delivered.note.foreman_alerted_at !== note.foreman_alerted_at ||
      delivered.note.gc_escalated_at !== note.gc_escalated_at ||
      delivered.note.unacked_realerted_at !== note.unacked_realerted_at ||
      delivered.note.mitigated_reminded_at !== note.mitigated_reminded_at;
    if (changed) updated.push(delivered.note);
  }
  return { updated, sent, skipped, failed };
}
