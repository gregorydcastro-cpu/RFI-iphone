/**
 * Invite UI contract helpers.
 *
 * Repo Eng owns persistence (`invite_tokens` on Supabase via #43), mint/redeem
 * APIs, landing-page redeem, and server viewer enforcement.
 *
 * This package only builds the Account Invite picker and POSTs to their
 * mint route: POST /api/invites. Do not invent a second API or guess role
 * from the URL path.
 */

export const INVITE_ROLES = ["viewer", "full"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

/** Repo Eng mint endpoint on #43. UI calls this; this package does not implement it. */
export const INVITE_CREATE_PATH = "/api/invites";

export type CreateInviteBody = {
  role: InviteRole;
  invitee_email?: string;
};

/** Locked mint response. Extra #43 fields (storage, single_use, …) are ignored. */
export type CreateInviteSuccess = {
  ok: true;
  url: string;
  token: string;
  expires_at: string;
  role: InviteRole;
  invitee_email?: string | null;
};

export type CreateInviteFailure = {
  ok: false;
  error?: string;
};

export function parseInviteRole(value: unknown): InviteRole | null {
  return value === "viewer" || value === "full" ? value : null;
}

/** Same rule as Repo Eng `normalizeInviteeEmail`: trim, lower, must include @. */
export function parseOptionalInviteeEmail(
  value: unknown,
): string | null | { error: string } {
  if (value == null) return null;
  if (typeof value !== "string") {
    return { error: "invitee_email must be a string" };
  }
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!email.includes("@")) {
    return { error: "invitee_email must be a valid email" };
  }
  return email;
}

/** GC / foreman (puller) and invited full crew see the Invite button. */
export function canInviteCrew(role: string | null | undefined): boolean {
  return role === "puller" || role === "full";
}

export function fieldRoleLabel(role: string | null | undefined): string {
  if (role === "puller") return "puller";
  if (role === "full") return "full";
  return "view only";
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
