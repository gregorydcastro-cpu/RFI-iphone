/**
 * In-app crew invite links.
 *
 * Table: public.invite_tokens (NOT trial_link_tokens).
 * Role baked into the token: `viewer` | `full`.
 * `full` maps to the existing stub session role `puller`.
 * Tokens are single-use: redeem sets used_at.
 */

import { randomBytes } from "node:crypto";
import type { FieldRoleName } from "./auth";
import {
  INVITE_ROLES,
  type InviteRole,
  type InviteTokenRow,
} from "./schema";

export type { InviteRole, InviteTokenRow };

export type InviteStatus = "valid" | "expired" | "used" | "not_found";

export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_INVITE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export function isInviteRole(value: unknown): value is InviteRole {
  return value === "viewer" || value === "full";
}

export function parseInviteRole(value: unknown): InviteRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "full" || normalized === "puller" || normalized === "crew") {
    return "full";
  }
  if (normalized === "viewer" || normalized === "view" || normalized === "readonly") {
    return "viewer";
  }
  return null;
}

/** Session role stored on the stub cookie. `full` invite → `puller`. */
export function fieldRoleFromInviteRole(role: InviteRole): FieldRoleName {
  return role === "full" ? "puller" : "viewer";
}

export function inviteRoleFromFieldRole(
  role: FieldRoleName | null | undefined,
): InviteRole {
  return role === "puller" ? "full" : "viewer";
}

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function normalizeInviteeEmail(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return email.includes("@") ? email : null;
}

export function invitePublicPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

export function invitePublicUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${invitePublicPath(token)}`;
}

export function inviteStatus(
  row: Pick<InviteTokenRow, "expires_at" | "used_at"> | null,
  now: Date = new Date(),
): InviteStatus {
  if (!row) return "not_found";
  if (row.used_at) return "used";
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) return "expired";
  return "valid";
}

export function canMintInvites(role: string | null | undefined): boolean {
  return role === "puller";
}

export function canWriteFieldLog(role: string | null | undefined): boolean {
  return role === "puller";
}

export function isViewerReadOnly(role: string | null | undefined): boolean {
  return role !== "puller";
}

export function isWritePackAction(actionId: string, label = ""): boolean {
  const haystack = `${actionId} ${label}`.toLowerCase();
  return (
    haystack.includes("generate-rfi") ||
    haystack.includes("order-materials") ||
    haystack.includes("request-print") ||
    haystack.includes("print") ||
    haystack.includes("markup") ||
    haystack.includes("pull") ||
    haystack.includes("download")
  );
}

export function resolveInviteExpiry(input: {
  expiresAt?: string | null;
  expiresInMs?: number | null;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  if (input.expiresAt) {
    const parsed = Date.parse(input.expiresAt);
    if (Number.isFinite(parsed) && parsed > now.getTime()) {
      return new Date(parsed);
    }
  }
  const ttl = Math.min(
    Math.max(input.expiresInMs ?? DEFAULT_INVITE_TTL_MS, 60_000),
    MAX_INVITE_TTL_MS,
  );
  return new Date(now.getTime() + ttl);
}

export function asInviteTokenRow(value: unknown): InviteTokenRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.token !== "string" ||
    !isInviteRole(record.role) ||
    typeof record.created_by !== "string" ||
    typeof record.expires_at !== "string" ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    token: record.token,
    role: record.role,
    created_by: record.created_by,
    invitee_email: normalizeInviteeEmail(record.invitee_email),
    expires_at: record.expires_at,
    used_at: typeof record.used_at === "string" ? record.used_at : null,
    created_at: record.created_at,
  };
}

export function emailsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  if (!expected) return true;
  const left = expected.trim().toLowerCase();
  const right = (actual ?? "").trim().toLowerCase();
  return Boolean(left && right && left === right);
}

export { INVITE_ROLES };
