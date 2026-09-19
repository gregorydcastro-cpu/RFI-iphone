import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFieldRoleName } from "./auth.ts";
import {
  canInviteCrew,
  createInviteRequestBody,
  INVITE_CREATE_PATH,
  parseInviteRole,
  parseOptionalInviteeEmail,
  resolveInviteDisplayUrl,
} from "./inviteRole.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("invite UI calls Repo Eng POST /api/invites", () => {
  assert.equal(INVITE_CREATE_PATH, "/api/invites");
  assert.equal(forbidden.test(INVITE_CREATE_PATH), false);
});

test("parseFieldRoleName keeps puller/full and defaults unknown to viewer", () => {
  assert.equal(parseFieldRoleName("puller"), "puller");
  assert.equal(parseFieldRoleName("full"), "full");
  assert.equal(parseFieldRoleName("viewer"), "viewer");
  assert.equal(parseFieldRoleName("admin"), "viewer");
  assert.equal(parseFieldRoleName(undefined), "viewer");
});

test("parseInviteRole accepts only viewer and full", () => {
  assert.equal(parseInviteRole("viewer"), "viewer");
  assert.equal(parseInviteRole("full"), "full");
  assert.equal(parseInviteRole("puller"), null);
  assert.equal(parseInviteRole("paid"), null);
  assert.equal(parseInviteRole("free"), null);
  assert.equal(parseInviteRole(""), null);
  assert.equal(parseInviteRole(null), null);
  assert.equal(parseInviteRole({ role: "viewer" }), null);
});

test("optional invitee email is normalized or rejected", () => {
  assert.equal(parseOptionalInviteeEmail(""), null);
  assert.equal(parseOptionalInviteeEmail("  "), null);
  assert.equal(parseOptionalInviteeEmail(undefined), null);
  assert.equal(
    parseOptionalInviteeEmail("Pat.Nguyen@crew.example"),
    "pat.nguyen@crew.example",
  );
  assert.deepEqual(parseOptionalInviteeEmail("not-an-email"), {
    error: "invitee_email must be a valid email",
  });
  assert.deepEqual(parseOptionalInviteeEmail(12), {
    error: "invitee_email must be a string",
  });
});

test("createInviteRequestBody matches POST /api/invites", () => {
  assert.deepEqual(createInviteRequestBody({ role: "viewer" }), {
    role: "viewer",
  });
  assert.deepEqual(
    createInviteRequestBody({
      role: "full",
      invitee_email: "Alex.Rivera@crew.example",
    }),
    { role: "full", invitee_email: "alex.rivera@crew.example" },
  );
  assert.deepEqual(createInviteRequestBody({ role: "puller" }), {
    error: "role must be viewer or full",
  });
  const minted = createInviteRequestBody({
    role: "viewer",
    invitee_email: "  ",
  });
  assert.ok(!("error" in minted));
  assert.deepEqual(Object.keys(minted), ["role"]);
});

test("GC/foreman (puller) and full can invite; viewers cannot", () => {
  assert.equal(canInviteCrew("puller"), true);
  assert.equal(canInviteCrew("full"), true);
  assert.equal(canInviteCrew("viewer"), false);
  assert.equal(canInviteCrew(null), false);
});

test("invite display URL stays path-or-absolute without inventing a token", () => {
  assert.equal(
    resolveInviteDisplayUrl("/invite/opaque-token", "https://www.gcfieldlog.com"),
    "https://www.gcfieldlog.com/invite/opaque-token",
  );
  assert.equal(
    resolveInviteDisplayUrl("https://www.gcfieldlog.com/invite/opaque-token"),
    "https://www.gcfieldlog.com/invite/opaque-token",
  );
  assert.equal(resolveInviteDisplayUrl(""), "");
});

test("invite helper copy is Maple Point / fictional only", () => {
  const blob = [
    canInviteCrew.toString(),
    createInviteRequestBody.toString(),
    "Maple Point Medical Office",
    "Pat Nguyen",
  ].join("\n");
  assert.equal(forbidden.test(blob), false);
});
