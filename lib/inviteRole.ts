/**
 * Invite role contract + client gating helpers.
 *
 * Repo Eng owns `invite_tokens` persistence and:
 *   POST /api/invites
 *   GET  /api/invites/[token]
 *   POST /api/invites/[token]/redeem
 *   Landing /invite/[token]
 *
 * Do not mint tokens or guess role from the URL path. The opaque token is
 * looked up server-side. This module only validates the public role names
 * and hides write/pull controls for viewer sessions.
 */

import type { PackAction } from "./pack";

export const INVITE_ROLES = ["viewer", "full"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Repo Eng mint endpoint. UI calls this; this package does not implement it. */
export const INVITE_CREATE_PATH = "/api/invites";

export type CreateInviteBody = {
  role: InviteRole;
  invitee_email?: string;
};

export type CreateInviteSuccess = {
  ok: true;
  url: string;
  token: string;
  expires_at: string;
  role: InviteRole;
};

export type CreateInviteFailure = {
  ok: false;
  error?: string;
};

const WRITE_ACTION_IDS = new Set(["generate-rfi", "order-materials"]);

export function parseInviteRole(value: unknown): InviteRole | null {
  return value === "viewer" || value === "full" ? value : null;
}

export function parseOptionalInviteeEmail(
  value: unknown,
): string | null | { error: string } {
  if (value == null) return null;
  if (typeof value !== "string") {
    return { error: "invitee_email must be a string" };
  }
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return { error: "invitee_email must be a valid email" };
  }
  return email;
}

/** GC / foreman (stub puller) and invited full crew may mint invite links. */
export function canInviteCrew(role: string | null | undefined): boolean {
  return role === "puller" || role === "full";
}

/** Markup, Create RFI, Generate RFI, Order materials. */
export function canUseFieldWriteTools(role: string | null | undefined): boolean {
  return role === "puller" || role === "full";
}

export function isViewerSession(role: string | null | undefined): boolean {
  return !canUseFieldWriteTools(role);
}

export function fieldRoleLabel(role: string | null | undefined): string {
  if (role === "puller") return "puller";
  if (role === "full") return "full";
  return "view only";
}

export function isWriteOrPullAction(action: PackAction): boolean {
  const id = action.id.toLowerCase();
  const label = action.label.toLowerCase();
  if (WRITE_ACTION_IDS.has(id)) return true;
  if (id.includes("pull") || label.includes("pull")) return true;
  if (id.includes("print") || label.includes("print")) return true;
  if (id.includes("download") || label.includes("download")) return true;
  if (id.includes("markup") || label.includes("markup")) return true;
  if (id.includes("request-print") || label.includes("request print")) {
    return true;
  }
  return false;
}

/** Viewers keep sheets + red room highlight; hide write / pull / print. */
export function filterPackActionsForRole(
  actions: PackAction[],
  role: string | null | undefined,
): PackAction[] {
  if (canUseFieldWriteTools(role)) return actions;
  return actions.filter((action) => !isWriteOrPullAction(action));
}

/** Display helper: API may return an absolute URL or `/invite/<token>`. */
export function resolveInviteDisplayUrl(url: string, origin?: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = (origin ?? "").replace(/\/$/, "");
  if (trimmed.startsWith("/")) return base ? `${base}${trimmed}` : trimmed;
  return base ? `${base}/${trimmed}` : trimmed;
}

export function createInviteRequestBody(input: {
  role: unknown;
  invitee_email?: unknown;
}): CreateInviteBody | { error: string } {
  const role = parseInviteRole(input.role);
  if (!role) return { error: "role must be viewer or full" };
  const email = parseOptionalInviteeEmail(input.invitee_email);
  if (email && typeof email === "object" && "error" in email) return email;
  const body: CreateInviteBody = { role };
  if (typeof email === "string") body.invitee_email = email;
  return body;
}
