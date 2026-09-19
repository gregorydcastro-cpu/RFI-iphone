import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asInviteTokenRow,
  canMintInvites,
  canWriteFieldLog,
  emailsMatch,
  fieldRoleFromInviteRole,
  generateInviteToken,
  invitePublicUrl,
  inviteRoleFromFieldRole,
  inviteStatus,
  isInviteRole,
  isViewerReadOnly,
  isWritePackAction,
  latestRedeemedInviteRole,
  mintInviteRecord,
  normalizeInviteeEmail,
  parseInviteRole,
  redeemInviteRecord,
  resolveInviteExpiry,
} from "./invites.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("invite helpers stay Maple Point / fictional only", () => {
  const blob = JSON.stringify({
    email: normalizeInviteeEmail("  Pat.Nguyen@Crew.Example "),
    url: invitePublicUrl("https://www.gcfieldlog.com", "tok_demo"),
    role: parseInviteRole("full"),
  });
  assert.equal(forbidden.test(blob), false);
});

test("invite role lock is viewer | full and stays on the stub session", () => {
  assert.equal(isInviteRole("viewer"), true);
  assert.equal(isInviteRole("full"), true);
  assert.equal(isInviteRole("puller"), false);
  assert.equal(parseInviteRole("full"), "full");
  assert.equal(parseInviteRole("puller"), "full");
  assert.equal(parseInviteRole("viewer"), "viewer");
  assert.equal(parseInviteRole("nope"), null);
  assert.equal(fieldRoleFromInviteRole("full"), "full");
  assert.equal(fieldRoleFromInviteRole("viewer"), "viewer");
  assert.equal(inviteRoleFromFieldRole("puller"), "full");
  assert.equal(inviteRoleFromFieldRole("full"), "full");
  assert.equal(canMintInvites("puller"), true);
  assert.equal(canMintInvites("full"), true);
  assert.equal(canMintInvites("viewer"), false);
  assert.equal(canWriteFieldLog("puller"), true);
  assert.equal(canWriteFieldLog("full"), true);
  assert.equal(isViewerReadOnly("viewer"), true);
  assert.equal(isViewerReadOnly("puller"), false);
  assert.equal(isViewerReadOnly("full"), false);
});

test("normalizeInviteeEmail trims and lowercases", () => {
  assert.equal(normalizeInviteeEmail("  Foreman@Crew.Example "), "foreman@crew.example");
  assert.equal(normalizeInviteeEmail(""), null);
  assert.equal(normalizeInviteeEmail("not-an-email"), null);
  assert.equal(normalizeInviteeEmail(null), null);
  assert.equal(emailsMatch("foreman@crew.example", "  Foreman@Crew.Example "), true);
  assert.equal(emailsMatch(null, "anyone@crew.example"), true);
  assert.equal(emailsMatch("foreman@crew.example", "other@crew.example"), false);
});

test("inviteStatus is single-use and expiry-aware", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");
  assert.equal(inviteStatus(null, now), "not_found");
  assert.equal(
    inviteStatus(
      { expires_at: "2026-09-19T12:00:00.000Z", used_at: null },
      now,
    ),
    "valid",
  );
  assert.equal(
    inviteStatus(
      { expires_at: "2026-09-17T12:00:00.000Z", used_at: null },
      now,
    ),
    "expired",
  );
  assert.equal(
    inviteStatus(
      {
        expires_at: "2026-09-19T12:00:00.000Z",
        used_at: "2026-09-18T11:00:00.000Z",
      },
      now,
    ),
    "used",
  );
});

test("generateInviteToken is URL-safe and unique", () => {
  const a = generateInviteToken();
  const b = generateInviteToken();
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.ok(a.length >= 24);
  assert.notEqual(a, b);
  assert.equal(invitePublicUrl("https://www.gcfieldlog.com/", a), `https://www.gcfieldlog.com/invite/${a}`);
});

test("memory mint + redeem is single-use and binds invitee email", () => {
  const minted = mintInviteRecord({
    role: "viewer",
    createdBy: "stub:foreman",
    inviteeEmail: "  Alex.Rivera@Crew.Example ",
    token: "tok_viewer_demo",
    now: new Date("2026-09-18T12:00:00.000Z"),
  });
  assert.equal(minted.role, "viewer");
  assert.equal(minted.invitee_email, "alex.rivera@crew.example");
  assert.equal(minted.used_at, null);
  assert.equal(inviteStatus(minted, new Date("2026-09-18T12:00:00.000Z")), "valid");

  const mismatch = redeemInviteRecord({
    row: minted,
    email: "other@crew.example",
    now: new Date("2026-09-18T12:05:00.000Z"),
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.status, "email_mismatch");

  const redeemed = redeemInviteRecord({
    row: minted,
    email: "alex.rivera@crew.example",
    now: new Date("2026-09-18T12:05:00.000Z"),
  });
  assert.equal(redeemed.ok, true);
  if (redeemed.ok) {
    assert.equal(redeemed.row.used_at, "2026-09-18T12:05:00.000Z");
    assert.equal(fieldRoleFromInviteRole(redeemed.row.role), "viewer");
    const again = redeemInviteRecord({
      row: redeemed.row,
      email: "alex.rivera@crew.example",
      now: new Date("2026-09-18T12:06:00.000Z"),
    });
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.status, "used");
    assert.equal(
      latestRedeemedInviteRole([redeemed.row], "alex.rivera@crew.example"),
      "viewer",
    );
  }
});

test("full invite stays full on the stub session", () => {
  const minted = mintInviteRecord({
    role: "full",
    createdBy: "stub:foreman",
    token: "tok_full_demo",
    now: new Date("2026-09-18T12:00:00.000Z"),
  });
  const redeemed = redeemInviteRecord({
    row: minted,
    email: "jordan.hale@crew.example",
    now: new Date("2026-09-18T12:01:00.000Z"),
  });
  assert.equal(redeemed.ok, true);
  if (redeemed.ok) {
    assert.equal(redeemed.row.invitee_email, "jordan.hale@crew.example");
    assert.equal(fieldRoleFromInviteRole(redeemed.row.role), "full");
  }
});

test("expired invite cannot redeem", () => {
  const minted = mintInviteRecord({
    role: "full",
    createdBy: "stub:foreman",
    expiresAt: "2026-09-18T12:00:01.000Z",
    token: "tok_expired",
    now: new Date("2026-09-18T12:00:00.000Z"),
  });
  assert.equal(
    inviteStatus(minted, new Date("2026-09-18T12:00:02.000Z")),
    "expired",
  );
  const redeemed = redeemInviteRecord({
    row: minted,
    email: "casey.brooks@crew.example",
    now: new Date("2026-09-18T12:00:02.000Z"),
  });
  assert.equal(redeemed.ok, false);
  if (!redeemed.ok) assert.equal(redeemed.status, "expired");
});

test("asInviteTokenRow and write-action filter", () => {
  const row = asInviteTokenRow({
    id: "00000000-0000-4000-8000-000000000001",
    token: "abc",
    role: "viewer",
    created_by: "stub:foreman",
    invitee_email: "  Sam.Ortiz@Crew.Example ",
    expires_at: "2026-09-25T00:00:00.000Z",
    used_at: null,
    created_at: "2026-09-18T00:00:00.000Z",
  });
  assert.equal(row?.invitee_email, "sam.ortiz@crew.example");
  assert.equal(isWritePackAction("generate-rfi"), true);
  assert.equal(isWritePackAction("order-materials"), true);
  assert.equal(isWritePackAction("request-print", "Request print"), true);
  assert.equal(isWritePackAction("takeoff", "Takeoff counts"), false);
  const expiry = resolveInviteExpiry({
    now: new Date("2026-09-18T00:00:00.000Z"),
    expiresInMs: 7 * 24 * 60 * 60 * 1000,
  });
  assert.equal(expiry.toISOString(), "2026-09-25T00:00:00.000Z");
});
