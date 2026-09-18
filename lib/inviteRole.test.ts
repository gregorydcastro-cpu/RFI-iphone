import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFieldRoleName } from "./auth.ts";
import {
  canInviteCrew,
  canUseFieldWriteTools,
  createInviteRequestBody,
  filterPackActionsForRole,
  INVITE_CREATE_PATH,
  isViewerSession,
  isWriteOrPullAction,
  parseInviteRole,
  parseOptionalInviteeEmail,
  resolveInviteDisplayUrl,
} from "./inviteRole.ts";
import type { PackAction } from "./pack.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("invite contract names stay on invite_tokens / /api/invites", () => {
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
});

test("GC/foreman (puller) and full can invite; viewers cannot", () => {
  assert.equal(canInviteCrew("puller"), true);
  assert.equal(canInviteCrew("full"), true);
  assert.equal(canInviteCrew("viewer"), false);
  assert.equal(canInviteCrew(null), false);
});

test("viewer sessions cannot use write or pull tools", () => {
  assert.equal(canUseFieldWriteTools("puller"), true);
  assert.equal(canUseFieldWriteTools("full"), true);
  assert.equal(canUseFieldWriteTools("viewer"), false);
  assert.equal(canUseFieldWriteTools(undefined), false);
  assert.equal(isViewerSession("viewer"), true);
  assert.equal(isViewerSession("full"), false);
  assert.equal(isViewerSession(null), true);
});

test("filterPackActionsForRole hides request-print / pull / markup / drafts", () => {
  const actions: PackAction[] = [
    { id: "generate-rfi", label: "Generate RFI" },
    { id: "order-materials", label: "Order materials" },
    { id: "request-print", label: "Request print" },
    { id: "refresh-pull", label: "Pull pack" },
    { id: "markup-tools", label: "Markup" },
    { id: "open-sheet", label: "Open sheet" },
  ];

  assert.equal(isWriteOrPullAction(actions[0]!), true);
  assert.deepEqual(
    filterPackActionsForRole(actions, "viewer").map((action) => action.id),
    ["open-sheet"],
  );
  assert.deepEqual(
    filterPackActionsForRole(actions, "full").map((action) => action.id),
    actions.map((action) => action.id),
  );
  assert.deepEqual(
    filterPackActionsForRole(actions, "puller").map((action) => action.id),
    actions.map((action) => action.id),
  );
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
    filterPackActionsForRole.toString(),
    "Maple Point Medical Office",
    "Pat Nguyen",
  ].join("\n");
  assert.equal(forbidden.test(blob), false);
});
